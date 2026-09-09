import { cn } from "@/lib/utils/cn";

/**
 * Layout-preserving placeholder. Size it to match the real content so the
 * page does not jump when data arrives.
 *
 * Skeletons are decorative (aria-hidden); the surrounding region should
 * carry role="status" — see SkeletonPanel and the route-level loading.tsx.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block animate-pulse rounded-sm bg-muted", className)}
    />
  );
}

/** A few skeleton lines, for text blocks of roughly known length. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </span>
  );
}

/**
 * Card-shaped skeleton that announces the loading state for its region.
 * Use for lists whose card layout is already known.
 */
export function SkeletonPanel({
  label = "Loading…",
  rows = 3,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col gap-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-14 rounded-pill" />
            <Skeleton className="h-5 w-24 rounded-pill" />
          </div>
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}
