import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { AvailabilityBadge } from "@/components/ui/AvailabilityBadge";
import { DistanceBadge } from "@/components/ui/DistanceBadge";
import type { DonorPublicSummary } from "@/types/domain";

/**
 * Renders only the fields on DonorPublicSummary — the type system itself
 * prevents this component from ever being handed a donor's exact location
 * or contact details. Contact reveal after accept uses AcceptedMatchContact.
 */
export function DonorCard({ donor }: { donor: DonorPublicSummary }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <BloodGroupBadge bloodGroup={donor.bloodGroup} />
        <AvailabilityBadge isAvailable={donor.isAvailable} isAvailableAtNight={donor.isAvailableAtNight} />
      </div>
      <DistanceBadge distanceKm={donor.distanceKm} />
    </div>
  );
}
