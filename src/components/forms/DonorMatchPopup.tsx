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
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { EmergencyBadge } from "@/components/ui/EmergencyBadge";
import { DistanceBadge } from "@/components/ui/DistanceBadge";
import {
  canMarkDonorOnTheWay,
  sortDonorMatchesByPopupPriority,
} from "@/lib/matches/responseRules";
import { BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";
import type { DonorInboxMatch } from "@/types/domain";

type LocalPhase = "actionable" | "accepted" | "on_the_way";
type PopupMode = "normal" | "emergency";

/**
 * Presentation-only donor portal overlay. Accept/Decline/On-the-way call the
 * existing Phase 5 server actions — no duplicate acceptance workflow.
 * mode=emergency is visual + copy only; YES/NO still reuse accept/decline.
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

  useEffect(() => {
    if (!open || !current?.request.isEmergency || !current.emergencyNotificationId) return;
    const id = current.emergencyNotificationId;
    if (markedRead.current.has(id)) return;
    markedRead.current.add(id);
    void markNotificationReadAction(id);
  }, [open, current?.emergencyNotificationId, current?.request.isEmergency]);

  if (!open) return null;
  if (!current) return null;

  const hasOthers = queue.length > 1;
  const distanceKm =
    current.distanceMeters != null ? current.distanceMeters / 1000 : null;
  const isEmergency = mode === "emergency";

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
    if (!current) return;
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
    if (!current) return;
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
    if (!acceptedItem) return;
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

  const showOnTheWay =
    phase === "accepted" &&
    acceptedItem &&
    canMarkDonorOnTheWay(acceptedItem.request.status, acceptedItem.matchStatus);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donor-match-popup-title"
      data-popup-mode={mode}
    >
      <div
        className={`flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border-2 bg-white shadow-2xl ${
          isEmergency ? "border-red-700" : "border-emergency"
        }`}
      >
        <div className={`px-5 py-4 text-white ${isEmergency ? "bg-red-800" : "bg-emergency"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
            {isEmergency ? "Emergency blood request" : "Blood request waiting"}
          </p>
          <h2 id="donor-match-popup-title" className="mt-1 text-xl font-bold">
            {phase === "actionable"
              ? isEmergency
                ? `${BLOOD_GROUP_LABELS[current.request.bloodGroup]} blood urgently needed`
                : "A nearby patient needs your blood type"
              : phase === "accepted"
                ? "You accepted — next step"
                : "You are on the way"}
          </h2>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <BloodGroupBadge bloodGroup={current.request.bloodGroup} />
            <EmergencyBadge urgency={current.request.urgency} />
            {isEmergency && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                EMERGENCY RESPONSE
              </span>
            )}
            {phase === "accepted" && (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                ACCEPTED
              </span>
            )}
            {phase === "on_the_way" && (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                DONOR_ON_THE_WAY
              </span>
            )}
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Units needed</dt>
              <dd className="font-semibold text-gray-900">{current.request.quantityUnits}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Hospital</dt>
              <dd className="max-w-[60%] text-right font-semibold text-gray-900">
                {current.request.hospitalNameFreeform ?? "Listed on request"}
              </dd>
            </div>
            {current.request.requiredBy && (
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <dt className="text-gray-500">Needed by</dt>
                <dd className="text-right font-semibold text-gray-900">
                  {new Date(current.request.requiredBy).toLocaleString()}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Approx. distance</dt>
              <dd>
                <DistanceBadge distanceKm={distanceKm} />
              </dd>
            </div>
          </dl>

          <p className="text-xs text-gray-500">
            Requester contact is shared only after you accept. Exact donor location is never shown.
            Closing this dialog does not decline the request.
          </p>

          {phase === "actionable" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onAccept}
                disabled={loading !== null}
                className={`w-full rounded-xl px-4 py-3.5 text-base font-bold text-white disabled:opacity-60 ${
                  isEmergency
                    ? "bg-red-800 hover:bg-red-900"
                    : "bg-emergency hover:bg-emergency-hover"
                }`}
              >
                {loading === "accept"
                  ? "Accepting…"
                  : isEmergency
                    ? "YES, I CAN HELP"
                    : "Accept"}
              </button>
              <button
                type="button"
                onClick={onDecline}
                disabled={loading !== null}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {loading === "decline"
                  ? "Declining…"
                  : isEmergency
                    ? "NO, I CANNOT"
                    : "Decline"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                disabled={loading !== null}
                className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-60"
              >
                Maybe later
              </button>
            </div>
          )}

          {showOnTheWay && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onMarkOnTheWay}
                disabled={loading !== null}
                className="w-full rounded-xl bg-emergency px-4 py-3.5 text-base font-bold text-white hover:bg-emergency-hover disabled:opacity-60"
              >
                {loading === "way" ? "Updating…" : "Mark as On the Way"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                disabled={loading !== null}
                className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-60"
              >
                Close
              </button>
            </div>
          )}

          {phase === "on_the_way" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-green-700">
                Status updated to on the way. The requester can confirm when the donation is received.
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          )}

          {phase === "actionable" && hasOthers && (
            <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500">
                {queue.length} pending requests · showing {Math.min(index + 1, queue.length)} of{" "}
                {queue.length}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading !== null || index <= 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={loading !== null || index >= queue.length - 1}
                  onClick={() => setIndex((i) => Math.min(queue.length - 1, i + 1))}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
              <Link
                href="/donor/requests"
                className="text-center text-sm font-medium text-emergency hover:text-emergency-hover"
              >
                View other requests
              </Link>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
