import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Admin session logged out",
  });

  response.cookies.delete(ADMIN_COOKIE_NAME);

  return response;
}
