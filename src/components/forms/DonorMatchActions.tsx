"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptMatchAction,
  declineMatchAction,
  markOnTheWayAction,
} from "@/app/(donor)/actions";
import { BloodGroupBadge } from "@/components/ui/BloodGroupBadge";
import { EmergencyBadge } from "@/components/ui/EmergencyBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DistanceBadge } from "@/components/ui/DistanceBadge";
import { STATUS_LABELS } from "@/lib/constants/requestStatus";
import { canDonorRespond, canMarkDonorOnTheWay } from "@/lib/matches/responseRules";
import type { DonorInboxMatch } from "@/types/domain";

export function DonorMatchActions({ item }: { item: DonorInboxMatch }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | "way" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respondable =
    canDonorRespond(item.matchStatus) && item.request.status === "MATCHING";
  const onTheWay =
    canMarkDonorOnTheWay(item.request.status, item.matchStatus);

  async function run(kind: "accept" | "decline" | "way") {
    setError(null);
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
    router.refresh();
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <BloodGroupBadge bloodGroup={item.request.bloodGroup} />
        <EmergencyBadge urgency={item.request.urgency} />
        <StatusBadge status={item.request.status} />
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          Match: {item.matchStatus}
        </span>
      </div>

      <dl className="grid gap-2 text-sm text-gray-700">
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Units needed</dt>
          <dd className="font-medium">{item.request.quantityUnits}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Hospital</dt>
          <dd className="font-medium text-right">
            {item.request.hospitalNameFreeform ?? "Hospital listed on request"}
          </dd>
        </div>
        {item.request.requiredBy && (
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Needed by</dt>
            <dd className="font-medium">{new Date(item.request.requiredBy).toLocaleString()}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Distance</dt>
          <dd>
            <DistanceBadge distanceKm={item.distanceBandKm} />
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-gray-500">Request status</dt>
          <dd className="font-medium">{STATUS_LABELS[item.request.status]}</dd>
        </div>
      </dl>

      {respondable && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => run("accept")}
            disabled={loading !== null}
            className="rounded-xl bg-emergency px-4 py-2 text-sm font-semibold text-white hover:bg-emergency-hover disabled:opacity-60"
          >
            {loading === "accept" ? "Accepting…" : "Accept"}
          </button>
          <button
            type="button"
            onClick={() => run("decline")}
            disabled={loading !== null}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading === "decline" ? "Declining…" : "Decline"}
          </button>
        </div>
      )}

      {onTheWay && (
        <button
          type="button"
          onClick={() => run("way")}
          disabled={loading !== null}
          className="rounded-xl bg-emergency px-4 py-2 text-sm font-semibold text-white hover:bg-emergency-hover disabled:opacity-60"
        >
          {loading === "way" ? "Updating…" : "Mark as On the Way"}
        </button>
      )}

      {item.matchStatus === "ACCEPTED" && item.request.status === "DONOR_ON_THE_WAY" && (
        <p className="text-sm text-green-700">
          You are marked on the way. Waiting for the requester to confirm the donation.
        </p>
      )}

      {item.matchStatus === "ACCEPTED" && item.request.status === "COMPLETED" && (
        <p className="text-sm text-green-700">Donation confirmed. Thank you.</p>
      )}

      {item.matchStatus === "DECLINED" && (
        <p className="text-sm text-gray-500">You declined this request.</p>
      )}

      {item.matchStatus === "EXPIRED" && (
        <p className="text-sm text-gray-500">
          Another donor was accepted for this request.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </article>
  );
}
