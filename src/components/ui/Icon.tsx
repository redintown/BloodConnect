import { cn } from "@/lib/utils/cn";

/**
 * Minimal inline icon set (no icon library dependency).
 *
 * Icons are decorative by default (aria-hidden) because every primitive in
 * this system pairs an icon with a text label — status and meaning must never
 * depend on the glyph alone. Pass a `label` only when the icon is the sole
 * carrier of meaning.
 */
const PATHS = {
  home: "M3 10.5 12 3l9 7.5M5.25 9.75V20a1 1 0 0 0 1 1h11.5a1 1 0 0 0 1-1V9.75",
  droplet: "M12 3.5c3 3.6 5.5 6.4 5.5 9.4a5.5 5.5 0 0 1-11 0c0-3 2.5-5.8 5.5-9.4Z",
  inbox:
    "M4 13.5V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7.5M4 13.5h4l1.5 2.5h5L16 13.5h4M4 13.5V18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.5",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  clipboard:
    "M9 4.5h6M9 4.5a1.5 1.5 0 0 0-1.5 1.5H6.5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1A1.5 1.5 0 0 0 15 4.5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0",
  building:
    "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 21V10h4a1 1 0 0 1 1 1v10M4 21h17M8 8h3M8 12h3M8 16h3",
  boxes:
    "M4 8.5 12 4.5l8 4M4 8.5V16l8 4 8-4V8.5M4 8.5 12 12.5l8-4M12 12.5V20.5",
  bell: "M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10ZM10 19a2 2 0 0 0 4 0",
  shield: "M12 3.5 5.5 6v6c0 4 3 7 6.5 8.5 3.5-1.5 6.5-4.5 6.5-8.5V6L12 3.5Z",
  check: "M4.5 12.5l5 5 10-11",
  lock: "M6.5 10.5V8a5.5 5.5 0 0 1 11 0v2.5M5.5 10.5h13a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
  "alert-triangle": "M12 4.5 2.5 20h19L12 4.5ZM12 10v4.5M12 17.5h.01",
  "alert-circle": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8v5M12 16h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  x: "M6 6l12 12M18 6 6 18",
  "chevron-left": "M14.5 5.5 8 12l6.5 6.5",
  "chevron-right": "M9.5 5.5 16 12l-6.5 6.5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16 16l4.5 4.5",
  plus: "M12 5.5v13M5.5 12h13",
  spinner: "M12 3.5a8.5 8.5 0 1 0 8.5 8.5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  label,
  className,
}: {
  name: IconName;
  /** Only pass when no adjacent text conveys the same meaning. */
  label?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Spinner used by loading states. Opts back into motion under reduced-motion. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={cn("h-4 w-4 shrink-0 animate-spin", className)}
      aria-hidden
      data-allow-motion
    >
      <path d={PATHS.spinner} />
    </svg>
  );
}
