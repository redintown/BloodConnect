"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";
import { isNavItemActive, type NavSection } from "@/components/nav/navConfig";

/**
 * Navigation for pointer-first viewports. One component, two behaviours:
 *  - tablet (640–1024px): horizontal top bar, scrollable if it overflows;
 *  - desktop (≥1024px): persistent left rail, 256px wide.
 *
 * Hidden below 640px, where MobileNav owns navigation.
 *
 * Section titles and count badges are only shown in the rail — the tablet
 * bar stays a single compact row. AppShell reserves the rail width.
 */
export function DesktopNav({
  sections,
  title,
  titleHref = "/",
  ariaLabel = "Main",
}: {
  sections: NavSection[];
  /** Portal name shown at the top of the rail (identity, not a CTA). */
  title?: string;
  titleHref?: string;
  ariaLabel?: string;
}) {
  const pathname = usePathname();
  const hasItems = sections.some((section) => section.items.length > 0);

  if (!hasItems) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "hidden border-border bg-surface sm:block sm:border-b",
        // Desktop: sticky rail in normal flow (not fixed), so it can never
        // overlap the global account bar or need padding compensation.
        "lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r"
      )}
    >
      {title && (
        <Link
          href={titleHref}
          className="hidden px-4 pb-2 pt-5 text-h3 text-brand lg:block"
        >
          {title}
        </Link>
      )}

      <div className="flex gap-1 overflow-x-auto px-4 py-2 lg:flex-col lg:gap-4 lg:overflow-x-visible lg:px-3 lg:py-3">
        {sections.map((section, sectionIndex) => (
          <div
            key={section.title ?? sectionIndex}
            className="flex gap-1 lg:flex-col lg:gap-0.5"
          >
            {section.title && (
              <p className="hidden px-2 pb-1 pt-2 text-caption font-medium uppercase tracking-wide text-text-tertiary lg:block">
                {section.title}
              </p>
            )}

            {section.items.map((item) => {
              const active = isNavItemActive(pathname, item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-control-desktop items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-label",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1",
                    active
                      ? "bg-muted font-semibold text-text"
                      : "text-text-secondary hover:bg-muted hover:text-text"
                  )}
                >
                  <Icon
                    name={item.icon}
                    className={cn("h-[18px] w-[18px]", active && "text-primary")}
                  />
                  {item.label}
                  {typeof item.count === "number" && item.count > 0 && (
                    <span className="ml-auto hidden rounded-pill bg-emergency px-1.5 text-caption font-semibold text-white tabular-nums lg:inline">
                      {item.count > 99 ? "99+" : item.count}
                      <span className="sr-only"> {item.countLabel ?? "items need attention"}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
