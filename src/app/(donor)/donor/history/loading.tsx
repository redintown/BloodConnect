import { SkeletonPanel, Skeleton } from "@/components/ui/Skeleton";

/** Route-level loading for /donor/history. */
export default function DonorHistoryLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading donation history…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <SkeletonPanel label="" rows={3} />
    </div>
  );
}
