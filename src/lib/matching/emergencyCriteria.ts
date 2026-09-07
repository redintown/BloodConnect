import { isCompatible } from "@/lib/matching/compatibility";
import type { BloodGroup } from "@/lib/constants/bloodGroups";
import type { VerificationStatus } from "@/lib/constants/verification";

export const EMERGENCY_RADIUS_KM_MIN = 5;
export const EMERGENCY_RADIUS_KM_MAX = 50;
export const EMERGENCY_RADIUS_KM_DEFAULT = 10;
export const EMERGENCY_RADIUS_KM_OPTIONS = [5, 10, 15, 20, 30, 50] as const;
/** Upper bound for PostGIS search; per-donor radius still applies. */
export const EMERGENCY_SEARCH_MAX_METERS = EMERGENCY_RADIUS_KM_MAX * 1000;

export interface EmergencyCandidateRow {
  donorId: string;
  userId: string;
  bloodGroup: BloodGroup;
  isEligible: boolean;
  verificationStatus: VerificationStatus;
  isAvailable: boolean;
  emergencyResponseEnabled: boolean;
  emergencyRadiusKm: number;
  distanceMeters: number;
}

/**
 * Pure hard-filter for emergency-response candidates.
 * Does NOT require is_available — that is the Phase 6 difference from Phase 4.
 * Reuses isCompatible; does not alter the Phase 4 matrix.
 */
export function passesEmergencyCandidateCriteria(
  candidate: EmergencyCandidateRow,
  recipientBloodGroup: BloodGroup,
  requesterId: string
): boolean {
  if (!candidate.emergencyResponseEnabled) return false;
  if (!candidate.isEligible) return false;
  if (candidate.verificationStatus === "REJECTED") return false;
  if (!isCompatible(candidate.bloodGroup, recipientBloodGroup)) return false;
  if (candidate.userId === requesterId) return false;
  if (!(candidate.distanceMeters >= 0) || Number.isNaN(candidate.distanceMeters)) return false;

  const radiusMeters = candidate.emergencyRadiusKm * 1000;
  if (candidate.distanceMeters > radiusMeters) return false;
  if (
    candidate.emergencyRadiusKm < EMERGENCY_RADIUS_KM_MIN ||
    candidate.emergencyRadiusKm > EMERGENCY_RADIUS_KM_MAX
  ) {
    return false;
  }

  return true;
}

export function isValidEmergencyRadiusKm(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= EMERGENCY_RADIUS_KM_MIN &&
    value <= EMERGENCY_RADIUS_KM_MAX
  );
}
