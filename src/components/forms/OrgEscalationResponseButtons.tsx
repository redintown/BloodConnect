"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondToEscalationAction } from "@/app/(org)/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ESCALATION_STATUS_LABELS } from "@/components/ui/StatusChip";

/**
 * Organization response to one escalation target — presentation only.
 *
 * Same contract as before: `respondToEscalationAction(targetId, response)`
 * with the same three response values. No new actions, no new statuses,
 * no new validation. The server still decides whether a response is
 * accepted; this component only prevents duplicate submits and surfaces
 * the existing error/human status labels.
 */
export function OrgEscalationResponseButtons({
  targetId,
  currentStatus,
}: {
  targetId: string;
  currentStatus: "PENDING" | "ACKNOWLEDGED" | "CAN_SUPPLY" | "CANNOT_HELP";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"ACKNOWLEDGED" | "CAN_SUPPLY" | "CANNOT_HELP" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  async function respond(response: "ACKNOWLEDGED" | "CAN_SUPPLY" | "CANNOT_HELP") {
    if (loading) return;
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="sm:flex-1"
          disabled={disabled}
          loading={loading === "ACKNOWLEDGED"}
          loadingLabel="Saving…"
          onClick={() => void respond("ACKNOWLEDGED")}
        >
          Acknowledge
        </Button>
        <Button
          type="button"
          variant="primary"
          className="sm:flex-1"
          disabled={disabled}
          loading={loading === "CAN_SUPPLY"}
          loadingLabel="Saving…"
          onClick={() => void respond("CAN_SUPPLY")}
        >
          Can supply
        </Button>
        <Button
          type="button"
          variant="outline"
          className="sm:flex-1"
          disabled={disabled}
          loading={loading === "CANNOT_HELP"}
          loadingLabel="Saving…"
          onClick={() => void respond("CANNOT_HELP")}
        >
          Cannot help
        </Button>
      </div>
      <p className="text-caption text-text-tertiary">
        Current response: {ESCALATION_STATUS_LABELS[currentStatus]}
      </p>
      {error && (
        <Alert variant="danger" title="Could not save response">
          {error}
        </Alert>
      )}
    </div>
  );
}
