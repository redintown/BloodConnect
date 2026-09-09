"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondToEscalationAction } from "@/app/(org)/actions";

export function OrgEscalationResponseButtons({
  targetId,
  currentStatus,
}: {
  targetId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(response: "ACKNOWLEDGED" | "CAN_SUPPLY" | "CANNOT_HELP") {
    setError(null);
    setLoading(response);
    const result = await respondToEscalationAction(targetId, response);
    setLoading(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const disabled = loading !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => respond("ACKNOWLEDGED")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          {loading === "ACKNOWLEDGED" ? "Saving…" : "Acknowledge"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => respond("CAN_SUPPLY")}
          className="rounded-lg bg-emergency px-3 py-2 text-sm font-semibold text-white hover:bg-emergency-hover disabled:opacity-60"
        >
          {loading === "CAN_SUPPLY" ? "Saving…" : "Can Supply"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => respond("CANNOT_HELP")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading === "CANNOT_HELP" ? "Saving…" : "Cannot Help"}
        </button>
      </div>
      <p className="text-xs text-gray-500">Current response: {currentStatus}</p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
