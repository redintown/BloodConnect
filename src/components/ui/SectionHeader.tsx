import { cn } from "@/lib/utils/cn";

/**
 * Section-level heading (H2) for breaking long pages into scannable blocks.
 *
 * `count` is rendered as a neutral counter beside the title — it exists so
 * later phases can surface queue sizes without inventing a second pattern.
 * Counts must come from real data; never render a placeholder number.
 */
export function SectionHeader({
  title,
  description,
  count,
  action,
  className,
  id,
}: {
  title: string;
  description?: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 id={id} className="text-h2 text-text">
            {title}
          </h2>
          {typeof count === "number" && (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-caption tabular-nums text-text-secondary">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="text-label font-normal text-text-secondary">{description}</p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
