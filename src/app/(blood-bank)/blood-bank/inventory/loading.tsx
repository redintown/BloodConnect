import { Skeleton, SkeletonPanel } from "@/components/ui/Skeleton";

export default function BloodBankInventoryLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading blood bank inventory…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonPanel label="" rows={1} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
