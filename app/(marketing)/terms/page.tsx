export const metadata = {
  title: "Terms of Service — StudyBeacon",
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
      <h1 className="text-3xl font-semibold text-[var(--color-text)] tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">Last updated August 20, 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--color-text)]">
        <section>
          <h2 className="text-base font-medium mb-2">The service</h2>
          <p>
            StudyBeacon (operated by Light Patterns, LLC) turns an uploaded recorded video into a downloadable
            package containing a screenshot of each slide/screen shown, a full transcript of the audio, and the
            video converted to .mp4. You upload a video, we process it, and you download the result once — see our{" "}
            <a href="/privacy" className="underline hover:opacity-70 transition-opacity">
              Privacy Policy
            </a>{" "}
            for what happens to your files afterward.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">Your account</h2>
          <p>
            You&apos;re responsible for keeping your login credentials secure and for anything that happens under
            your account. You must be the owner of, or have permission to process, any video you upload.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">Payment</h2>
          <p>
            The service is metered by tokens (1 token = 1 minute of video processed, rounded up), purchased either
            as a one-time pack or included with a monthly subscription. Charges are processed by Stripe. Token
            purchases and subscription payments are generally non-refundable once a video has been processed, except
            where required by law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">Text message notifications</h2>
          <p>
            If you opt in to SMS notifications, you agree to receive text messages related to your account and
            uploads (processing started, download ready). You can opt out at any time by replying STOP, or by
            removing your phone number from your account settings.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">Acceptable use</h2>
          <p>
            Don&apos;t use StudyBeacon to process content you don&apos;t have the rights to, or in any way that
            violates applicable law. We reserve the right to suspend or terminate accounts that abuse the service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">No warranty</h2>
          <p>
            StudyBeacon is provided &quot;as is.&quot; We do our best to accurately transcribe and capture your
            video, but we don&apos;t guarantee perfect accuracy, and we&apos;re not liable for damages arising from
            your use of the service beyond the amount you paid us in the preceding 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">Changes to these terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the service after a change means you
            accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-2">Contact</h2>
          <p>
            Questions about these terms? Email{" "}
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
