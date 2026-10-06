import { NextResponse } from "next/server";
import {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_COOKIE_NAME,
  createAdminToken,
  timingSafeStringEqual,
} from "@/lib/admin-auth";
import { errorResponse, HttpError } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
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
      throw new HttpError(401, "Invalid admin username or password");
    }

    const token = createAdminToken();

    const response = NextResponse.json({
      success: true,
      message: "Admin session authenticated",
    });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
