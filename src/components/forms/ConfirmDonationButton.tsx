"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDonationReceivedAction } from "@/app/(requester)/actions";

export function ConfirmDonationButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (!window.confirm("Confirm that you received the donation?")) return;
    setError(null);
    setLoading(true);
    const result = await confirmDonationReceivedAction(requestId);
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
        onClick={onConfirm}
        disabled={loading}
        className="rounded-xl bg-emergency px-4 py-3 text-sm font-semibold text-white hover:bg-emergency-hover disabled:opacity-60"
      >
        {loading ? "Confirming…" : "Confirm Donation Received"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
