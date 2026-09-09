import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * "Nothing here yet" surface.
 *
 * UX rule: an empty state must either offer a next action or explain what
 * causes content to appear. A bare title is a dead end — the most common
 * complaint in the Phase 11A audit.
 *
 * The original `{ title, description }` signature is preserved so existing
 * call sites keep compiling while screens migrate in later sub-phases.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  /** What triggers content to appear here. */
  description?: string;
  icon?: IconName;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-10 text-center",
        className
      )}
    >
      {icon && (
        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-pill bg-muted text-text-tertiary">
          <Icon name={icon} />
        </span>
      )}
      <p className="text-h3 text-text">{title}</p>
      {description && (
        <p className="max-w-prose text-body text-text-secondary">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
