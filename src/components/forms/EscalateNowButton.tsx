"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { escalateBloodRequestAction } from "@/app/(requester)/actions";

export function EscalateNowButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onEscalate() {
    setError(null);
    setInfo(null);
    setLoading(true);
    const result = await escalateBloodRequestAction(requestId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo(
      result.alreadyActive
        ? "Escalation is already active for this request."
        : "Request escalated to nearby hospitals and blood banks."
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onEscalate}
        disabled={loading}
        className="rounded-xl border-2 border-red-800 bg-red-800 px-4 py-3 text-sm font-bold text-white hover:bg-red-900 disabled:opacity-60"
      >
        {loading ? "Escalating…" : "Escalate Now"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {info && <p className="text-sm text-red-800">{info}</p>}
    </div>
  );
}
