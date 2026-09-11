import { Skeleton, SkeletonPanel } from "@/components/ui/Skeleton";

export default function BloodBankProfileLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-form flex-col gap-8"
    >
      <span className="sr-only">Loading blood bank profile…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonPanel label="" rows={1} />
        <SkeletonPanel label="" rows={1} />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
