import type { IconName } from "@/components/ui/Icon";

/**
 * Navigation contract consumed by MobileNav and DesktopNav.
 *
 * Deliberately data-only: no role logic, no route lists and no counts live
 * here. Role-specific navigation is defined in the later Phase 11 sub-phases
 * that own those routes, so this foundation cannot hard-code destinations
 * for screens that have not been redesigned yet.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /**
   * Match this route only exactly, not as a path prefix. Use for section
   * roots that would otherwise stay active on every child route.
   */
  exact?: boolean;
  /**
   * Optional pending-work counter (verification queue, escalation inbox).
   * Only ever populate from real data — never render a placeholder number.
   */
  count?: number;
  /** Announced alongside the count, e.g. "escalations awaiting response". */
  countLabel?: string;
}

export interface NavSection {
  /** Optional rail grouping label; not shown in the mobile bar. */
  title?: string;
  items: NavItem[];
}

/**
 * Active-route resolution shared by both navigations so mobile and desktop
 * can never disagree about where the user is.
 *
 * A non-exact item matches its own path and any child path, but never a
 * sibling that merely shares a prefix ("/donor" must not match "/donors").
 */
export function isNavItemActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  if (item.exact) return pathname === item.href;
  if (pathname === item.href) return true;
  return pathname.startsWith(`${item.href}/`);
}

/** Flattens sections for the mobile bar, which is a single flat row. */
export function flattenNavSections(sections: NavSection[]): NavItem[] {
  return sections.flatMap((section) => section.items);
}
