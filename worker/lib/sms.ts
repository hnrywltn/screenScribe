// Deliberate duplicate of lib/sms.ts's pattern, not a shared import —
// separate npm packages, same convention already used for email.ts.
function messagesUrl(accountSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.log(`[sms] Twilio env vars not set — would have texted ${to}: ${body}`);
    return;
  }

  const res = await fetch(messagesUrl(accountSid), {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });

  if (!res.ok) {
    console.error(`[sms] Twilio API error (${res.status}):`, await res.text());
  }
}

export function sendDownloadReadySms(to: string): Promise<void> {
  return sendSms(
    to,
    "StudyBeacon: Your video is ready! Log in to download it — download link expires in 1 hour. Reply STOP to opt out."
  );
}
