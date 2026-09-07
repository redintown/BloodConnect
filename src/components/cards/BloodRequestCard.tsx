import Link from "next/link";
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { EmergencyBadge } from "@/components/ui/EmergencyBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { BloodRequest } from "@/types/domain";

export function BloodRequestCard({ request }: { request: BloodRequest }) {
  return (
    <Link
      href={`/requests/${request.id}`}
      className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 hover:border-emergency/40"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BloodGroupBadge bloodGroup={request.bloodGroup} />
          <EmergencyBadge urgency={request.urgency} />
        </div>
        <StatusBadge status={request.status} />
      </div>
      <p className="text-sm text-gray-600">
        {request.quantityUnits} unit{request.quantityUnits > 1 ? "s" : ""}
        {request.hospitalNameFreeform ? ` · ${request.hospitalNameFreeform}` : ""}
      </p>
    </Link>
  );
}
