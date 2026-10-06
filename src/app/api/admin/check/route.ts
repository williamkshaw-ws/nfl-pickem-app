import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
