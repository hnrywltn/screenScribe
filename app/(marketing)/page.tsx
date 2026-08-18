import Link from "next/link";
import { Camera, FileText, Film, Lock } from "lucide-react";
import FeatureCard from "@/components/FeatureCard";
import PricingCard from "@/components/PricingCard";
import TokenEstimator from "@/components/TokenEstimator";

export default function MarketingHomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28 text-center">
        <h1 className="text-4xl sm:text-5xl font-semibold text-[var(--color-text)] tracking-tight">
          Turn any recorded lecture into study-ready notes
        </h1>
        <p className="mt-5 text-lg text-[var(--color-muted)] max-w-2xl mx-auto">
          Upload a recorded presentation or screen share. StudyBeacon gives you back a screenshot of every slide, a
          full transcript, and the video converted to .mp4 — packaged into one download.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="#pricing"
            className="px-6 py-3 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white transition-colors"
          >
            See pricing
          </Link>
        </div>
      </section>

      {/* What you get */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <FeatureCard
            icon={Camera}
            title="Every slide, captured"
            description="Automatic detection of each new slide or screen — no manually scrubbing through the recording to grab screenshots yourself."
          />
          <FeatureCard
            icon={FileText}
            title="Full transcript"
            description="A complete written transcript of the audio, ready to search, copy, or study from."
          />
          <FeatureCard
            icon={Film}
            title="Clean .mp4"
            description="The original recording, converted to a standard, widely-playable .mp4."
          />
        </div>
      </section>

      {/* Privacy */}
      <section className="bg-[var(--color-sidebar)] py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 text-center text-white">
          <Lock className="w-6 h-6 mx-auto text-white/70 mb-4" />
          <h2 className="text-2xl font-semibold">Your recording never trains anyone else&apos;s AI</h2>
          <p className="mt-3 text-white/70">
            Transcription runs locally, on infrastructure we control — never sent to a third-party AI API. Once your
            download is ready, the video, screenshots, and transcript are deleted. There&apos;s no re-download and
            nothing kept around afterward.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-semibold text-[var(--color-text)]">Pricing</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)] max-w-xl mx-auto">
            Token-based — 1 token ≈ 1 minute of video processed, rounded up. No unlimited plan, on purpose: it keeps
            processing fast and reliable for everyone instead of a few heavy users slowing it down for the rest.
            Because nothing is stored and nothing trains an AI model, there&apos;s no hidden data business subsidizing
            the price — you&apos;re paying for compute, plainly. First pass at pricing — may change as we learn more
            from real usage.
          </p>
        </div>

        <div className="mb-10">
          <TokenEstimator />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          <PricingCard
            title="Pay as you go"
            price="$0.20"
            period="/ token"
            description="Buy tokens as you need them. 1 token processes about 1 minute of video."
          />
          <PricingCard
            title="Subscription"
            price="$15"
            period="/ month"
            description="100 tokens included every month — about 25% off buying the same tokens individually."
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-16 text-center">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Ready to try it?</h2>
        <Link
          href="/signup"
          className="mt-5 inline-block px-6 py-3 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors"
        >
          Create your account
        </Link>
      </section>
    </div>
  );
}
