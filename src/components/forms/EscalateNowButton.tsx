"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { escalateBloodRequestAction } from "@/app/(requester)/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function EscalateNowButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onEscalate() {
    if (loading) return;
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
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="emergency"
        fullWidth
        disabled={loading}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Escalate Now
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        onConfirm={() => void onEscalate()}
        title="Escalate this emergency request?"
        description="Nearby hospitals and blood banks may be contacted. Escalation does not guarantee supply or a response time."
        confirmLabel="Escalate Now"
        cancelLabel="Not now"
        tone="emergency"
        loading={loading}
        loadingLabel="Escalating…"
      />

      {error && (
        <Alert variant="danger" title="Could not escalate">
          {error}
        </Alert>
      )}
      {info && <Alert variant="info">{info}</Alert>}
    </div>
  );
}
