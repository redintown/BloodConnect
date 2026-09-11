"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { logoutAction } from "@/app/(auth)/actions";
import { BrandLogo } from "@/components/brand/BrandLogo";

/**
 * Global top bar: official brand mark on the left, account controls on the
 * right. This is currently the app header on every viewport, so it carries
 * the branding for mobile as well as desktop.
 *
 * The account controls remain their own `nav` landmark with an accessible
 * name; the brand link takes its name from BrandLogo's alt text, so the
 * product name is never announced twice.
 *
 * MIGRATION NOTE: when a route group adopts AppShell + DesktopNav (Phase 11C
 * onwards), the account controls move into the shell and this bar is removed
 * from the root layout — DesktopNav already renders the rail/tablet branding.
 * Do not render both at once, or the logo would appear twice.
 */

/**
 * Exact routes that own their own header (public + auth).
 *
 * MIGRATION NOTE: /how-it-works still uses this bar. It adopts PublicHeader
 * in the Phase 11C step that redesigns it, and its path joins this list then.
 *
 * Authenticated portals that adopt AppShell + DesktopNav (/donor, requester
 * `/requests` + `/request-blood`, `/hospital`, `/blood-bank`, `/admin`) are
 * hidden by path below — DesktopNav and the portal shell header already
 * carry branding and account controls. Do not render both, or the logo and
 * log-out control would appear twice.
 */
const HIDDEN_ON = ["/", "/login", "/register", "/find-blood", "/about"];

function ownsOwnChrome(pathname: string | null): boolean {
  if (!pathname) return false;
  if (HIDDEN_ON.includes(pathname)) return true;
  if (pathname === "/donor" || pathname.startsWith("/donor/")) return true;
  if (pathname === "/request-blood") return true;
  if (pathname === "/requests" || pathname.startsWith("/requests/")) return true;
  if (pathname === "/hospital" || pathname.startsWith("/hospital/")) return true;
  if (pathname === "/blood-bank" || pathname.startsWith("/blood-bank/")) return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  return false;
}

export function AuthNav() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (ownsOwnChrome(pathname)) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2 sm:px-6">
      <Link
        href="/"
        className="flex min-h-control shrink-0 items-center rounded-md"
      >
        <BrandLogo variant="mark" size="sm" priority />
      </Link>

      <nav aria-label="Account" className="ml-auto flex items-center gap-2 text-label">
        {loading ? (
          <span aria-live="polite" className="text-text-tertiary">
            <span className="sr-only">Checking your session…</span>
            <span aria-hidden>…</span>
          </span>
        ) : user ? (
          <>
            <span className="max-w-[12rem] truncate text-text-secondary">{user.email}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-control items-center rounded-md px-3 font-medium text-text-secondary hover:bg-muted hover:text-text"
              >
                Log out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="inline-flex min-h-control items-center rounded-md px-3 text-text-secondary hover:bg-muted hover:text-text"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-control items-center rounded-md px-3 font-medium text-text hover:bg-muted"
            >
              Register
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
