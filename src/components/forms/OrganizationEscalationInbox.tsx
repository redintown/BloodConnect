import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { DistanceBadge } from "@/components/ui/DistanceBadge";
import { OrgEscalationResponseButtons } from "@/components/forms/OrgEscalationResponseButtons";
import { requireRole } from "@/services/authService";
import { escalationService } from "@/services/escalationService";
import { inventoryService } from "@/services/inventoryService";
import {
  formatOwnInventoryHint,
  unitsForBloodGroup,
} from "@/lib/inventory/hints";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/constants/bloodGroups";
import type { OrganizationType } from "@/lib/escalation/constants";

export async function OrganizationEscalationInbox({
  organizationType,
}: {
  organizationType: OrganizationType;
}) {
  const role = organizationType === "HOSPITAL" ? "HOSPITAL" : "BLOOD_BANK";
  await requireRole(role);
  const inbox = await escalationService.listInboxForOrganization(organizationType);

  // One inventory read for the whole inbox (avoid N+1). Exact counts are own-org only.
  let unitsByGroup = new Map<BloodGroup, number>();
  try {
    unitsByGroup = await inventoryService.getOwnUnitsByBloodGroupMap(organizationType);
  } catch {
    unitsByGroup = new Map(BLOOD_GROUPS.map((group) => [group, 0]));
  }

  const title = organizationType === "HOSPITAL" ? "Escalated requests" : "Escalated requests";

  return (
    <PageShell title={title}>
      {inbox.length === 0 ? (
        <EmptyState
          title="No escalated requests"
          description="Emergency requests escalated to your organization will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {inbox.map(({ target, event, request }) => {
            const bloodGroup = request.bloodGroup as BloodGroup;
            const units = unitsForBloodGroup(unitsByGroup, bloodGroup);
            return (
              <article
                key={target.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <BloodGroupBadge bloodGroup={bloodGroup} />
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                    {event.level}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    Event {event.status}
                  </span>
                  {request.isEmergency && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                      EMERGENCY
                    </span>
                  )}
                </div>
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Units requested</dt>
                    <dd className="font-medium">{request.quantityUnits}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Urgency</dt>
                    <dd className="font-medium">{request.urgency}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Hospital / site</dt>
                    <dd className="max-w-[60%] text-right font-medium">
                      {request.hospitalNameFreeform ?? "Not specified"}
                    </dd>
                  </div>
                  {request.requiredBy && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Needed by</dt>
                      <dd className="font-medium">
                        {new Date(request.requiredBy).toLocaleString()}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Approx. distance</dt>
                    <dd>
                      <DistanceBadge
                        distanceKm={
                          target.distanceMeters != null ? target.distanceMeters / 1000 : null
                        }
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Your inventory</dt>
                    <dd className="max-w-[65%] text-right font-medium text-gray-800">
                      {formatOwnInventoryHint(bloodGroup, units)}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-gray-500">
                  Inventory is a hint only — not a reservation. Can Supply does not change stock.
                  Donor contact details are never shown here.
                </p>
                {event.status === "OPEN" ? (
                  <OrgEscalationResponseButtons
                    targetId={target.id}
                    currentStatus={target.status}
                  />
                ) : (
                  <p className="text-sm text-gray-600">Response on file: {target.status}</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
