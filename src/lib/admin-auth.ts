import { cookies } from "next/headers";
import crypto from "crypto";
import { HttpError } from "./server-auth";

// SECURITY: there are intentionally NO default credentials or secrets. If these
// environment variables are not set, the admin portal is disabled entirely.
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
export const ADMIN_COOKIE_NAME = "pp_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || "";

/** True only when username, password and a sufficiently long signing secret are all configured. */
export function isAdminConfigured(): boolean {
  return (
    ADMIN_USERNAME.length > 0 &&
    ADMIN_PASSWORD.length >= 12 &&
    ADMIN_SECRET.length >= 32
  );
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Perform dummy timing safe equal to equalize execution path
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Creates an HMAC-signed session token for the admin.
 */
export function createAdminToken(): string {
  if (!isAdminConfigured()) {
    throw new HttpError(503, "Admin portal is not configured");
  }
  const payload = {
    user: ADMIN_USERNAME,
    exp: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", ADMIN_SECRET).update(data).digest("base64url");
  return `${data}.${hmac}`;
}

/**
 * Verifies an HMAC-signed session token.
 */
export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!isAdminConfigured()) return false;
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [data, signature] = parts;
  const expectedHmac = crypto.createHmac("sha256", ADMIN_SECRET).update(data).digest("base64url");

  // Constant-time comparison
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedHmac);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.user !== ADMIN_USERNAME) return false;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks admin authentication from request cookies. Throws HttpError(401) if not valid.
 */
export async function requireAdminSession(request?: Request): Promise<void> {
  let token: string | undefined;

  if (request) {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]+)`));
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  }

  if (!verifyAdminToken(token)) {
    throw new HttpError(401, "Admin authorization required");
  }
}
