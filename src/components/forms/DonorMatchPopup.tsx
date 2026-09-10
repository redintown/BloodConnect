"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  acceptMatchAction,
  declineMatchAction,
  markOnTheWayAction,
} from "@/app/(donor)/actions";
import { markNotificationReadAction } from "@/app/(donor)/notificationActions";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icon";
import {
  canMarkDonorOnTheWay,
  sortDonorMatchesByPopupPriority,
} from "@/lib/matches/responseRules";
import { BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";
import type { RequestUrgency } from "@/lib/constants/requestStatus";
import type { DonorInboxMatch } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

type LocalPhase = "actionable" | "accepted" | "on_the_way";
type PopupMode = "normal" | "emergency";

const URGENCY_LABELS: Record<RequestUrgency, string> = {
  CRITICAL: "Critical urgency",
  HIGH: "High urgency",
  MODERATE: "Moderate urgency",
};

function formatCoarseDistance(distanceKm: number | null): string {
  if (distanceKm == null) return "Distance unknown";
  // Coarse band only — never meter precision (Phase 10A).
  return distanceKm <= 1 ? "Within 1 km" : `Within ${Math.round(distanceKm)} km`;
}

/**
 * Presentation-only donor portal overlay. Accept / Decline / On-the-way call
 * the existing Phase 5 server actions — no duplicate acceptance workflow.
 *
 * `mode=emergency` is visual + copy only; YES / NO still reuse accept/decline.
 * Contact details are not fetched here — they stay on the Requests surface
 * after acceptance, matching the existing data contract.
 */
export function DonorMatchPopup({ matches }: { matches: DonorInboxMatch[] }) {
  const router = useRouter();
  const prioritized = useMemo(() => sortDonorMatchesByPopupPriority(matches), [matches]);
  /** After "Maybe later", keep closed for this page mount only (no DB write). */
  const dismissedThisVisit = useRef(false);
  const markedRead = useRef(new Set<string>());

  const [queue, setQueue] = useState(prioritized);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(() => prioritized.length > 0);
  const [phase, setPhase] = useState<LocalPhase>("actionable");
  const [acceptedItem, setAcceptedItem] = useState<DonorInboxMatch | null>(null);
  const [loading, setLoading] = useState<"accept" | "decline" | "way" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Do not clobber the post-accept follow-up when the server list refreshes.
    if (phase !== "actionable") return;
    setQueue(prioritized);
    setIndex(0);
    // Re-open only when still actionable and donor has not chosen Maybe later this visit.
    setOpen(!dismissedThisVisit.current && prioritized.length > 0);
    setError(null);
  }, [prioritized, phase]);

  const current =
    phase === "actionable"
      ? queue[Math.min(index, Math.max(queue.length - 1, 0))] ?? null
      : acceptedItem;

  const mode: PopupMode = current?.request.isEmergency ? "emergency" : "normal";
  const isEmergency = mode === "emergency";
  const busy = loading !== null;

  useEffect(() => {
    if (!open || !current?.request.isEmergency || !current.emergencyNotificationId) return;
    const id = current.emergencyNotificationId;
    if (markedRead.current.has(id)) return;
    markedRead.current.add(id);
    void markNotificationReadAction(id);
  }, [open, current?.emergencyNotificationId, current?.request.isEmergency]);

  function dismiss() {
    // Presentation only — does not decline or change match status.
    dismissedThisVisit.current = true;
    setOpen(false);
    setError(null);
    setLoading(null);
    setPhase("actionable");
    setAcceptedItem(null);
    // Do not refresh here: refresh would remount/reopen the popup in the same visit.
  }

  async function onAccept() {
    if (!current || busy) return;
    setError(null);
    setLoading("accept");
    const result = await acceptMatchAction(current.matchId);
    setLoading(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    const nextAccepted: DonorInboxMatch = {
      ...current,
      matchStatus: "ACCEPTED",
      respondedAt: new Date().toISOString(),
      request: {
        ...current.request,
        status: "DONOR_ACCEPTED",
      },
    };
    setAcceptedItem(nextAccepted);
    setPhase("accepted");
    setQueue((prev) => prev.filter((m) => m.matchId !== current.matchId));
  }

  async function onDecline() {
    if (!current || busy) return;
    setError(null);
    setLoading("decline");
    const result = await declineMatchAction(current.matchId);
    setLoading(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    const remaining = queue.filter((m) => m.matchId !== current.matchId);
    setQueue(remaining);
    setIndex(0);
    setPhase("actionable");
    setAcceptedItem(null);
    if (remaining.length === 0) {
      setOpen(false);
    }
    router.refresh();
  }

  async function onMarkOnTheWay() {
    if (!acceptedItem || busy) return;
    setError(null);
    setLoading("way");
    const result = await markOnTheWayAction(acceptedItem.matchId);
    setLoading(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    setAcceptedItem({
      ...acceptedItem,
      request: { ...acceptedItem.request, status: "DONOR_ON_THE_WAY" },
    });
    setPhase("on_the_way");
  }

  if (!current) return null;

  const hasOthers = queue.length > 1;
  const bloodLabel = BLOOD_GROUP_LABELS[current.request.bloodGroup];
  const distanceLabel = formatCoarseDistance(current.distanceBandKm);

  const showOnTheWay =
    phase === "accepted" &&
    acceptedItem &&
    canMarkDonorOnTheWay(acceptedItem.request.status, acceptedItem.matchStatus);

  const title =
    phase === "actionable"
      ? isEmergency
        ? "Emergency request"
        : "Blood request"
      : phase === "accepted"
        ? "You accepted"
        : "You are on the way";

  const description =
    phase === "actionable"
      ? isEmergency
        ? `${bloodLabel} blood is urgently needed nearby.`
        : `A nearby patient needs ${bloodLabel} blood.`
      : phase === "accepted"
        ? "Mark when you are heading to the donation point."
        : "The requester can confirm when the donation is received.";

  const decisionFooter =
    phase === "actionable" ? (
      <div className="flex flex-col gap-2">
        {/* Equal-weight decision row: same size, side by side. Decline is
            never destructive — saying no is a legitimate choice. */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            disabled={busy}
            loading={loading === "decline"}
            loadingLabel="Declining…"
            onClick={() => void onDecline()}
            aria-label={isEmergency ? "No, I cannot help" : "Decline this request"}
          >
            {isEmergency ? "NO, I CANNOT" : "Decline"}
          </Button>
          <Button
            type="button"
            variant={isEmergency ? "emergency" : "primary"}
            size="lg"
            fullWidth
            disabled={busy}
            loading={loading === "accept"}
            loadingLabel="Accepting…"
            data-autofocus
            onClick={() => void onAccept()}
            aria-label={isEmergency ? "Yes, I can help" : "Accept this request"}
          >
            {isEmergency ? "YES, I CAN HELP" : "Accept"}
          </Button>
        </div>
        <Button type="button" variant="ghost" size="md" fullWidth disabled={busy} onClick={dismiss}>
          Maybe later
        </Button>
      </div>
    ) : showOnTheWay ? (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          disabled={busy}
          loading={loading === "way"}
          loadingLabel="Updating…"
          data-autofocus
          onClick={() => void onMarkOnTheWay()}
        >
          Mark as on the way
        </Button>
        <Button type="button" variant="ghost" size="md" fullWidth disabled={busy} onClick={dismiss}>
          Close
        </Button>
      </div>
    ) : phase === "on_the_way" ? (
      <Button type="button" variant="secondary" size="md" fullWidth data-autofocus onClick={dismiss}>
        Close
      </Button>
    ) : null;

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      title={title}
      description={description}
      dismissible={!busy}
      showCloseButton={false}
      footer={decisionFooter}
      className={cn(isEmergency && "border-l-[3px] border-l-emergency")}
    >
      {/* Mode attribute kept for existing emergency integration tests. */}
      <div data-popup-mode={mode} className="flex flex-col gap-4">
        {isEmergency && phase === "actionable" && (
          <p className="text-urgent text-emergency" role="status">
            Emergency response
          </p>
        )}

        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <p className="text-blood-group text-text">{bloodLabel}</p>
          <p className="text-label text-text-secondary">
            {URGENCY_LABELS[current.request.urgency]}
          </p>
          {phase === "accepted" && (
            <span className="inline-flex items-center rounded-sm border border-success/20 bg-success-surface px-2 py-0.5 text-caption font-medium text-success">
              Accepted
            </span>
          )}
          {phase === "on_the_way" && (
            <span className="inline-flex items-center rounded-sm border border-success/20 bg-success-surface px-2 py-0.5 text-caption font-medium text-success">
              On the way
            </span>
          )}
        </div>

        <dl className="grid gap-3 text-body">
          <div className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-text-secondary">Units needed</dt>
            <dd className="font-medium tabular-nums text-text">{current.request.quantityUnits}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border pb-2">
            <dt className="text-text-secondary">Hospital</dt>
            <dd className="max-w-[60%] text-right font-medium text-text">
              {current.request.hospitalNameFreeform ?? "Listed on request"}
            </dd>
          </div>
          {current.request.requiredBy && (
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-text-secondary">Needed by</dt>
              <dd className="text-right font-medium tabular-nums text-text">
                {new Date(current.request.requiredBy).toLocaleString()}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Approx. distance</dt>
            <dd className="font-medium text-text">{distanceLabel}</dd>
          </div>
        </dl>

        <p className="text-caption text-text-tertiary">
          Requester contact is shared only after you accept. Exact locations are never shown.
          Closing this dialog does not decline the request.
        </p>

        {phase === "accepted" && (
          <Alert variant="success" title="Request accepted">
            Open Requests if you need the requester&apos;s contact details. Then mark yourself as
            on the way when you leave.
          </Alert>
        )}

        {phase === "on_the_way" && (
          <Alert variant="success" title="Status updated">
            You are marked as on the way. The requester can confirm when the donation is received.
          </Alert>
        )}

        {phase === "actionable" && hasOthers && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-caption text-text-tertiary" aria-live="polite">
              Request {Math.min(index + 1, queue.length)} of {queue.length}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={busy || index <= 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="Previous request"
              >
                <Icon name="chevron-left" className="h-4 w-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={busy || index >= queue.length - 1}
                onClick={() => setIndex((i) => Math.min(queue.length - 1, i + 1))}
                aria-label="Next request"
              >
                Next
                <Icon name="chevron-right" className="h-4 w-4" />
              </Button>
            </div>
            <Link
              href="/donor/requests"
              className="inline-flex min-h-control items-center justify-center rounded-md px-3 text-label font-medium text-text-secondary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
            >
              View all requests
            </Link>
          </div>
        )}

        {error && (
          <Alert variant="danger" title="Could not update">
            {error}
          </Alert>
        )}
      </div>
    </BottomSheet>
  );
}
