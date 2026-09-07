import { cn } from "@/lib/utils/cn";

export function AvailabilityBadge({
  isAvailable,
  isAvailableAtNight,
}: {
  isAvailable: boolean;
  isAvailableAtNight?: boolean;
}) {
  const label = !isAvailable ? "Unavailable" : isAvailableAtNight ? "Available (incl. night)" : "Available";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        isAvailable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", isAvailable ? "bg-green-500" : "bg-gray-400")} />
      {label}
    </span>
  );
}
