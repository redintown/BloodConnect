import { Skeleton, SkeletonPanel } from "@/components/ui/Skeleton";

export default function AdminOrganizationsLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading organization verification queue…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <SkeletonPanel label="" rows={3} />
        <SkeletonPanel label="" rows={3} />
      </div>
    </div>
  );
}
