import type { DonorProfile, DonorPublicSummary } from "@/types/domain";

/**
 * The only allowed public projection of a donor. Location, contact details,
 * and other owner-only fields are intentionally omitted.
 */
export function toDonorPublicSummary(
  profile: DonorProfile,
  distanceKm: number | null = null
): DonorPublicSummary {
  return {
    id: profile.id,
    bloodGroup: profile.bloodGroup,
    isAvailable: profile.isAvailable,
    isAvailableAtNight: profile.isAvailableAtNight,
    verificationStatus: profile.verificationStatus,
    distanceKm,
  };
}
