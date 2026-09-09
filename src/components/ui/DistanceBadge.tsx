export function DistanceBadge({ distanceKm }: { distanceKm: number | null }) {
  if (distanceKm == null) {
    return <span className="text-xs text-gray-400">Distance unknown</span>;
  }

  // distanceKm is a coarse band (Phase 10A) — never render meter precision.
  const label =
    distanceKm <= 1 ? "Within 1 km" : `Within ${Math.round(distanceKm)} km`;

  return <span className="text-xs text-gray-500">{label}</span>;
}
