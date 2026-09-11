import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { BrandLogo } from "@/components/brand/BrandLogo";

/**
 * Slim account strip for the Admin AppShell.
 *
 * Brand mark is mobile-only: from `sm` up, DesktopNav already carries the
 * logo. Account controls stay here on every viewport so hiding AuthNav on
 * admin paths does not remove log out.
 *
 * Presentation only — `logoutAction` is the existing auth server action.
 */
export function AdminShellHeader({ email }: { email: string | null }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2 sm:px-6">
      <Link
        href="/admin"
        className="flex min-h-control shrink-0 items-center rounded-md sm:hidden"
      >
        <BrandLogo variant="mark" size="sm" priority />
      </Link>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        {email && (
          <span className="hidden max-w-[14rem] truncate text-label text-text-secondary sm:inline">
            {email}
          </span>
        )}
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex min-h-control items-center rounded-md px-3 text-label font-medium text-text-secondary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
