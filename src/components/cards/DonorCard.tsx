import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { DistanceBadge } from "@/components/ui/DistanceBadge";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/lib/utils/cn";
import type { DonorPublicSummary } from "@/types/domain";

/**
 * Renders only the fields on DonorPublicSummary — the type system itself
 * prevents this component from ever being handed a donor's exact location
 * or contact details. Contact reveal after accept uses AcceptedMatchContact.
 */
export function DonorCard({ donor }: { donor: DonorPublicSummary }) {
  const availabilityLabel = !donor.isAvailable
    ? "Unavailable"
    : donor.isAvailableAtNight
      ? "Available (incl. night)"
      : "Available";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <BloodGroupBadge bloodGroup={donor.bloodGroup} />
        <StatusChip kind="verification" value={donor.verificationStatus} />
        <span
          className={cn(
            "inline-flex items-center rounded-sm border px-2 py-0.5 text-caption font-medium",
            donor.isAvailable
              ? "border-success/20 bg-success-surface text-success"
              : "border-border bg-muted text-text-secondary"
          )}
        >
          {availabilityLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {donor.matchStatus && <StatusChip kind="match" value={donor.matchStatus} />}
        <DistanceBadge distanceKm={donor.distanceKm} />
      </div>
    </div>
  );
}
