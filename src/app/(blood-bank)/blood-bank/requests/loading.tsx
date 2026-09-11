import { Skeleton, SkeletonPanel } from "@/components/ui/Skeleton";

export default function BloodBankEscalationsLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">Loading escalated requests…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <SkeletonPanel label="" rows={3} />
    </div>
  );
}
