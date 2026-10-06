import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { Resend } from "resend";
import { requireUser, escapeHtml, errorResponse, HttpError } from "@/lib/server-auth";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const caller = await requireUser(req);
    const { email, name } = await req.json();

    if (!email || typeof email !== "string") {
      throw new HttpError(400, "Email is required");
    }

    const cleanEmail = email.trim().toLowerCase();
    // Prevent sending verification emails to addresses the caller doesn't own
    if (caller.email?.toLowerCase() !== cleanEmail) {
      throw new HttpError(403, "Can only send verification to your own account email");
    }

    // Generate the email verification link using Firebase Admin SDK
    const firebaseLink = await adminAuth.generateEmailVerificationLink(cleanEmail);
    
    // Parse the oobCode from the Firebase link and point it to our custom Next.js handler
    const urlObj = new URL(firebaseLink);
    const oobCode = urlObj.searchParams.get("oobCode");
    
    // For development we use localhost. In production this should be your real domain.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const customLink = `${baseUrl}/auth/verify?oobCode=${oobCode}`;

    const safeName = escapeHtml(typeof name === "string" && name.trim() ? name.trim() : "Player");

    // Send beautiful custom HTML email via Resend
    const { error } = await resend.emails.send({
      from: "PocketPicks <noreply@pocketpicks.app>",
      to: cleanEmail,
      subject: "Verify your PocketPicks account",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
          <h2 style="color: #0f172a; margin-bottom: 24px;">Welcome to PocketPicks, ${safeName}!</h2>
          <p style="color: #334155; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            We're thrilled to have you. Before you can jump in and start making your picks, we just need to quickly verify your email address.
          </p>
          <a href="${customLink}" style="display: inline-block; background-color: #059669; color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 16px;">
            Verify My Account
          </a>
          <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
            If you didn't request this email, you can safely ignore it.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new HttpError(500, "Failed to send verification email");
    }

    // Do NOT return the link in the response to prevent bypassing email verification
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return errorResponse(error);
  }
}
