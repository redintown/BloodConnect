import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { EmergencyBadge } from "@/components/ui/EmergencyBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DonorCard } from "@/components/cards/DonorCard";
import { BloodRequestForm } from "@/components/forms/BloodRequestForm";
import { CancelRequestButton } from "@/components/forms/CancelRequestButton";
import { FindMatchingDonorsButton } from "@/components/forms/FindMatchingDonorsButton";
import { ConfirmDonationButton } from "@/components/forms/ConfirmDonationButton";
import { EscalateNowButton } from "@/components/forms/EscalateNowButton";
import { STATUS_LABELS } from "@/lib/constants/requestStatus";
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

  return (
    <PageShell title="Request details">
      <div className="flex flex-wrap items-center gap-2">
        <BloodGroupBadge bloodGroup={request.bloodGroup} />
        <EmergencyBadge urgency={request.urgency} />
        {request.isEmergency && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
            EMERGENCY RESPONSE
          </span>
        )}
        <StatusBadge status={request.status} />
      </div>

      <dl className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 text-sm">
        <div>
          <dt className="text-gray-500">Status</dt>
          <dd className="font-medium text-gray-800">{STATUS_LABELS[request.status]}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Units</dt>
          <dd className="font-medium text-gray-800">{request.quantityUnits}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Hospital</dt>
          <dd className="font-medium text-gray-800">
            {request.hospitalNameFreeform ?? "Selected hospital"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Contact</dt>
          <dd className="font-medium text-gray-800">
            {request.contactName} · {request.contactPhone}
          </dd>
        </div>
        {request.requiredBy && (
          <div>
            <dt className="text-gray-500">Needed by</dt>
            <dd className="font-medium text-gray-800">
              {new Date(request.requiredBy).toLocaleString()}
            </dd>
          </div>
        )}
        {request.notes && (
          <div>
            <dt className="text-gray-500">Notes</dt>
            <dd className="font-medium text-gray-800">{request.notes}</dd>
          </div>
        )}
        <div>
          <dt className="text-gray-500">Location</dt>
          <dd className="font-medium text-gray-800">
            {request.location.latitude.toFixed(4)}, {request.location.longitude.toFixed(4)}
            <span className="mt-1 block text-xs font-normal text-gray-400">
              Exact location is visible only to you.
            </span>
          </dd>
        </div>
      </dl>

      {acceptedContact?.donor && (
        <section className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50 p-4">
          <h2 className="text-base font-semibold text-gray-800">Accepted donor contact</h2>
          <p className="text-sm text-gray-800">
            <span className="font-medium">{acceptedContact.donor.name}</span>
            {acceptedContact.donor.phone ? ` · ${acceptedContact.donor.phone}` : ""}
          </p>
          <p className="text-xs text-gray-500">
            Exact donor location is never shared. Coordinate directly using this contact.
          </p>
        </section>
      )}

      {request.status === "DONOR_ACCEPTED" && (
        <p className="text-sm text-gray-600">
          A donor accepted. They can mark themselves as on the way next.
        </p>
      )}

      {canConfirm && <ConfirmDonationButton requestId={request.id} />}

      {request.status === "COMPLETED" && (
        <p className="text-sm text-green-700">This request is completed. Donation recorded.</p>
      )}

      {request.isEmergency && (
        <section className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/40 p-4">
          <h2 className="text-base font-semibold text-gray-900">Emergency escalation</h2>
          {request.status === "MATCHING" && !escalationSummary?.active && (
            <p className="text-sm text-gray-700">
              {justEmergencyCount && justEmergencyCount > 0
                ? "Emergency donors contacted. Waiting for a donor response."
                : "Finding donors…"}
            </p>
          )}
          {escalationSummary?.active && (
            <p className="text-sm font-medium text-red-900">
              Your request has been escalated to nearby hospitals and blood banks
              {escalationSummary.active.level === "ADMIN_INTERVENTION"
                ? " and is under admin review"
                : ""}
              .
            </p>
          )}
          {escalationSummary && (
            <ul className="grid gap-1 text-sm text-gray-700">
              <li>Organizations contacted: {escalationSummary.orgContactedCount}</li>
              <li>Acknowledged / responding: {escalationSummary.acknowledgedCount}</li>
              <li>Can supply: {escalationSummary.canSupplyCount}</li>
            </ul>
          )}
          {escalationSummary?.targets
            .filter((t) => t.status === "CAN_SUPPLY")
            .map((t) => (
              <p key={t.id} className="text-sm text-green-800">
                {t.organizationName} indicated they can supply blood.
              </p>
            ))}
          {escalationSummary?.canEscalateNow && <EscalateNowButton requestId={request.id} />}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-gray-800">Matching donors</h2>
        {justMatchedCount != null && (
          <p className="text-sm text-green-700">
            {justMatchedCount === 0
              ? "No matching donors found nearby."
              : `Found ${justMatchedCount} matching donor${justMatchedCount === 1 ? "" : "s"}.`}
          </p>
        )}
        {justEmergencyCount != null && request.isEmergency && (
          <p className="text-sm text-red-800">
            {justEmergencyCount === 0
              ? "Emergency request created. No nearby emergency-response donors contacted."
              : `Emergency request created. ${justEmergencyCount} nearby emergency-response donor${
                  justEmergencyCount === 1 ? "" : "s"
                } contacted.`}
          </p>
        )}
        {matchable && (
          <FindMatchingDonorsButton
            requestId={request.id}
            hasExistingMatches={matches.length > 0}
          />
        )}
        {!matchable && (
          <p className="text-sm text-gray-500">
            Matching is not available for requests with status {STATUS_LABELS[request.status]}.
          </p>
        )}
        {matches.length === 0 ? (
          <EmptyState
            title="No matching donors found nearby"
            description="Try Find Matching Donors again later, or widen availability by asking nearby donors to update their profile."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {matches.map((donor) => (
              <div key={donor.matchId ?? donor.id} className="flex flex-col gap-1">
                <DonorCard donor={donor} />
                {donor.matchStatus && (
                  <p className="px-1 text-xs text-gray-500">Match status: {donor.matchStatus}</p>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">
          Distances are approximate. Exact donor locations are never shown. Contact details appear
          only after a donor accepts.
        </p>
      </section>

      {editable && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-800">Edit request</h2>
          <BloodRequestForm mode="edit" request={request} />
        </section>
      )}

      {cancellable && <CancelRequestButton requestId={request.id} />}

      <Link href="/requests" className="text-sm text-gray-500 hover:text-gray-800">
        ← My requests
      </Link>
    </PageShell>
  );
}
