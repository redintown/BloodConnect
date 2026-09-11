import Link from "next/link";
import { StatusChip } from "@/components/ui/StatusChip";
import { Icon } from "@/components/ui/Icon";
import { BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";
import { STATUS_LABELS, type RequestUrgency } from "@/lib/constants/requestStatus";
import type { BloodRequest } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const URGENCY_LABELS: Record<RequestUrgency, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MODERATE: "Moderate",
};

/**
 * Presentation-only list row for requester home (`/requests`).
 * Links to existing `/requests/[id]`. No actions beyond view.
 */
export function RequesterRequestListCard({ request }: { request: BloodRequest }) {
  const updatedLabel = new Date(request.updatedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Link
      href={`/requests/${request.id}`}
      className={cn(
        "flex min-h-control flex-col gap-2 rounded-lg border bg-surface p-4 transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1",
        request.isEmergency ? "border-emergency/25" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-body-strong text-text">
            {BLOOD_GROUP_LABELS[request.bloodGroup]}
          </span>
          <span className="text-caption text-text-secondary">
            {request.quantityUnits} unit{request.quantityUnits === 1 ? "" : "s"}
          </span>
          {request.isEmergency && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-emergency/25 bg-emergency-surface px-2 py-0.5 text-caption font-medium text-emergency">
              <Icon name="alert-triangle" className="h-3.5 w-3.5" />
              Emergency request
            </span>
          )}
        </div>
        <StatusChip kind="request" value={request.status} />
      </div>

      <dl className="grid gap-1 text-caption text-text-secondary sm:grid-cols-2">
        <div className="flex flex-wrap gap-x-1">
          <dt className="sr-only">Hospital</dt>
          <dd>{request.hospitalNameFreeform ?? "Hospital listed on request"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1">
          <dt className="sr-only">Urgency</dt>
          <dd>{URGENCY_LABELS[request.urgency]}</dd>
        </div>
        {request.requiredBy && (
          <div className="flex flex-wrap gap-x-1 sm:col-span-2">
            <dt>Needed by</dt>
            <dd className="text-text">{new Date(request.requiredBy).toLocaleString()}</dd>
          </div>
        )}
        <div className="flex flex-wrap gap-x-1 sm:col-span-2">
          <dt>Updated</dt>
          <dd className="text-text">{updatedLabel}</dd>
        </div>
      </dl>

      <p className="text-caption text-text-tertiary">
        {STATUS_LABELS[request.status]} · View request
      </p>
    </Link>
  );
}
