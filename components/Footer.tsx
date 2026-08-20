import Link from "next/link";

// Same "Designed by Light Patterns" attribution pattern used across the
// other Light Patterns apps (e.g. mix_bar's Footer.jsx) — just the
// bottom-bar piece, not a full multi-column marketing footer, since a
// SaaS app's public page has no hours/location section to show.
export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] px-4 sm:px-8 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
        <p className="text-xs text-[var(--color-muted)] text-center">
          &copy; {new Date().getFullYear()} Light Patterns, LLC. All rights reserved. Designed by{" "}
          <a
            href="https://lightpatternsonline.com/#contact"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-text)] transition-colors"
          >
            Light Patterns
          </a>
        </p>
        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
          <Link href="/terms" className="hover:text-[var(--color-text)] transition-colors">
            Terms of Service
          </Link>
          <span aria-hidden>&middot;</span>
          <Link href="/privacy" className="hover:text-[var(--color-text)] transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
