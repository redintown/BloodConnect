/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Kept minimal on purpose. PWA service-worker registration is added in
  // Phase 10 (production hardening) once the core workflows are stable —
  // shipping an aggressive cache strategy early risks serving stale
  // emergency-request UI to donors.
};

export default nextConfig;
