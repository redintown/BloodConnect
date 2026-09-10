import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Icon } from "@/components/ui/Icon";

/**
 * Shared composition for /login and /register.
 *
 * A single centered column on a canvas background: brand, then one bordered
 * surface card holding the page's heading and form. Deliberately calm —
 * no gradient, no glass, no shadow (elevation is reserved for floating
 * layers), and no emergency red anywhere on the sign-in path.
 *
 * This layout owns the `main` landmark and the brand lock-up, so auth pages
 * must not render either themselves. The global account bar hides itself on
 * these routes, which keeps exactly one brand name on screen and removes the
 * redundant "Log in / Register" links from the sign-in page.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10 outline-none sm:py-14"
      >
        <Link href="/" className="mx-auto w-fit rounded-md">
          <BrandLogo variant="full" size="md" priority />
        </Link>

        <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">{children}</div>

        <Link
          href="/"
          className="mx-auto inline-flex min-h-control items-center gap-1 rounded-md px-3 text-label text-text-secondary hover:text-text"
        >
          <Icon name="chevron-left" className="h-4 w-4" />
          Back to home
        </Link>
      </main>
    </div>
  );
}
