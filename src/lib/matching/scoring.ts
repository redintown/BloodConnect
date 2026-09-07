import type { VerificationStatus } from "@/lib/constants/verification";

/**
 * Isolated, deterministic matching score weights.
 *
 * score =
 *   DISTANCE_WEIGHT / (1 + distanceKm)
 *   + verificationBoost
 *   + nightBoost
 *
 * Distance dominates. Verification and night are smaller additive boosts.
 */
export const MATCH_SCORE_WEIGHTS = {
  /** Strongest factor: closer donors score higher. */
  DISTANCE_WEIGHT: 100,
  /** VERIFIED donors. */
  VERIFICATION_VERIFIED: 15,
  /** PENDING verification. */
  VERIFICATION_PENDING: 8,
  /** UNVERIFIED donors (still eligible). */
  VERIFICATION_UNVERIFIED: 0,
  /** Applied only when request required_by is in the night window and donor is night-available. */
  NIGHT_AVAILABILITY: 10,
} as const;

export const MATCH_SEARCH_RADII_METERS = [5_000, 15_000, 30_000] as const;
export const MATCH_MAX_CANDIDATES = 20;

/** Night window for required_by (UTC hours), per project datetime convention. */
export const NIGHT_WINDOW_UTC = { startHourInclusive: 20, endHourExclusive: 6 } as const;

export function isNightRequiredBy(requiredBy: string | null | undefined): boolean {
  if (!requiredBy) return false;
  const date = new Date(requiredBy);
  if (Number.isNaN(date.getTime())) return false;
  const hour = date.getUTCHours();
  return hour >= NIGHT_WINDOW_UTC.startHourInclusive || hour < NIGHT_WINDOW_UTC.endHourExclusive;
}

export function verificationBoost(status: VerificationStatus): number {
  switch (status) {
    case "VERIFIED":
      return MATCH_SCORE_WEIGHTS.VERIFICATION_VERIFIED;
    case "PENDING":
      return MATCH_SCORE_WEIGHTS.VERIFICATION_PENDING;
    case "UNVERIFIED":
      return MATCH_SCORE_WEIGHTS.VERIFICATION_UNVERIFIED;
    case "REJECTED":
      return Number.NEGATIVE_INFINITY;
    default:
      return MATCH_SCORE_WEIGHTS.VERIFICATION_UNVERIFIED;
  }
}

export function scoreMatchCandidate(input: {
  distanceMeters: number;
  verificationStatus: VerificationStatus;
  isAvailableAtNight: boolean;
  requestRequiredBy: string | null | undefined;
}): number {
  const distanceKm = Math.max(0, input.distanceMeters) / 1000;
  const distanceScore = MATCH_SCORE_WEIGHTS.DISTANCE_WEIGHT / (1 + distanceKm);
  const verification = verificationBoost(input.verificationStatus);
  const night =
    isNightRequiredBy(input.requestRequiredBy) && input.isAvailableAtNight
      ? MATCH_SCORE_WEIGHTS.NIGHT_AVAILABILITY
      : 0;
  return distanceScore + verification + night;
}
