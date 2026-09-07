"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findMatchingDonorsAction } from "@/app/(requester)/actions";

export function FindMatchingDonorsButton({
  requestId,
  hasExistingMatches = false,
}: {
  requestId: string;
  hasExistingMatches?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onFind() {
    setError(null);
    setInfo(null);
    setLoading(true);
    const result = await findMatchingDonorsAction(requestId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo(
      [
        result.matchCount === 0
          ? "No matching donors found nearby."
          : `Found ${result.matchCount} matching donor${result.matchCount === 1 ? "" : "s"}.`,
        result.emergencyNotifiedCount > 0
          ? `${result.emergencyNotifiedCount} emergency-response donor${
              result.emergencyNotifiedCount === 1 ? "" : "s"
            } contacted.`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
    router.refresh();
  }

  const idleLabel = hasExistingMatches ? "Find Again" : "Find Matching Donors";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onFind}
        disabled={loading}
        className={
          hasExistingMatches
            ? "rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            : "rounded-xl bg-emergency px-4 py-3 text-sm font-semibold text-white hover:bg-emergency-hover disabled:opacity-60"
        }
      >
        {loading ? "Finding donors…" : idleLabel}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {info && <p className="text-sm text-green-700">{info}</p>}
    </div>
  );
}
