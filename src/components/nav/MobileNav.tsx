"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { isNavItemActive, type NavItem } from "@/components/nav/navConfig";

/**
 * Fixed bottom navigation for mobile (<640px). Hidden from `sm` up, where
 * DesktopNav takes over.
 *
 * UX rules:
 *  - 3 to 5 destinations. More than five makes targets too small to hit;
 *  - each target is at least 56px tall and respects the iOS safe area;
 *  - the active item is marked by icon, label weight, colour AND
 *    aria-current — never by colour alone;
 *  - AppShell reserves the matching bottom padding so the bar never covers
 *    page content or a sticky action.
 */
export function MobileNav({
  items,
  ariaLabel = "Main",
}: {
  items: NavItem[];
  ariaLabel?: string;
}) {
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-safe shadow-sm sm:hidden"
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-nav flex-col items-center justify-center gap-1 px-1 py-2 text-caption",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info",
                  active ? "font-medium text-text" : "text-text-tertiary"
                )}
              >
                <span className="relative">
                  <Icon name={item.icon} className={cn("h-6 w-6", active && "text-primary")} />
                  {typeof item.count === "number" && item.count > 0 && (
                    <span className="absolute -right-2 -top-1 min-w-[18px] rounded-pill bg-emergency px-1 text-center text-[10px] font-semibold leading-[18px] text-white tabular-nums">
                      {item.count > 99 ? "99+" : item.count}
                      <span className="sr-only"> {item.countLabel ?? "items need attention"}</span>
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
