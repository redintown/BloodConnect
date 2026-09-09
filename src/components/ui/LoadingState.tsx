import { cn } from "@/lib/utils/cn";
import { Spinner } from "@/components/ui/Icon";

/**
 * Indeterminate loading indicator for regions with no known layout.
 * Where the final layout IS known, prefer <Skeleton> to avoid layout jumps.
 *
 * Announces politely via role="status" so screen-reader users are told the
 * region is loading. The spinner keeps animating under reduced-motion
 * (slowed, not removed) because it carries status, not decoration.
 */
export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 py-10 text-body text-text-secondary",
        className
      )}
    >
      <Spinner />
      {label}
    </div>
  );
}
