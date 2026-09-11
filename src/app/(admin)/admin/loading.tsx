import { Skeleton, SkeletonPanel } from "@/components/ui/Skeleton";

export default function AdminDashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading admin dashboard…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonPanel label="" rows={1} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonPanel label="" rows={1} />
        <SkeletonPanel label="" rows={1} />
        <SkeletonPanel label="" rows={1} />
      </div>
    </div>
  );
}
