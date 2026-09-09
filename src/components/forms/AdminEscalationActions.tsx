"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminCancelEscalationAction,
  adminResolveEscalationAction,
} from "@/app/(org)/actions";

export function AdminEscalationActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"resolve" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onResolve() {
    setError(null);
    setLoading("resolve");
    const result = await adminResolveEscalationAction(requestId);
    setLoading(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function onCancel() {
    setError(null);
    setLoading("cancel");
    const result = await adminCancelEscalationAction(requestId);
    setLoading(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading !== null}
          onClick={onResolve}
          className="rounded-lg bg-emergency px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading === "resolve" ? "Resolving…" : "Resolve escalation"}
        </button>
        <button
          type="button"
          disabled={loading !== null}
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
        >
          {loading === "cancel" ? "Cancelling…" : "Cancel escalation"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
