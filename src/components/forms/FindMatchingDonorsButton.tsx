"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findMatchingDonorsAction } from "@/app/(requester)/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export function FindMatchingDonorsButton({
  requestId,
  hasExistingMatches = false,
}: {
  requestId: string;
  hasExistingMatches?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onFind() {
    if (loading) return;
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
      [
        result.matchCount === 0
          ? "No matching donors found nearby."
          : `Found ${result.matchCount} matching donor${result.matchCount === 1 ? "" : "s"}.`,
        result.emergencyNotifiedCount > 0
          ? `${result.emergencyNotifiedCount} emergency-response donor${
              result.emergencyNotifiedCount === 1 ? "" : "s"
            } contacted.`
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
    router.refresh();
  }

  const idleLabel = hasExistingMatches ? "Find Again" : "Find Matching Donors";

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={hasExistingMatches ? "secondary" : "primary"}
        fullWidth
        loading={loading}
        loadingLabel="Finding donors…"
        disabled={loading}
        onClick={() => void onFind()}
      >
        {idleLabel}
      </Button>
      {error && (
        <Alert variant="danger" title="Could not find donors">
          {error}
        </Alert>
      )}
      {info && <Alert variant="success">{info}</Alert>}
    </div>
  );
}
