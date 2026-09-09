import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * The single page-title primitive. Replaces the Phase 0 PageShell heading,
 * including its "phase note" scaffolding — no skeleton-phase language ships.
 *
 * UX rules:
 *  - exactly one H1 per page, and one primary `action` at most;
 *  - `backHref` is for hierarchical navigation, never as a substitute for nav;
 *  - `status` is for a StatusChip or similar, not for free-form prose.
 *
 * On mobile the action drops below the title (full-width friendly); from
 * `sm` up it sits inline on the right.
 */
export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  status,
  action,
  className,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  status?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1 text-label text-text-secondary hover:text-text"
        >
          <Icon name="chevron-left" className="h-4 w-4" />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-text">{title}</h1>
            {status}
          </div>
          {description && (
            <p className="text-body text-text-secondary">{description}</p>
          )}
        </div>

        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}
