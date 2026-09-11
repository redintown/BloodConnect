import type { NavSection } from "@/components/nav/navConfig";

/**
 * Hospital-portal destinations. Only routes under (hospital):
 * `/hospital`, `/hospital/requests`, `/hospital/inventory`, `/hospital/profile`.
 */
export const HOSPITAL_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/hospital", label: "Home", icon: "home", exact: true },
      { href: "/hospital/requests", label: "Escalations", icon: "bell" },
      { href: "/hospital/inventory", label: "Inventory", icon: "boxes" },
      { href: "/hospital/profile", label: "Profile", icon: "building" },
    ],
  },
];
