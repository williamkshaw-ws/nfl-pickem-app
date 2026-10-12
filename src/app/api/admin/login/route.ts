import { NextResponse } from "next/server";
import {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminToken,
  isAdminConfigured,
  timingSafeStringEqual,
} from "@/lib/admin-auth";
import { errorResponse, HttpError } from "@/lib/server-auth";
import {
  getClientIp,
  peekRateLimit,
  recordFailure,
  clearRateLimit,
  enforceRateLimit,
} from "@/lib/rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // Global brake on request volume + lockout after repeated failures
    enforceRateLimit(`admin-login-req:${ip}`, 20, LOGIN_WINDOW_MS);
    const failKey = `admin-login-fail:${ip}`;
    if (peekRateLimit(failKey, MAX_FAILED_ATTEMPTS, LOGIN_WINDOW_MS)) {
      throw new HttpError(429, "Too many failed attempts. Try again in 15 minutes.");
    }

    // Admin portal stays disabled unless real credentials + secret are configured
    if (!isAdminConfigured()) {
      throw new HttpError(401, "Invalid admin username or password");
    }

    const body = await request.json();
    const { username, password } = body || {};

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      throw new HttpError(400, "Username and password are required");
    }

    // Check credentials against the specified admin credentials in constant time
    const userMatches = timingSafeStringEqual(username.trim(), ADMIN_USERNAME);
    const passMatches = timingSafeStringEqual(password, ADMIN_PASSWORD);
    if (!userMatches || !passMatches) {
      recordFailure(failKey);
      throw new HttpError(401, "Invalid admin username or password");
    }

    clearRateLimit(failKey);
    const token = createAdminToken();

    const response = NextResponse.json({
      success: true,
      message: "Admin session authenticated",
    });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
