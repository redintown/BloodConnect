import { SkeletonPanel, Skeleton } from "@/components/ui/Skeleton";

/** Route-level loading for `/requests/[id]`. */
export default function RequestDetailLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto flex w-full max-w-form flex-col gap-8">
      <span className="sr-only">Loading request details…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <SkeletonPanel label="" rows={4} />
      <SkeletonPanel label="" rows={3} />
    </div>
  );
}
