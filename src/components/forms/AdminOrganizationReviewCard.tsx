"use client";

import { useId, useState } from "react";
import {
  rejectOrganizationAction,
  verifyOrganizationAction,
} from "@/app/(admin)/actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { StatusChip } from "@/components/ui/StatusChip";
import { FormField } from "@/components/ui/FormField";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { PendingOrganization } from "@/services/verificationService";

/**
 * Admin review card for one pending organization.
 *
 * Presentation only. `verifyOrganizationAction` / `rejectOrganizationAction`
 * are the exact existing server actions — same names, same payloads, same
 * validation. The rejection-reason minimum (5 characters) mirrors
 * `orgRejectSchema` exactly; it is not a new rule.
 *
 * Reject stays an inline reason + button, matching the existing interaction
 * (no ConfirmDialog — the original flow never used one).
 */
function formatWaitingSince(updatedAt: string): string {
  return new Date(updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminOrganizationReviewCard({ org }: { org: PendingOrganization }) {
  const headingId = useId();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const busy = verifying || rejecting;

  async function onVerify() {
    if (busy) return;
    setError(null);
    setInfo(null);
    setVerifying(true);
    const result = await verifyOrganizationAction(org.organizationType, org.id);
    setVerifying(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo("Organization verified.");
  }

  async function onReject() {
    if (busy) return;
    setError(null);
    setInfo(null);
    setReasonError(null);
    if (reason.trim().length < 5) {
      setReasonError("Rejection reason must be at least 5 characters.");
      return;
    }
    setRejecting(true);
    const result = await rejectOrganizationAction(org.organizationType, org.id, reason);
    setRejecting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo("Organization rejected.");
  }

  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-sm border border-border bg-muted px-2 py-0.5 text-caption font-medium text-text-secondary">
          {ROLE_LABELS[org.organizationType]}
        </span>
        <StatusChip kind="verification" value={org.verificationStatus} />
      </div>

      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-body-strong text-text">
          {org.name}
        </h3>
        <dl className="flex flex-col gap-0.5 text-body text-text-secondary">
          <div className="flex flex-wrap gap-1">
            <dt className="text-text-tertiary">Phone:</dt>
            <dd>{org.phone}</dd>
          </div>
          <div className="flex flex-wrap gap-1">
            <dt className="text-text-tertiary">Address:</dt>
            <dd>{org.address}</dd>
          </div>
          {org.locationSummary && (
            <div className="flex flex-wrap gap-1">
              <dt className="text-text-tertiary">Location:</dt>
              <dd>{org.locationSummary}</dd>
            </div>
          )}
          {org.organizationType === "HOSPITAL" && (
            <div className="flex flex-wrap gap-1">
              <dt className="text-text-tertiary">24h emergency:</dt>
              <dd>{org.has24hEmergency ? "Yes" : "No"}</dd>
            </div>
          )}
          {org.organizationType === "BLOOD_BANK" && org.emergencyHours && (
            <div className="flex flex-wrap gap-1">
              <dt className="text-text-tertiary">Emergency hours:</dt>
              <dd>{org.emergencyHours}</dd>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            <dt className="text-text-tertiary">Waiting since:</dt>
            <dd>{formatWaitingSince(org.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      <FormField
        label="Rejection reason"
        helperText="Required to reject — 5 to 500 characters."
        error={reasonError}
      >
        {({ id, describedBy, invalid, className }) => (
          <textarea
            id={id}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (reasonError) setReasonError(null);
            }}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            maxLength={500}
            rows={2}
            disabled={busy}
            placeholder="Explain why this organization is being rejected"
            className={className}
          />
        )}
      </FormField>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={busy}
          loading={verifying}
          loadingLabel="Verifying…"
          onClick={onVerify}
          aria-label={`Verify ${org.name}`}
        >
          Verify
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          loading={rejecting}
          loadingLabel="Rejecting…"
          onClick={onReject}
          aria-label={`Reject ${org.name}`}
        >
          Reject
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="Could not save your decision">
          {error}
        </Alert>
      )}
      {info && <Alert variant="success">{info}</Alert>}
    </article>
  );
}
