import { cn } from "@/lib/utils/cn";
import { Icon } from "@/components/ui/Icon";

/**
 * Screen-level emergency context.
 *
 * UX rules (these are the point of the component — do not work around them):
 *  - MAXIMUM ONE per screen. Repeated banners destroy the signal.
 *  - The page background never turns red; only this banner carries the tint.
 *  - No flashing, pulsing or attention animation of any kind.
 *  - Pair with at most one emergency-variant button on the same screen.
 *
 * Prominence comes from the left accent edge, the surface tint and placement
 * at the top of the content region — not from motion or elevation.
 */
export function EmergencyBanner({
  title,
  children,
  action,
  deadline,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  /** Pre-formatted, human deadline text, e.g. "Needed within 2 hours". */
  deadline?: string;
  className?: string;
}) {
  return (
    <section
      aria-label="Emergency"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-emergency/25 border-l-[3px] border-l-emergency",
        "bg-emergency-surface p-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex gap-3">
        <Icon name="alert-triangle" className="mt-0.5 h-5 w-5 text-emergency" />
        <div className="flex flex-col gap-1">
          <p className="text-urgent text-emergency">{title}</p>
          {children && <div className="text-body text-text-secondary">{children}</div>}
          {deadline && (
            <p className="text-label text-text-secondary tabular-nums">{deadline}</p>
          )}
        </div>
      </div>

      {action && <div className="shrink-0 sm:ml-4">{action}</div>}
    </section>
  );
}
