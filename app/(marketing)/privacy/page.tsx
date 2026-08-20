export const metadata = {
  title: "Privacy Policy — StudyBeacon",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
      <h1 className="text-3xl font-semibold text-[var(--color-text)] tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">Last updated August 20, 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--color-text)]">
        <section>
          <h2 className="text-base font-medium mb-2">What we collect</h2>
          <p>
            When you create an account, we collect your name, email address, and password (stored as a salted
            hash, never in plain text). Phone number is optional and only collected if you provide it. When you
            upload a video, we process it (transcoding, screenshot extraction, transcription) to build your
            download package.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">Your video, transcript, and screenshots</h2>
          <p>
            Nothing is kept around. Your uploaded video and the intermediate files created while processing it are
            deleted the moment your finished download package is built. The finished package itself is deleted
            automatically within one hour of being ready, or immediately after you download it — whichever comes
            first. Transcription runs on infrastructure we control, never a third-party AI API, and nothing you
            upload is used to train any model.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">Text message (SMS) notifications</h2>
          <p>
            If you provide a phone number and check the box to opt in, we&apos;ll text you to let you know when a
            video you uploaded has started processing and when it&apos;s ready to download. These are account/order
            status notifications only — we don&apos;t send promotional or marketing texts. Message frequency
            depends on how often you upload (typically up to two messages per video processed). Message and data
            rates may apply depending on your mobile plan. Reply <strong>STOP</strong> at any time to stop receiving
            texts, or <strong>HELP</strong> for help. Your phone number is never sold or shared with third parties
            for marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">Payment information</h2>
          <p>
            Payments are processed by Stripe. We never see or store your full card number — Stripe handles that
            directly. We keep a record of what you purchased (tokens, subscription status) so your account balance
            stays accurate.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">How to reach us</h2>
          <p>
            Questions about this policy, or want your account and its data deleted? Email us at{" "}
            <a href="mailto:admin@lightpatternsonline.com" className="underline hover:opacity-70 transition-opacity">
              admin@lightpatternsonline.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
