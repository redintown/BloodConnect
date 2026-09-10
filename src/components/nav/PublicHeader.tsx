import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { buttonClassName } from "@/components/ui/Button";
import { isNavItemActive, type NavItem } from "@/components/nav/navConfig";

/**
 * Top navigation for the public, anonymous-facing surface.
 *
 * A horizontal bar at every viewport rather than the rail/bottom-bar pair
 * used inside the portals: a visitor is reading a page, not operating a
 * dashboard, and three destinations do not justify a hamburger. Below `sm`
 * the destination row wraps underneath the brand and account actions, so the
 * mobile header stays a single uncrowded strip.
 *
 * Only genuinely public routes appear here. Portal destinations are never
 * exposed to anonymous visitors — they are role-gated server-side, so
 * advertising them would just produce a redirect to sign-in.
 *
 * "Home" is intentionally not a separate item: the brand lock-up is the home
 * affordance, and duplicating it would spend a mobile touch target on a link
 * the visitor already has.
 *
 * Deliberately a server component with no session read. Reading the session
 * here would mean shipping the Supabase browser client to the public entry
 * point (measured at ~78kB of extra JS) purely to choose between "Sign in"
 * and "Log out" — unjustifiable on the page someone opens during an
 * emergency on a bad connection. `/login` already redirects an
 * authenticated visitor to their own landing route, so the sign-in link
 * stays correct for everyone, and the account bar continues to carry
 * session state on the authenticated routes.
 */
const PUBLIC_ITEMS: NavItem[] = [
  { href: "/find-blood", label: "Find blood", icon: "search" },
  { href: "/how-it-works", label: "How it works", icon: "list" },
  { href: "/about", label: "About", icon: "info" },
];

const linkClassName =
  "inline-flex min-h-control items-center rounded-md px-3 text-label " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1";

export function PublicHeader({
  /** Current route, so the active destination can be marked. */
  currentPath,
}: {
  currentPath?: string;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-shell px-4 sm:px-6 wide:max-w-shell-wide">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
          <Link href="/" className="flex min-h-control shrink-0 items-center rounded-md">
            {/* Emblem alone on phones; the lock-up once there is room for the
                wordmark. Only one is ever rendered, so the brand is named once. */}
            <BrandLogo variant="mark" size="sm" className="sm:hidden" priority />
            <BrandLogo variant="full" size="sm" className="hidden sm:inline-flex" priority />
          </Link>

          <nav
            aria-label="Public"
            className={cn(
              // Mobile: own row under the brand. Tablet up: inline, with the
              // account actions pushed to the far right.
              "order-last flex w-full items-center gap-0.5 border-t border-border pt-1",
              "sm:order-none sm:ml-2 sm:w-auto sm:border-t-0 sm:pt-0"
            )}
          >
            {PUBLIC_ITEMS.map((item) => {
              const active = isNavItemActive(currentPath ?? null, item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    linkClassName,
                    active
                      ? "bg-muted font-semibold text-text"
                      : "text-text-secondary hover:bg-muted hover:text-text"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              href="/login"
              className={cn(linkClassName, "text-text-secondary hover:bg-muted hover:text-text")}
            >
              Sign in
            </Link>
            <Link href="/register" className={buttonClassName({ variant: "primary", size: "sm" })}>
              Create account
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
