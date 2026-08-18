const RESEND_API_URL = "https://api.resend.com/emails";
// Resend's shared test sender — works without a verified custom domain,
// but only delivers to the Resend account's own verified address. Swap
// for a real "from" once a domain is verified with Resend.
const FROM_ADDRESS = "StudyBeacon <onboarding@resend.dev>";

export async function sendDownloadReadyEmail(to: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const downloadUrl = `${appUrl}/sessions`;

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — would have emailed ${to}: your download is ready`);
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
      subject: "Your StudyBeacon download is ready",
      html: `<p>Your video has finished processing. <a href="${downloadUrl}">Download it here</a> — this link stays available for 1 hour.</p>`,
    }),
  });

  if (!res.ok) {
    // Don't throw — a failed notification email shouldn't fail the whole
    // job when the actual processing already succeeded. Log loudly so
    // it's visible, but the session is still marked complete either way.
    console.error(`[email] Resend API error (${res.status}):`, await res.text());
  }
}
