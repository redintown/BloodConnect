import { SkeletonPanel, Skeleton } from "@/components/ui/Skeleton";

/**
 * Route-level loading for the donor dashboard. Layout (nav + overlay) stays
 * mounted; only the page content swaps to skeletons that mirror the
 * attention + status card structure.
 */
export default function DonorDashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading donor dashboard…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonPanel label="" rows={1} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonPanel label="" rows={2} />
      </div>
    </div>
  );
}
