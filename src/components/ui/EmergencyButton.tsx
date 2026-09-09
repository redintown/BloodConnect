import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * The single most important control in the app (Section 10 of the brief):
 * a requester in a night-time emergency must be able to find and tap this
 * without hunting for it. Large, high-contrast, always the same label.
 *
 * @deprecated Migrate to `<Button variant="emergency" size="lg">` wrapped in
 * a Link when the landing page is redesigned (Phase 11C). Kept as-is here to
 * avoid changing the landing page during foundation work; the decorative
 * shadow was dropped because elevation is now reserved for floating layers.
 */
export function EmergencyButton({ className }: { className?: string }) {
  return (
    <Link
      href="/request-blood"
      className={cn(
        "flex w-full items-center justify-center rounded-md bg-emergency px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-emergency-hover active:scale-[0.99]",
        className
      )}
    >
      NEED BLOOD NOW
    </Link>
  );
}
