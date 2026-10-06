import { cookies } from "next/headers";
import crypto from "crypto";
import { HttpError } from "./server-auth";

export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "AdminPass123!";
export const ADMIN_COOKIE_NAME = "pp_admin_session";

const ADMIN_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.FIREBASE_PRIVATE_KEY ||
  "pocketpicks_super_admin_secret_key_2026_secured";

/**
 * Creates an HMAC-signed session token for the admin.
 */
export function createAdminToken(): string {
  const payload = {
    user: ADMIN_USERNAME,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", ADMIN_SECRET).update(data).digest("base64url");
  return `${data}.${hmac}`;
}

/**
 * Verifies an HMAC-signed session token.
 */
export function verifyAdminToken(token: string | null | undefined): boolean {
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
