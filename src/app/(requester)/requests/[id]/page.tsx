import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatusChip } from "@/components/ui/StatusChip";
import { Icon } from "@/components/ui/Icon";
import { buttonClassName } from "@/components/ui/Button";
import { DonorCard } from "@/components/cards/DonorCard";
import { BloodRequestForm } from "@/components/forms/BloodRequestForm";
import { CancelRequestButton } from "@/components/forms/CancelRequestButton";
import { FindMatchingDonorsButton } from "@/components/forms/FindMatchingDonorsButton";
import { ConfirmDonationButton } from "@/components/forms/ConfirmDonationButton";
import { EscalateNowButton } from "@/components/forms/EscalateNowButton";
import { formatRequesterCanSupplyInventoryHint } from "@/lib/inventory/hints";
import { BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";
import {
  STATUS_LABELS,
  type RequestUrgency,
} from "@/lib/constants/requestStatus";
import {
  canRequesterCancel,
  canRequesterConfirmDonation,
  canRequesterEdit,
  canRunMatching,
} from "@/lib/requests/statusRules";
import { bloodRequestService } from "@/services/bloodRequestService";
import { matchingService } from "@/services/matchingService";
import { matchResponseService } from "@/services/matchResponseService";
import { escalationService } from "@/services/escalationService";
import { requireAuth } from "@/services/authService";
import type { BloodRequest } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const URGENCY_LABELS: Record<RequestUrgency, string> = {
  CRITICAL: "Critical urgency",
  HIGH: "High urgency",
  MODERATE: "Moderate urgency",
};

function operationalNextStep(request: BloodRequest, canConfirm: boolean, matchable: boolean): string {
  if (canConfirm) return "Confirm when the blood donation has been received.";
  if (request.status === "DONOR_ACCEPTED") {
    return "A donor accepted. They can mark themselves as on the way next.";
  }
  if (request.status === "COMPLETED") {
    return "This request is completed. Donation recorded.";
  }
  if (request.status === "CANCELLED") return "This request was cancelled.";
  if (request.status === "EXPIRED") return "This request expired.";
  if (request.status === "NO_MATCH_FOUND") {
    return "No match was found. You can try matching again.";
  }
  if (matchable) return "Find nearby compatible donors when you are ready.";
  if (request.status === "MATCHING") {
    return "Matching is in progress. Waiting for a donor response.";
  }
  return STATUS_LABELS[request.status];
}

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { matched?: string; emergency?: string };
}) {
  const user = await requireAuth();
  const request = await bloodRequestService.getById(params.id);
  if (!request) notFound();

  const editable = canRequesterEdit(request.status);
  const cancellable = canRequesterCancel(request.status);
  const matchable = canRunMatching(request.status);
  const canConfirm = canRequesterConfirmDonation(request.status);
  const matches = await matchingService.listMatchesForRequester(request.id, user.id);
  const accepted = matches.find((m) => m.matchStatus === "ACCEPTED");

  const matchedParam = searchParams?.matched;
  const justMatchedCount =
    matchedParam != null && matchedParam !== "" && !Number.isNaN(Number(matchedParam))
      ? Number(matchedParam)
      : null;
  const emergencyParam = searchParams?.emergency;
  const justEmergencyCount =
    emergencyParam != null && emergencyParam !== "" && !Number.isNaN(Number(emergencyParam))
      ? Number(emergencyParam)
      : null;

  let escalationSummary = null;
  if (request.isEmergency) {
    try {
      escalationSummary = await escalationService.getEscalationSummary(request.id, user.id);
    } catch {
      escalationSummary = null;
    }
  }

  let acceptedContact = null;
  if (accepted?.matchId) {
    try {
      acceptedContact = await matchResponseService.getAcceptedMatchContact(
        accepted.matchId,
        user.id
      );
    } catch {
      acceptedContact = null;
    }
  }

  const nextStep = operationalNextStep(request, canConfirm, matchable);

  return (
    <div className="mx-auto flex w-full max-w-form flex-col gap-8">
      <PageHeader
        title="Request"
        description="Track status, donor responses, and the next action for this blood request."
        status={<StatusChip kind="request" value={request.status} />}
        backHref="/requests"
        backLabel="My requests"
      />

      <section aria-labelledby="status-heading">
        <article
          className={cn(
            "flex flex-col gap-4 rounded-lg border bg-surface p-4 sm:p-5",
            request.isEmergency
              ? "border-emergency/30 border-l-[3px] border-l-emergency"
              : "border-border"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <SectionHeader id="status-heading" title="Current status" />
              <div className="flex flex-wrap items-center gap-2">
                {request.isEmergency && (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-emergency/25 bg-emergency-surface px-2 py-0.5 text-caption font-medium text-emergency">
                    <Icon name="alert-triangle" className="h-3.5 w-3.5" />
                    Emergency request
                  </span>
                )}
                <StatusChip kind="request" value={request.status} />
              </div>
              <p className="text-blood-group text-text">
                {BLOOD_GROUP_LABELS[request.bloodGroup]}
                <span className="ml-2 text-body-strong text-text-secondary">
                  · {request.quantityUnits} unit
                  {request.quantityUnits === 1 ? "" : "s"}
                </span>
              </p>
            </div>
          </div>

          <dl className="grid gap-3 text-body sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-caption text-text-secondary">Status</dt>
              <dd className="text-body-strong text-text">{STATUS_LABELS[request.status]}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-caption text-text-secondary">Urgency</dt>
              <dd className="text-body-strong text-text">{URGENCY_LABELS[request.urgency]}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-caption text-text-secondary">Hospital</dt>
              <dd className="text-body-strong text-text">
                {request.hospitalNameFreeform ?? "Selected hospital"}
              </dd>
            </div>
            {request.requiredBy && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-caption text-text-secondary">Needed by</dt>
                <dd className="text-body-strong text-text">
                  {new Date(request.requiredBy).toLocaleString()}
                </dd>
              </div>
            )}
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <dt className="text-caption text-text-secondary">Location</dt>
              <dd className="text-body-strong text-text">
                Set for matching
                <span className="mt-0.5 block text-caption font-normal text-text-tertiary">
                  Exact coordinates are not shown on this page. Matching uses your request
                  location privately.
                </span>
              </dd>
            </div>
          </dl>

          <p className="text-body text-text-secondary">{nextStep}</p>

          {canConfirm && <ConfirmDonationButton requestId={request.id} />}

          {request.status === "DONOR_ACCEPTED" && (
            <Alert variant="info">
              A donor accepted. They can mark themselves as on the way next.
            </Alert>
          )}

          {request.status === "COMPLETED" && (
            <Alert variant="success">This request is completed. Donation recorded.</Alert>
          )}
        </article>
      </section>

      {acceptedContact?.donor && (
        <section aria-labelledby="accepted-donor-heading" className="flex flex-col gap-3">
          <SectionHeader id="accepted-donor-heading" title="Accepted donor contact" />
          <div className="rounded-lg border border-success/20 bg-success-surface p-4">
            <p className="text-body text-text">
              <span className="text-body-strong">{acceptedContact.donor.name}</span>
              {acceptedContact.donor.phone ? ` · ${acceptedContact.donor.phone}` : ""}
            </p>
            <p className="mt-1 text-caption text-text-secondary">
              Exact donor location is never shared. Coordinate directly using this contact.
            </p>
          </div>
        </section>
      )}

      {request.isEmergency && (
        <section
          aria-labelledby="escalation-heading"
          className="flex flex-col gap-3 rounded-lg border border-emergency/25 bg-surface p-4"
        >
          <SectionHeader
            id="escalation-heading"
            title="Emergency escalation"
            description="Operational fallback to nearby hospitals and blood banks. It does not guarantee supply."
          />
          {request.status === "MATCHING" && !escalationSummary?.active && (
            <p className="text-body text-text-secondary">
              {justEmergencyCount && justEmergencyCount > 0
                ? "Emergency donors contacted. Waiting for a donor response."
                : "Finding donors…"}
            </p>
          )}
          {escalationSummary?.active && (
            <p className="text-body-strong text-emergency">
              Your request has been escalated to nearby hospitals and blood banks
              {escalationSummary.active.level === "ADMIN_INTERVENTION"
                ? " and is under admin review"
                : ""}
              .
            </p>
          )}
          {escalationSummary && (
            <ul className="grid gap-1 text-body text-text-secondary">
              <li>Organizations contacted: {escalationSummary.orgContactedCount}</li>
              <li>Acknowledged / responding: {escalationSummary.acknowledgedCount}</li>
              <li>Can supply: {escalationSummary.canSupplyCount}</li>
            </ul>
          )}
          {escalationSummary?.targets
            .filter((t) => t.status === "CAN_SUPPLY")
            .map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-success/20 bg-success-surface px-3 py-2 text-body text-text"
              >
                <p className="text-body-strong">{t.organizationName}</p>
                <p>Response: Can Supply</p>
                <p className="text-caption text-text-secondary">
                  {formatRequesterCanSupplyInventoryHint()}
                </p>
              </div>
            ))}
          {escalationSummary?.targets
            .filter((t) => t.status === "ACKNOWLEDGED")
            .map((t) => (
              <p key={t.id} className="text-body text-text-secondary">
                {t.organizationName} acknowledged the escalation.
              </p>
            ))}
          {escalationSummary?.targets
            .filter((t) => t.status === "CANNOT_HELP")
            .map((t) => (
              <p key={t.id} className="text-body text-text-tertiary">
                {t.organizationName} cannot help at this time.
              </p>
            ))}
          {escalationSummary?.canEscalateNow && <EscalateNowButton requestId={request.id} />}
        </section>
      )}

      <section aria-labelledby="matching-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="matching-heading"
          title="Matching donors"
          description="Public match summaries only. Contact details appear only after a donor accepts."
          count={matches.length > 0 ? matches.length : undefined}
        />

        {justMatchedCount != null && (
          <Alert variant={justMatchedCount === 0 ? "warning" : "success"}>
            {justMatchedCount === 0
              ? "No matching donors found nearby."
              : `Found ${justMatchedCount} matching donor${justMatchedCount === 1 ? "" : "s"}.`}
          </Alert>
        )}
        {justEmergencyCount != null && request.isEmergency && (
          <Alert variant="emergency">
            {justEmergencyCount === 0
              ? "Emergency request created. No nearby emergency-response donors contacted."
              : `Emergency request created. ${justEmergencyCount} nearby emergency-response donor${
                  justEmergencyCount === 1 ? "" : "s"
                } contacted.`}
          </Alert>
        )}

        {matchable && (
          <FindMatchingDonorsButton
            requestId={request.id}
            hasExistingMatches={matches.length > 0}
          />
        )}
        {!matchable && (
          <p className="text-body text-text-secondary">
            Matching is not available for requests with status {STATUS_LABELS[request.status]}.
          </p>
        )}

        {matches.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No matching donors found nearby"
            description="Try Find Matching Donors again later, or ask nearby donors to update availability."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {matches.map((donor) => (
              <li key={donor.matchId ?? donor.id}>
                <DonorCard donor={donor} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-caption text-text-tertiary">
          Distances are approximate. Exact donor locations are never shown. Contact details appear
          only after a donor accepts.
        </p>
      </section>

      <section aria-labelledby="details-heading" className="flex flex-col gap-3">
        <SectionHeader id="details-heading" title="Request details" />
        <dl className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-body">
          <div>
            <dt className="text-caption text-text-secondary">Contact</dt>
            <dd className="text-body-strong text-text">
              {request.contactName} · {request.contactPhone}
            </dd>
          </div>
          {request.notes && (
            <div>
              <dt className="text-caption text-text-secondary">Notes</dt>
              <dd className="text-text">{request.notes}</dd>
            </div>
          )}
          <div>
            <dt className="text-caption text-text-secondary">Created</dt>
            <dd className="text-text">{new Date(request.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      {editable && (
        <section aria-labelledby="edit-heading" className="flex flex-col gap-3">
          <SectionHeader
            id="edit-heading"
            title="Edit request"
            description="Only available while the request is still pending."
          />
          <BloodRequestForm mode="edit" request={request} />
        </section>
      )}

      {cancellable && (
        <section aria-labelledby="cancel-heading" className="flex flex-col gap-3">
          <SectionHeader id="cancel-heading" title="Cancel request" />
          <CancelRequestButton requestId={request.id} />
        </section>
      )}

      <Link
        href="/requests"
        className={cn(
          buttonClassName({ variant: "ghost", size: "sm" }),
          "w-fit gap-1 px-1 text-text-secondary"
        )}
      >
        <Icon name="chevron-left" className="h-4 w-4" />
        My requests
      </Link>
    </div>
  );
}
