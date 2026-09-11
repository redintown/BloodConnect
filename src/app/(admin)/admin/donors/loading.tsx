import { Skeleton, SkeletonPanel } from "@/components/ui/Skeleton";

export default function AdminDonorsLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading donor verification queue…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <SkeletonPanel label="" rows={3} />
        <SkeletonPanel label="" rows={3} />
      </div>
    </div>
  );
}
