import { cn } from "@/lib/utils/cn";

/**
 * Responsive layout frame for authenticated areas.
 *
 * Replaces the old global `max-w-lg` body constraint, which rendered a
 * 512px phone column on every viewport including desktop. The shell is
 * genuinely responsive instead of a centered mobile layout:
 *
 *   mobile  (<640px)   full width, 16px side padding, bottom nav
 *   tablet  (640–1024) full width, 24px padding, top nav
 *   desktop (1024+)    256px left rail + content capped at 1200px
 *   large   (1440+)    content capped at 1280px
 *
 * Slots are intentionally generic — role-specific navigation content is
 * supplied by the sub-phase that owns those routes, not by this shell.
 */
export type ShellWidth = "app" | "form" | "full";

const WIDTHS: Record<ShellWidth, string> = {
  // Dashboards, lists, tables.
  app: "max-w-shell wide:max-w-shell-wide",
  // Readable single-column forms and detail reading.
  form: "max-w-form",
  // Opt out of width capping (maps, full-bleed layouts).
  full: "max-w-none",
};

export function AppShell({
  nav,
  mobileNav,
  overlay,
  header,
  width = "app",
  children,
  className,
}: {
  /** DesktopNav — rendered as tablet top bar / desktop left rail. */
  nav?: React.ReactNode;
  /** MobileNav — fixed bottom bar below 640px. */
  mobileNav?: React.ReactNode;
  /** Portals and popups (e.g. the donor match overlay). */
  overlay?: React.ReactNode;
  /** Optional in-flow bar above the content region. */
  header?: React.ReactNode;
  width?: ShellWidth;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-dvh bg-canvas lg:flex lg:items-start", className)}>
      {/* Below lg the nav is a top bar in normal flow; at lg it becomes the
          left column of this flex row. No fixed offsets to keep in sync. */}
      {nav}

      <div className="flex min-h-dvh w-full min-w-0 flex-col">
        {header}

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full flex-1 px-4 py-4 outline-none sm:px-6 sm:py-6",
            // Clears the fixed mobile bar so content and sticky actions
            // are never hidden behind it.
            mobileNav && "pb-[calc(56px+env(safe-area-inset-bottom,0px)+16px)] sm:pb-6",
            WIDTHS[width]
          )}
        >
          {children}
        </main>
      </div>

      {mobileNav}
      {overlay}
    </div>
  );
}

/**
 * Sticky bottom action bar for long mobile forms, so the primary action is
 * always reachable without scrolling back. Sits above MobileNav.
 * One primary action only.
 */
export function StickyActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 -mx-4 mt-4 border-t border-border bg-surface/95 px-4 py-3 shadow-sm backdrop-blur-[2px]",
        "sm:-mx-6 sm:px-6",
        className
      )}
    >
      {children}
    </div>
  );
}
