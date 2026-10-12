import crypto from "crypto";

const PREFIX = "scrypt$";

/** Hashes a league password with scrypt + random salt. Empty input returns "". */
export function hashLeaguePassword(plain: string): string {
  const clean = (plain || "").trim();
  if (!clean) return "";
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(clean, salt, 32);
  return `${PREFIX}${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function isHashedPassword(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

/**
 * Verifies a provided password against a stored value.
 * Supports legacy plaintext values (so existing leagues keep working) and
 * reports `needsUpgrade` so the caller can re-save them as a hash.
 */
export function verifyLeaguePassword(
  provided: string,
  stored: string
): { ok: boolean; needsUpgrade: boolean } {
  const p = (provided || "").trim();
  if (isHashedPassword(stored)) {
    const parts = stored.split("$");
    if (parts.length !== 3) return { ok: false, needsUpgrade: false };
    try {
      const salt = Buffer.from(parts[1], "base64");
      const expected = Buffer.from(parts[2], "base64");
      const actual = crypto.scryptSync(p, salt, expected.length);
      return { ok: crypto.timingSafeEqual(actual, expected), needsUpgrade: false };
    } catch {
      return { ok: false, needsUpgrade: false };
    }
  }

  // Legacy plaintext
  const a = Buffer.from(p);
  const b = Buffer.from((stored || "").trim());
  let ok = false;
  if (a.length === b.length) ok = crypto.timingSafeEqual(a, b);
  else crypto.timingSafeEqual(a, a);
  return { ok, needsUpgrade: ok };
}
