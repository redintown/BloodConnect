/**
 * Display helpers for Phase 8D public blood search.
 * Keep free of server-only so UI and unit tests can share them.
 */

export function formatRelativeInventoryFreshness(
  inventoryUpdatedAt: string | null,
  now: Date = new Date()
): string | null {
  if (!inventoryUpdatedAt) return null;
  const updated = new Date(inventoryUpdatedAt);
  if (Number.isNaN(updated.getTime())) return null;

  const diffMs = Math.max(0, now.getTime() - updated.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Stock updated just now";
  if (minutes < 60) {
    return `Stock updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `Stock updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  return `Stock updated ${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatCoarseDistance(distanceKmRounded: number): string {
  const km = Math.max(1, Math.ceil(distanceKmRounded));
  return `${km} km away`;
}
