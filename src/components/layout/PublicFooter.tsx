import Link from "next/link";
import { siteConfig } from "@/config/site";

/**
 * Footer for the public surface.
 *
 * Text-only by design: the brand is already named by the header lock-up, and
 * repeating the logo here would give the page two brand marks. Carries the
 * secondary reading routes so the landing page's calls to action stay the
 * only prominent choices.
 */
const FOOTER_ITEMS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-shell flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 wide:max-w-shell-wide">
        <p className="text-caption text-text-tertiary">
          {siteConfig.name} — {siteConfig.description}
        </p>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-1">
          {FOOTER_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-control items-center rounded-md px-3 text-label text-text-secondary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
