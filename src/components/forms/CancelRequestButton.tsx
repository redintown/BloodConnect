"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelBloodRequestAction } from "@/app/(requester)/actions";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCancel() {
    if (!window.confirm("Cancel this blood request?")) return;
    setError(null);
    setLoading(true);
    const result = await cancelBloodRequestAction(requestId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        {loading ? "Cancelling…" : "Cancel request"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
