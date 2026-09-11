import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { RequesterRequestListCard } from "@/components/cards/RequesterRequestListCard";
import { BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";
import { STATUS_LABELS, type BloodRequestStatus, type RequestUrgency } from "@/lib/constants/requestStatus";
import { canRequesterConfirmDonation, canRunMatching } from "@/lib/requests/statusRules";
import { requireAuth } from "@/services/authService";
import { bloodRequestService } from "@/services/bloodRequestService";
import type { BloodRequest } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

/**
 * Requester home — `/requests` (there is no `/requester` or history route).
 *
 * Attention-first dashboard (Step 1) plus the complete request list from the
 * same `listForRequester` response. No extra queries, filters, or pagination.
 */

const OPEN_STATUSES = new Set<BloodRequestStatus>([
  "PENDING",
  "MATCHING",
  "DONOR_CONTACTED",
  "DONOR_ACCEPTED",
  "DONOR_ON_THE_WAY",
  "NO_MATCH_FOUND",
]);

const URGENCY_LABELS: Record<RequestUrgency, string> = {
  CRITICAL: "Critical urgency",
  HIGH: "High urgency",
  MODERATE: "Moderate urgency",
};

/** Lower number = higher dashboard priority. Presentation only. */
function attentionRank(request: BloodRequest): number {
  const open = OPEN_STATUSES.has(request.status);
  if (!open) return 1_000;

  const emergencyBoost = request.isEmergency ? 0 : 100;

  switch (request.status) {
    case "DONOR_ON_THE_WAY":
      return emergencyBoost + 0;
    case "DONOR_ACCEPTED":
      return emergencyBoost + 1;
    case "NO_MATCH_FOUND":
      return emergencyBoost + 2;
    case "MATCHING":
      return emergencyBoost + 3;
    case "DONOR_CONTACTED":
      return emergencyBoost + 4;
    case "PENDING":
      return emergencyBoost + 5;
    default:
      return emergencyBoost + 50;
  }
}

function pickAttentionRequest(requests: BloodRequest[]): BloodRequest | null {
  const open = requests.filter((r) => OPEN_STATUSES.has(r.status));
  if (open.length === 0) return null;
  return [...open].sort((a, b) => {
    const rank = attentionRank(a) - attentionRank(b);
    if (rank !== 0) return rank;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0]!;
}

function byUpdatedDesc(a: BloodRequest, b: BloodRequest): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

/** Presentation-only groups from existing status values. */
function groupRequests(requests: BloodRequest[]) {
  const active = requests.filter((r) => OPEN_STATUSES.has(r.status)).sort(byUpdatedDesc);
  const completed = requests.filter((r) => r.status === "COMPLETED").sort(byUpdatedDesc);
  const past = requests
    .filter((r) => r.status === "CANCELLED" || r.status === "EXPIRED")
    .sort(byUpdatedDesc);
  return { active, completed, past };
}

function operationalSummary(request: BloodRequest): string {
  switch (request.status) {
    case "PENDING":
      return "Request created. Open it to find nearby donors.";
    case "MATCHING":
      return "Matching is in progress. Waiting for a donor response.";
    case "DONOR_CONTACTED":
      return "A donor has been contacted about this request.";
    case "DONOR_ACCEPTED":
      return "A donor has accepted. Open the request for next steps.";
    case "DONOR_ON_THE_WAY":
      return "A donor is on the way. Confirm when the blood is received.";
    case "NO_MATCH_FOUND":
      return "No match was found. You can try matching again from the request.";
    case "COMPLETED":
      return "This request is completed.";
    case "CANCELLED":
      return "This request was cancelled.";
    case "EXPIRED":
      return "This request expired.";
    default:
      return STATUS_LABELS[request.status];
  }
}

function nextActionLabel(request: BloodRequest): string {
  if (canRequesterConfirmDonation(request.status)) return "Confirm blood received";
  if (request.status === "DONOR_ACCEPTED") return "View accepted request";
  if (canRunMatching(request.status)) {
    return request.status === "NO_MATCH_FOUND" ? "Try matching again" : "Continue request";
  }
  return "View request";
}

function RequestListGroup({
  id,
  title,
  description,
  items,
}: {
  id: string;
  title: string;
  description?: string;
  items: BloodRequest[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 id={id} className="text-label font-medium text-text-secondary">
        {title}
        <span className="ml-2 tabular-nums text-text-tertiary">({items.length})</span>
      </h3>
      {description && <p className="sr-only">{description}</p>}
      <ul className="flex flex-col gap-2" aria-labelledby={id}>
        {items.map((request) => (
          <li key={request.id}>
            <RequesterRequestListCard request={request} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function RequestsPage() {
  const user = await requireAuth();
  const requests = await bloodRequestService.listForRequester(user.id);

  const attention = pickAttentionRequest(requests);
  const openCount = requests.filter((r) => OPEN_STATUSES.has(r.status)).length;
  const { active, completed, past } = groupRequests(requests);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Your requests"
        description="Track active blood requests, see what needs attention, and create a new request when you need blood."
        action={
          <Link
            href="/request-blood"
            className={buttonClassName({
              variant: attention?.isEmergency ? "secondary" : "primary",
              size: "md",
            })}
          >
            New request
          </Link>
        }
      />

      <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="attention-heading"
          title="Needs attention"
          description={
            openCount > 0
              ? `${openCount} open request${openCount === 1 ? "" : "s"}`
              : undefined
          }
        />

        {!attention ? (
          <EmptyState
            icon="inbox"
            title="No active blood request"
            description="Create a request when you need blood. Matching uses nearby compatible donors."
            action={
              <Link
                href="/request-blood"
                className={buttonClassName({ variant: "primary", size: "md" })}
              >
                Request blood
              </Link>
            }
          />
        ) : (
          <article
            className={cn(
              "flex flex-col gap-4 rounded-lg border bg-surface p-4 sm:p-5",
              attention.isEmergency
                ? "border-emergency/30 border-l-[3px] border-l-emergency"
                : "border-border"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {attention.isEmergency && (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-emergency/25 bg-emergency-surface px-2 py-0.5 text-caption font-medium text-emergency">
                      <Icon name="alert-triangle" className="h-3.5 w-3.5" />
                      Emergency request
                    </span>
                  )}
                  <StatusChip kind="request" value={attention.status} />
                </div>
                <p className="text-blood-group text-text">
                  {BLOOD_GROUP_LABELS[attention.bloodGroup]}
                  <span className="ml-2 text-body-strong text-text-secondary">
                    · {attention.quantityUnits} unit
                    {attention.quantityUnits === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
            </div>

            <dl className="grid gap-2 text-body sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-caption text-text-secondary">Status</dt>
                <dd className="text-body-strong text-text">{STATUS_LABELS[attention.status]}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-caption text-text-secondary">Urgency</dt>
                <dd className="text-body-strong text-text">
                  {URGENCY_LABELS[attention.urgency]}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-caption text-text-secondary">Hospital</dt>
                <dd className="text-body-strong text-text">
                  {attention.hospitalNameFreeform ?? "Hospital listed on request"}
                </dd>
              </div>
              {attention.requiredBy && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-caption text-text-secondary">Needed by</dt>
                  <dd className="text-body-strong text-text">
                    {new Date(attention.requiredBy).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>

            <p className="text-body text-text-secondary">{operationalSummary(attention)}</p>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href={`/requests/${attention.id}`}
                className={buttonClassName({
                  variant: attention.isEmergency ? "emergency" : "primary",
                  size: "md",
                  className: "sm:w-auto",
                  fullWidth: true,
                })}
              >
                {nextActionLabel(attention)}
              </Link>
              {canRequesterConfirmDonation(attention.status) && (
                <p className="text-caption text-text-secondary sm:self-center">
                  Confirmation happens on the request page.
                </p>
              )}
            </div>
          </article>
        )}
      </section>

      {requests.length > 0 ? (
        <section aria-labelledby="my-requests-heading" className="flex flex-col gap-5">
          <SectionHeader
            id="my-requests-heading"
            title="My requests"
            description="Complete list from your existing requests. Open any item for detail and actions."
            count={requests.length}
          />

          <RequestListGroup
            id="active-requests-heading"
            title="Active"
            description="Open requests that are still in progress."
            items={active}
          />
          <RequestListGroup
            id="completed-requests-heading"
            title="Completed"
            description="Requests with a recorded donation."
            items={completed}
          />
          <RequestListGroup
            id="past-requests-heading"
            title="Past"
            description="Cancelled or expired requests."
            items={past}
          />
        </section>
      ) : null}
    </div>
  );
}
