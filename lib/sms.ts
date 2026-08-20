// Raw fetch to Twilio's REST API, same "no SDK dependency needed for one
// endpoint" reasoning as lib/email.ts's use of Resend. Deliberately
// duplicated in worker/lib/sms.ts rather than shared — separate npm
// packages, same convention already used for email.ts/tempStorage.ts.

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
    // Don't throw — a failed text shouldn't fail the flow that triggered
    // it. Log loudly so it's visible. Same non-throwing convention as
    // the Resend email functions.
    console.error(`[sms] Twilio API error (${res.status}):`, await res.text());
  }
}

export function sendUploadReceivedSms(to: string): Promise<void> {
  return sendSms(to, "StudyBeacon: Your video has started processing. We'll text you when it's ready to download. Reply STOP to opt out.");
}
