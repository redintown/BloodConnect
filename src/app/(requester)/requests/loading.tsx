import { SkeletonPanel, Skeleton } from "@/components/ui/Skeleton";

/** Route-level loading for requester home (`/requests`). */
export default function RequesterRequestsLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading your requests…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonPanel label="" rows={3} />
      <SkeletonPanel label="" rows={2} />
    </div>
  );
}
