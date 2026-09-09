/**
 * Client-facing donor distance privacy (Phase 10A / H3).
 * Internal matching/ranking may still use exact meters.
 * Only expose coarse distance bands to clients.
 */

export const DONOR_DISTANCE_BANDS_KM = [1, 2, 5, 10, 15, 30] as const;
export type DonorDistanceBandKm = (typeof DONOR_DISTANCE_BANDS_KM)[number];

/**
 * Maps exact meters to a coarse band in kilometers.
 * Examples: 400m → 1, 3.2km → 5, 12km → 15, 40km → 30 (cap).
 */
export function toCoarseDistanceBandKm(distanceMeters: number): DonorDistanceBandKm {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return 1;
  }
  const km = distanceMeters / 1000;
  for (const band of DONOR_DISTANCE_BANDS_KM) {
    if (km <= band) return band;
  }
  return 30;
}

export function formatDonorDistanceBandLabel(bandKm: number): string {
  if (bandKm <= 1) return "Within 1 km";
  return `Within ${Math.ceil(bandKm)} km`;
}
