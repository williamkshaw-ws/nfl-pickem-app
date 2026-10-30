import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result: Record<string, any> = {
    time: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    envCheck: {
      hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      pkLength: process.env.FIREBASE_PRIVATE_KEY?.length ?? 0,
    },
  };

  try {
    const { getFirebaseAdminApp } = await import("@/lib/firebase-admin");
    getFirebaseAdminApp();
    result.firebaseAdmin = "initialized successfully";
  } catch (err: any) {
    result.firebaseAdminError = {
      message: err?.message,
      stack: err?.stack,
    };
  }

  return NextResponse.json(result);
}
