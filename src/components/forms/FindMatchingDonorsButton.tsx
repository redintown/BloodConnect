"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findMatchingDonorsAction } from "@/app/(requester)/actions";

export function FindMatchingDonorsButton({ requestId }: { requestId: string }) {
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
      result.matchCount === 0
        ? "No matching donors found within 30 km."
        : `Found ${result.matchCount} matching donor${result.matchCount === 1 ? "" : "s"}.`
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onFind}
        disabled={loading}
        className="rounded-xl bg-emergency px-4 py-3 text-sm font-semibold text-white hover:bg-emergency-hover disabled:opacity-60"
      >
        {loading ? "Finding donors…" : "Find Matching Donors"}
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
