import { SkeletonPanel, Skeleton } from "@/components/ui/Skeleton";

/** Route-level loading for /donor/requests. */
export default function DonorRequestsLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading matched requests…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <SkeletonPanel label="" rows={3} />
      <SkeletonPanel label="" rows={2} />
    </div>
  );
}
