import type { NavSection } from "@/components/nav/navConfig";

/**
 * Admin-portal destinations.
 *
 * Only routes that are actually implemented (fetch and render real data)
 * are in the persistent nav: `/admin`, `/admin/organizations` (org
 * verification queue), `/admin/donors` (donor verification queue),
 * `/admin/escalations` (open escalation queue).
 *
 * `/admin/users` and `/admin/requests` exist as routes but are still stubs
 * (no query, static "not available" EmptyState) — they stay off the
 * persistent nav and are linked from the dashboard instead, labelled
 * honestly. `/admin/verification` is a redirect alias to
 * `/admin/organizations`, not a separate destination.
 */
export const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/admin", label: "Home", icon: "home", exact: true },
      { href: "/admin/organizations", label: "Organizations", icon: "building" },
      { href: "/admin/donors", label: "Donors", icon: "droplet" },
      { href: "/admin/escalations", label: "Escalations", icon: "bell" },
    ],
  },
];
