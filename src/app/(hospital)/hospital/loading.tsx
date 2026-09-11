import { SkeletonPanel, Skeleton } from "@/components/ui/Skeleton";

export default function HospitalDashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading hospital dashboard…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonPanel label="" rows={2} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonPanel label="" rows={2} />
        <SkeletonPanel label="" rows={2} />
      </div>
    </div>
  );
}
