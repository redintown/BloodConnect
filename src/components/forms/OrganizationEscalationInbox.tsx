import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DistanceBadge } from "@/components/ui/DistanceBadge";
import {
  StatusChip,
  ESCALATION_STATUS_LABELS,
  ESCALATION_LEVEL_LABELS,
} from "@/components/ui/StatusChip";
import { OrgEscalationResponseButtons } from "@/components/forms/OrgEscalationResponseButtons";
import { requireRole } from "@/services/authService";
import { escalationService } from "@/services/escalationService";
import { inventoryService } from "@/services/inventoryService";
import { formatOwnInventoryHint, unitsForBloodGroup } from "@/lib/inventory/hints";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import type { RequestUrgency } from "@/lib/constants/requestStatus";
import type { EmergencyEvent, EmergencyEventTarget } from "@/types/domain";
import type { OrganizationType } from "@/lib/escalation/constants";
import { cn } from "@/lib/utils/cn";

const URGENCY_LABELS: Record<RequestUrgency, string> = {
  CRITICAL: "Critical urgency",
  HIGH: "High urgency",
  MODERATE: "Moderate urgency",
};

interface InboxRequest {
  id: string;
  bloodGroup: string;
  quantityUnits: number;
  urgency: RequestUrgency;
  isEmergency: boolean;
  requiredBy: string | null;
  hospitalNameFreeform: string | null;
  status: string;
}

/**
 * One escalation record — presentation only.
 *
 * Fields shown are exactly what `listInboxForOrganization` already
 * returns: no UUIDs, no donor or requester contact data, no raw
 * coordinates (distance is already a coarse band from the service). The
 * "still open" gate below (`event.status === "OPEN"`) is the same gate
 * the previous UI used to decide whether to show response buttons — this
 * does not add a new eligibility rule.
 */
function EscalationCard({
  target,
  event,
  request,
  unitsAvailable,
}: {
  target: EmergencyEventTarget;
  event: EmergencyEvent;
  request: InboxRequest;
  unitsAvailable: number;
}) {
  const bloodGroup = request.bloodGroup as BloodGroup;
  const bloodGroupLabel = BLOOD_GROUP_LABELS[bloodGroup] ?? bloodGroup;
  const eventOpen = event.status === "OPEN";

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-surface p-4",
        request.isEmergency ? "border-emergency/30" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-body-strong text-text">
            {bloodGroupLabel}
          </span>
          {request.isEmergency && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-emergency/25 bg-emergency-surface px-2 py-0.5 text-caption font-medium text-emergency">
              <Icon name="alert-triangle" className="h-3.5 w-3.5" />
              Emergency
            </span>
          )}
        </div>

        {eventOpen ? (
          <StatusChip kind="escalation" value={target.status} />
        ) : (
          <StatusChip kind="escalation" value={event.status} level={event.level} />
        )}
      </div>

      <dl className="grid gap-2 text-body text-text">
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Units requested</dt>
          <dd className="text-body-strong tabular-nums">{request.quantityUnits}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Urgency</dt>
          <dd className="text-body-strong">{URGENCY_LABELS[request.urgency]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Hospital / site</dt>
          <dd className="max-w-[60%] text-right text-body-strong">
            {request.hospitalNameFreeform ?? "Not specified"}
          </dd>
        </div>
        {request.requiredBy && (
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Needed by</dt>
            <dd className="text-right text-body-strong">
              {new Date(request.requiredBy).toLocaleString()}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Approx. distance</dt>
          <dd>
            <DistanceBadge
              distanceKm={target.distanceMeters != null ? target.distanceMeters / 1000 : null}
            />
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Escalation level</dt>
          <dd className="text-right text-body-strong">{ESCALATION_LEVEL_LABELS[event.level]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Your inventory</dt>
          <dd className="max-w-[65%] text-right text-body-strong">
            {formatOwnInventoryHint(bloodGroup, unitsAvailable)}
          </dd>
        </div>
      </dl>

      <p className="text-caption text-text-tertiary">
        Inventory is a hint only — not a reservation. Can Supply does not change stock. Donor
        contact details are never shown here.
      </p>

      {eventOpen ? (
        <OrgEscalationResponseButtons targetId={target.id} currentStatus={target.status} />
      ) : (
        <p className="text-body text-text-secondary">
          Response on file: {ESCALATION_STATUS_LABELS[target.status]}
        </p>
      )}
    </article>
  );
}

/**
 * Escalation inbox — presentation only.
 *
 * Data contract unchanged: `escalationService.listInboxForOrganization`
 * and one `inventoryService.getOwnUnitsByBloodGroupMap` read per page load
 * (no N+1, exact counts stay own-org only). Grouping below is a
 * presentation split of fields the service already returns
 * (`event.status`, `target.status`) — it does not add a new status,
 * calculation, or filter.
 */
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

  const homeHref = organizationType === "HOSPITAL" ? "/hospital" : "/blood-bank";

  // Presentation-only split of the existing fields — same OPEN/PENDING
  // values the previous UI already read to decide whether to show buttons.
  const needsAttention = inbox.filter(
    ({ event, target }) => event.status === "OPEN" && target.status === "PENDING"
  );
  const inProgress = inbox.filter(
    ({ event, target }) => event.status === "OPEN" && target.status !== "PENDING"
  );
  const resolved = inbox.filter(({ event }) => event.status !== "OPEN");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Escalated requests"
        description="Emergency requests escalated to your organization. Respond when you can help — donor and requester contact details are never shown here."
      />

      {inbox.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No escalated requests"
          description="Emergency requests escalated to your organization will appear here. This does not mean no emergencies exist elsewhere."
          action={
            <Link href={homeHref} className={buttonClassName({ variant: "secondary", size: "sm" })}>
              Back to dashboard
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {needsAttention.length > 0 && (
            <section aria-labelledby="escalation-attention-heading" className="flex flex-col gap-3">
              <SectionHeader
                id="escalation-attention-heading"
                title="Needs attention"
                description="Acknowledge, indicate whether you can supply, or decline."
                count={needsAttention.length}
              />
              {needsAttention.map(({ target, event, request }) => (
                <EscalationCard
                  key={target.id}
                  target={target}
                  event={event}
                  request={request}
                  unitsAvailable={unitsForBloodGroup(unitsByGroup, request.bloodGroup)}
                />
              ))}
            </section>
          )}

          {inProgress.length > 0 && (
            <section aria-labelledby="escalation-progress-heading" className="flex flex-col gap-3">
              <SectionHeader
                id="escalation-progress-heading"
                title="Active / in progress"
                description="You already responded. The escalation is still open."
                count={inProgress.length}
              />
              {inProgress.map(({ target, event, request }) => (
                <EscalationCard
                  key={target.id}
                  target={target}
                  event={event}
                  request={request}
                  unitsAvailable={unitsForBloodGroup(unitsByGroup, request.bloodGroup)}
                />
              ))}
            </section>
          )}

          {resolved.length > 0 && (
            <section aria-labelledby="escalation-resolved-heading" className="flex flex-col gap-3">
              <SectionHeader
                id="escalation-resolved-heading"
                title="Resolved / past"
                description="These escalations are closed and no longer need action."
                count={resolved.length}
              />
              {resolved.map(({ target, event, request }) => (
                <EscalationCard
                  key={target.id}
                  target={target}
                  event={event}
                  request={request}
                  unitsAvailable={unitsForBloodGroup(unitsByGroup, request.bloodGroup)}
                />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
