/**
 * Public site URL helpers (Phase 10B).
 * Production must never silently fall back to localhost.
 *
 * Enforcement triggers when:
 * - VERCEL_ENV=production (set automatically on Vercel production), or
 * - BLOODCONNECT_ENV=production (for non-Vercel hosts).
 *
 * Local `next build` uses NODE_ENV=production but typically neither of the
 * above — localhost default remains allowed for local builds.
 */

function isLocalhostUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1|::1/i.test(value);
  }
}

function mustEnforcePublicSiteUrl(): boolean {
  return (
    process.env.VERCEL_ENV === "production" || process.env.BLOODCONNECT_ENV === "production"
  );
}

/**
 * Resolves the public site origin.
 * - Local / preview: documented localhost default when unset.
 * - Production (see mustEnforcePublicSiteUrl): NEXT_PUBLIC_SITE_URL required
 *   and must not be localhost.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (mustEnforcePublicSiteUrl()) {
    if (!raw) {
      throw new Error(
        "Missing required environment variable: NEXT_PUBLIC_SITE_URL. Set the public production origin (not localhost)."
      );
    }
    if (isLocalhostUrl(raw)) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL must not be localhost or a loopback address in production."
      );
    }
    return raw.replace(/\/$/, "");
  }

  return (raw && raw.length > 0 ? raw : "http://localhost:3000").replace(/\/$/, "");
}

export const siteConfig = {
  name: "BloodConnect",
  description: "Find a compatible blood donor fast, day or night.",
  get url() {
    return getSiteUrl();
  },
};
