// Deliberate duplicate of worker/lib/email.ts's pattern, not a shared
// import — separate npm packages, and these send different things (this
// one's account emails, the worker's is processing-complete). Same
// approach: raw fetch to Resend's REST API, no SDK.
const RESEND_API_URL = "https://api.resend.com/emails";
// Resend's shared test sender — works without a verified custom domain,
// but only delivers to the Resend account's own verified address. Swap
// for a real "from" once a domain is verified with Resend.
const FROM_ADDRESS = "StudyBeacon <onboarding@resend.dev>";

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — would have emailed ${to} a verification link: ${verifyUrl}`);
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: "Verify your StudyBeacon email",
      html:
        `<p>Confirm your email so you don't miss download-ready notifications.</p>` +
        `<p><a href="${verifyUrl}">Verify your email</a> — this link expires in 24 hours.</p>`,
    }),
  });

  if (!res.ok) {
    // Don't throw — a failed verification email shouldn't fail signup
    // itself. Log loudly so it's visible; the user can request a resend.
    console.error(`[email] Resend API error (${res.status}):`, await res.text());
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — would have emailed ${to} a password reset link: ${resetUrl}`);
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: "Reset your StudyBeacon password",
      html:
        `<p>Someone requested a password reset for this account. If that wasn't you, ignore this email.</p>` +
        `<p><a href="${resetUrl}">Reset your password</a> — this link expires in 30 minutes.</p>`,
    }),
  });

  if (!res.ok) {
    console.error(`[email] Resend API error (${res.status}):`, await res.text());
  }
}

export async function sendReceiptEmail(
  to: string,
  opts: { tokens: number; amountCents: number; kind: "pack" | "subscription" }
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const amount = (opts.amountCents / 100).toFixed(2);
  const subject =
    opts.kind === "subscription" ? "Your StudyBeacon subscription receipt" : "Your StudyBeacon purchase receipt";
  const description =
    opts.kind === "subscription"
      ? `Your StudyBeacon subscription renewed: $${amount} for ${opts.tokens} tokens.`
      : `Thanks for your purchase: $${amount} for ${opts.tokens} tokens.`;

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — would have emailed ${to} a receipt: ${description}`);
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject,
      html: `<p>${description}</p>`,
    }),
  });

  if (!res.ok) {
    console.error(`[email] Resend API error (${res.status}):`, await res.text());
  }
}
