/**
 * Prevents open redirects after login. Only same-origin relative paths
 * starting with a single "/" are allowed.
 */
export function getSafeRedirectPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.includes("://") || next.includes("\\")) return fallback;
  return next;
}
