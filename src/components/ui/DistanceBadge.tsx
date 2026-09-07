export function DistanceBadge({ distanceKm }: { distanceKm: number | null }) {
  if (distanceKm == null) {
    return <span className="text-xs text-gray-400">Distance unknown</span>;
  }

  // Deliberately coarse — see locationService / privacy notes in
  // ARCHITECTURE.md. Never render a precise distance below ~0.5km.
  const label = distanceKm < 1 ? "< 1 km away" : `~${Math.round(distanceKm)} km away`;

  return <span className="text-xs text-gray-500">{label}</span>;
}
