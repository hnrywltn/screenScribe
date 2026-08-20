// Same "Designed by Light Patterns" attribution pattern used across the
// other Light Patterns apps (e.g. mix_bar's Footer.jsx) — just the
// bottom-bar piece, not a full multi-column marketing footer, since a
// SaaS app's public page has no hours/location section to show.
export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] px-4 sm:px-8 py-4">
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
    </footer>
  );
}
