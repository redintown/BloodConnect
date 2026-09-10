"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptMatchAction,
  declineMatchAction,
  markOnTheWayAction,
} from "@/app/(donor)/actions";
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { DistanceBadge } from "@/components/ui/DistanceBadge";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { StatusChip, MATCH_STATUS_LABELS } from "@/components/ui/StatusChip";
import { Icon } from "@/components/ui/Icon";
import {
  canDonorRespond,
  canMarkDonorOnTheWay,
  isActionableDonorMatch,
} from "@/lib/matches/responseRules";
import type { RequestUrgency } from "@/lib/constants/requestStatus";
import type { AcceptedMatchContact, DonorInboxMatch } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const URGENCY_LABELS: Record<RequestUrgency, string> = {
  CRITICAL: "Critical urgency",
  HIGH: "High urgency",
  MODERATE: "Moderate urgency",
};

/**
 * Donor-facing status for an inbox row. Presentation only — does not invent
 * backend statuses; it maps existing match + request fields to readable copy.
 */
function donorFacingStatusLabel(item: DonorInboxMatch): string {
  if (isActionableDonorMatch(item)) return "Needs response";
  if (item.matchStatus === "ACCEPTED") {
    if (item.request.status === "DONOR_ON_THE_WAY") return "On the way";
    if (item.request.status === "COMPLETED") return "Completed";
    return "Accepted";
  }
  return MATCH_STATUS_LABELS[item.matchStatus];
}

/**
 * Inbox card for /donor/requests.
 *
 * Actions go through existing server actions only. Contact is rendered only
 * when the page passes an authorized AcceptedMatchContact payload.
 */
export function DonorMatchActions({
  item,
  contact = null,
}: {
  item: DonorInboxMatch;
  contact?: AcceptedMatchContact | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | "way" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const respondable =
    canDonorRespond(item.matchStatus) && item.request.status === "MATCHING";
  const onTheWay = canMarkDonorOnTheWay(item.request.status, item.matchStatus);
  const isEmergency = item.request.isEmergency;
  const statusLabel = donorFacingStatusLabel(item);
  const requestContact = contact?.request;

  async function run(kind: "accept" | "decline" | "way") {
    if (loading !== null) return;
    setError(null);
    setSuccess(null);
    setLoading(kind);
    const result =
      kind === "accept"
        ? await acceptMatchAction(item.matchId)
        : kind === "decline"
          ? await declineMatchAction(item.matchId)
          : await markOnTheWayAction(item.matchId);
    setLoading(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSuccess(
      kind === "accept"
        ? "Accepted. Contact details will appear when available."
        : kind === "decline"
          ? "You declined this request."
          : "Marked as on the way."
    );
    router.refresh();
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-surface p-4",
        isEmergency ? "border-emergency/30" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <BloodGroupBadge bloodGroup={item.request.bloodGroup} />
          {isEmergency && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-emergency/25 bg-emergency-surface px-2 py-0.5 text-caption font-medium text-emergency">
              <Icon name="alert-triangle" className="h-3.5 w-3.5" />
              Emergency
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center rounded-sm border px-2 py-0.5 text-caption font-medium",
              respondable
                ? "border-info/20 bg-info-surface text-info"
                : item.matchStatus === "ACCEPTED" && item.request.status !== "COMPLETED"
                  ? "border-success/20 bg-success-surface text-success"
                  : "border-border bg-muted text-text-secondary"
            )}
          >
            {statusLabel}
          </span>
        </div>
        <StatusChip kind="request" value={item.request.status} />
      </div>

      <dl className="grid gap-2 text-body text-text">
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Units needed</dt>
          <dd className="text-body-strong tabular-nums">{item.request.quantityUnits}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Hospital</dt>
          <dd className="max-w-[60%] text-right text-body-strong">
            {item.request.hospitalNameFreeform ?? "Hospital listed on request"}
          </dd>
        </div>
        {item.request.requiredBy && (
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Needed by</dt>
            <dd className="text-right text-body-strong">
              {new Date(item.request.requiredBy).toLocaleString()}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Urgency</dt>
          <dd className="text-body-strong">{URGENCY_LABELS[item.request.urgency]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Distance</dt>
          <dd>
            <DistanceBadge distanceKm={item.distanceBandKm} />
          </dd>
        </div>
      </dl>

      {requestContact && (
        <div className="rounded-lg border border-success/20 bg-success-surface p-3">
          <p className="text-body-strong text-text">Requester contact</p>
          <p className="mt-1 text-body text-text">
            {requestContact.contactName} · {requestContact.contactPhone}
          </p>
          {requestContact.hospitalNameFreeform && (
            <p className="mt-0.5 text-caption text-text-secondary">
              {requestContact.hospitalNameFreeform}
            </p>
          )}
        </div>
      )}

      {respondable && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant={isEmergency ? "emergency" : "primary"}
            className="sm:flex-1"
            loading={loading === "accept"}
            loadingLabel="Accepting…"
            disabled={loading !== null}
            onClick={() => void run("accept")}
          >
            Accept
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="sm:flex-1"
            loading={loading === "decline"}
            loadingLabel="Declining…"
            disabled={loading !== null}
            onClick={() => void run("decline")}
          >
            Decline
          </Button>
        </div>
      )}

      {onTheWay && (
        <Button
          type="button"
          variant={isEmergency ? "emergency" : "primary"}
          fullWidth
          loading={loading === "way"}
          loadingLabel="Updating…"
          disabled={loading !== null}
          onClick={() => void run("way")}
        >
          Mark as on the way
        </Button>
      )}

      {item.matchStatus === "ACCEPTED" && item.request.status === "DONOR_ON_THE_WAY" && (
        <p className="text-body text-success">
          You are marked on the way. Waiting for the requester to confirm the donation.
        </p>
      )}

      {item.matchStatus === "ACCEPTED" && item.request.status === "COMPLETED" && (
        <p className="text-body text-success">Donation confirmed. Thank you.</p>
      )}

      {item.matchStatus === "DECLINED" && (
        <p className="text-body text-text-secondary">You declined this request.</p>
      )}

      {item.matchStatus === "EXPIRED" && (
        <p className="text-body text-text-secondary">
          Another donor was accepted for this request.
        </p>
      )}

      {error && (
        <Alert variant="danger" title="Could not update">
          {error}
        </Alert>
      )}
      {success && <Alert variant="success">{success}</Alert>}
    </article>
  );
}
