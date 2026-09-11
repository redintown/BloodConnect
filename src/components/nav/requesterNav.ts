import type { NavSection } from "@/components/nav/navConfig";

/**
 * Requester-portal destinations. Only routes that exist under (requester):
 * `/requests`, `/request-blood`, and detail under `/requests/[id]`.
 *
 * There is no `/requester` path — role home is `/requests` (see ROLE_HOME).
 * Home uses prefix matching so request detail stays under the same nav item.
 * Cap stays at five for MobileNav.
 */
export const REQUESTER_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/requests", label: "Home", icon: "home" },
      { href: "/request-blood", label: "New request", icon: "plus" },
    ],
  },
];
