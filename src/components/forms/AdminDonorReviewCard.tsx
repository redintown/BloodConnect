"use client";

import { useState } from "react";
import { verifyDonorAction, rejectDonorAction } from "@/app/(admin)/actions";
import type { PendingDonor } from "@/services/verificationService";

export function AdminDonorReviewCard({ donor }: { donor: PendingDonor }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onVerify() {
    setError(null);
    setInfo(null);
    setLoading(true);
    const result = await verifyDonorAction(donor.donorId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo("Verified.");
  }

  async function onReject() {
    setError(null);
    setInfo(null);

    if (reason.trim().length < 5) {
      setError("Rejection reason is required (at least 5 characters).");
      return;
    }

    setLoading(true);
    const result = await rejectDonorAction(donor.donorId, reason);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo("Rejected.");
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-800">
          DONOR
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
          {donor.verificationStatus}
        </span>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">{donor.donorName}</h2>
        <p className="text-sm text-gray-600">Blood group: {donor.bloodGroup}</p>
        <p className="text-sm text-gray-600">
          Eligibility: {donor.isAvailable ? "Available" : "Not available"}
        </p>
        {donor.lastDonationDate && (
          <p className="text-sm text-gray-600">Last donation: {donor.lastDonationDate}</p>
        )}
        <p className="text-sm text-gray-500">{donor.locationSummary ?? "Location missing"}</p>
        <p className="text-sm text-gray-500">
          Night availability: {donor.isAvailableAtNight ? "Yes" : "No"}
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Rejection reason
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emergency"
          rows={2}
          placeholder="Required when rejecting"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={onVerify}
          className="rounded-xl bg-emergency px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Verify
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onReject}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 disabled:opacity-60"
        >
          Reject
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {info && <p className="text-sm text-green-700">{info}</p>}
    </article>
  );
}

