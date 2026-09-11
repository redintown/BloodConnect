"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDonationReceivedAction } from "@/app/(requester)/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function ConfirmDonationButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (loading) return;
    setError(null);
    setLoading(true);
    const result = await confirmDonationReceivedAction(requestId);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="primary"
        fullWidth
        disabled={loading}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Confirm Donation Received
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        onConfirm={() => void onConfirm()}
        title="Confirm that you received the donation?"
        description="This marks the request completed and records the donation for the accepted donor."
        confirmLabel="Confirm received"
        cancelLabel="Not yet"
        tone="primary"
        loading={loading}
        loadingLabel="Confirming…"
      />

      {error && (
        <Alert variant="danger" title="Could not confirm">
          {error}
        </Alert>
      )}
    </div>
  );
}
