import { STATUS_LABELS, type BloodRequestStatus } from "@/lib/constants/requestStatus";
import { cn } from "@/lib/utils/cn";

const STYLES: Partial<Record<BloodRequestStatus, string>> = {
  PENDING: "bg-gray-100 text-gray-700",
  MATCHING: "bg-blue-100 text-blue-700",
  DONOR_CONTACTED: "bg-blue-100 text-blue-700",
  DONOR_ACCEPTED: "bg-green-100 text-green-700",
  DONOR_ON_THE_WAY: "bg-green-100 text-green-700",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-500",
  EXPIRED: "bg-gray-100 text-gray-500",
  NO_MATCH_FOUND: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: BloodRequestStatus }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
