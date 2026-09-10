import type { NavSection } from "@/components/nav/navConfig";

/**
 * Donor-portal destinations. Only routes that exist under (donor).
 *
 * Kept data-only (no role logic) so MobileNav and DesktopNav stay in sync
 * through the shared navConfig helpers. Profile sits last: the dashboard is
 * attention-first, and the mobile bar has room for at most five items.
 */
export const DONOR_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/donor", label: "Home", icon: "home", exact: true },
      { href: "/donor/requests", label: "Requests", icon: "inbox" },
      { href: "/donor/availability", label: "Availability", icon: "clock" },
      { href: "/donor/history", label: "History", icon: "clipboard" },
      { href: "/donor/profile", label: "Profile", icon: "user" },
    ],
  },
];
