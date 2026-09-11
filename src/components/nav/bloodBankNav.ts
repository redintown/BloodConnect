import type { NavSection } from "@/components/nav/navConfig";

/**
 * Blood-bank portal destinations. Only routes under (blood-bank):
 * `/blood-bank`, `/blood-bank/requests`, `/blood-bank/inventory`, `/blood-bank/profile`.
 */
export const BLOOD_BANK_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/blood-bank", label: "Home", icon: "home", exact: true },
      { href: "/blood-bank/requests", label: "Escalations", icon: "bell" },
      { href: "/blood-bank/inventory", label: "Inventory", icon: "boxes" },
      { href: "/blood-bank/profile", label: "Profile", icon: "droplet" },
    ],
  },
];
