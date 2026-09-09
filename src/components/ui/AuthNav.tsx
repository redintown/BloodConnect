"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * Global account bar. A real `nav` landmark with an accessible name, and the
 * session-loading placeholder announces politely instead of being a silent
 * ellipsis.
 *
 * Kept as global chrome for this foundation phase; the account controls move
 * into the shell header/rail when the authenticated screens are redesigned.
 */
export function AuthNav() {
  const { user, loading } = useAuth();

  return (
    <nav
      aria-label="Account"
      className="flex items-center justify-end gap-3 border-b border-border bg-surface px-4 py-2 text-label sm:px-6"
    >
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
  );
}
