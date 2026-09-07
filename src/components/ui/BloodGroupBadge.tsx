import { BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import { cn } from "@/lib/utils/cn";

export function BloodGroupBadge({ bloodGroup, className }: { bloodGroup: BloodGroup; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-emergency/10 px-2.5 py-1 text-sm font-bold text-emergency",
        className
      )}
    >
      {BLOOD_GROUP_LABELS[bloodGroup]}
    </span>
  );
}
