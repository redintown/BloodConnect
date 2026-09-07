import { cn } from "@/lib/utils/cn";
import type { RequestUrgency } from "@/lib/constants/requestStatus";

const STYLES: Record<RequestUrgency, string> = {
  CRITICAL: "bg-emergency text-white",
  HIGH: "bg-orange-100 text-orange-800",
  MODERATE: "bg-yellow-100 text-yellow-800",
};

export function EmergencyBadge({ urgency }: { urgency: RequestUrgency }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide", STYLES[urgency])}>
      {urgency}
    </span>
  );
}
