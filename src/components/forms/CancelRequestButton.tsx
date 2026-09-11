"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelBloodRequestAction } from "@/app/(requester)/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (loading) return;
    setError(null);
    setLoading(true);
    const result = await cancelBloodRequestAction(requestId);
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
        variant="outline"
        fullWidth
        disabled={loading}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Cancel request
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        onConfirm={() => void onConfirm()}
        title="Cancel this blood request?"
        description="Matching and donor outreach for this request will stop. You can create a new request later if you still need blood."
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        tone="destructive"
        loading={loading}
        loadingLabel="Cancelling…"
      />

      {error && (
        <Alert variant="danger" title="Could not cancel">
          {error}
        </Alert>
      )}
    </div>
  );
}
