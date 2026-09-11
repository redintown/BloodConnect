import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { BrandLogo } from "@/components/brand/BrandLogo";

/**
 * Slim account strip for hospital / blood-bank AppShell.
 *
 * Brand mark is mobile-only. Optional organization name uses data already
 * loaded by the layout/page — no extra query. Presentation only.
 */
export function OrganizationShellHeader({
  email,
  homeHref,
  organizationName,
  organizationTypeLabel,
}: {
  email: string | null;
  homeHref: string;
  organizationName?: string | null;
  organizationTypeLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2 sm:px-6">
      <Link
        href={homeHref}
        className="flex min-h-control shrink-0 items-center rounded-md sm:hidden"
      >
        <BrandLogo variant="mark" size="sm" priority />
      </Link>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        {(organizationName || organizationTypeLabel) && (
          <div className="hidden min-w-0 flex-col items-end sm:flex">
            {organizationName && (
              <span className="max-w-[14rem] truncate text-label font-medium text-text">
                {organizationName}
              </span>
            )}
            {organizationTypeLabel && (
              <span className="text-caption text-text-tertiary">{organizationTypeLabel}</span>
            )}
          </div>
        )}
        {email && (
          <span className="hidden max-w-[12rem] truncate text-label text-text-secondary lg:inline">
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
