"use client";

import Link from "next/link";
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
export function AuthNav() {
  const { user, loading } = useAuth();

  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2 sm:px-6">
      <Link
        href="/"
        className="flex min-h-control shrink-0 items-center rounded-md"
      >
        <BrandLogo variant="mark" size="sm" priority />
      </Link>

      <nav aria-label="Account" className="ml-auto flex items-center gap-3 text-label">
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
                className="rounded-md px-2 py-1.5 font-medium text-text-secondary hover:bg-muted hover:text-text"
              >
                Log out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-md px-2 py-1.5 text-text-secondary hover:bg-muted hover:text-text"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md px-2 py-1.5 font-medium text-text hover:bg-muted"
            >
              Register
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
