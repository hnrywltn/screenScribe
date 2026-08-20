// Deliberate duplicate of worker/lib/email.ts's pattern, not a shared
// import — separate npm packages, and these send different things (this
// one's account emails, the worker's is processing-complete). Same
// approach: raw fetch to Resend's REST API, no SDK.
import { renderEmailHtml, emailButton } from "./emailTemplate";

const RESEND_API_URL = "https://api.resend.com/emails";
// Resend's shared test sender — works without a verified custom domain,
// but only delivers to the Resend account's own verified address. Swap
// for a real "from" once a domain is verified with Resend.
const FROM_ADDRESS = "StudyBeacon <onboarding@resend.dev>";

async function send(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — would have emailed ${to}: ${subject}`);
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });

  if (!res.ok) {
    // Don't throw — a failed account email shouldn't fail the flow that
    // triggered it. Log loudly so it's visible.
    console.error(`[email] Resend API error (${res.status}):`, await res.text());
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const html = renderEmailHtml({
    heading: "Verify your email",
    bodyHtml:
      `<p style="margin:0 0 16px;">Confirm your email so you don't miss download-ready notifications.</p>` +
      emailButton(verifyUrl, "Verify your email") +
      `<p style="margin:16px 0 0;font-size:13px;color:#7a8c88;">This link expires in 24 hours.</p>`,
  });

  await send(to, "Verify your StudyBeacon email", html);
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const html = renderEmailHtml({
    heading: "Reset your password",
    bodyHtml:
      `<p style="margin:0 0 16px;">Someone requested a password reset for this account. If that wasn't you, you can safely ignore this email.</p>` +
      emailButton(resetUrl, "Reset your password") +
      `<p style="margin:16px 0 0;font-size:13px;color:#7a8c88;">This link expires in 30 minutes.</p>`,
  });

  await send(to, "Reset your StudyBeacon password", html);
}

export async function sendReceiptEmail(
  to: string,
  opts: { tokens: number; amountCents: number; kind: "pack" | "subscription" }
): Promise<void> {
  const amount = (opts.amountCents / 100).toFixed(2);
  const heading = opts.kind === "subscription" ? "Subscription renewed" : "Thanks for your purchase";
  const description =
    opts.kind === "subscription"
      ? `Your StudyBeacon subscription renewed: <strong>$${amount}</strong> for <strong>${opts.tokens} tokens</strong>.`
      : `You purchased <strong>${opts.tokens} tokens</strong> for <strong>$${amount}</strong>.`;
  const subject =
    opts.kind === "subscription" ? "Your StudyBeacon subscription receipt" : "Your StudyBeacon purchase receipt";

  const html = renderEmailHtml({
    heading,
    bodyHtml: `<p style="margin:0;">${description}</p>`,
  });

  await send(to, subject, html);
}
