"use client";

import { useId, useState } from "react";
import { verifyDonorAction, rejectDonorAction } from "@/app/(admin)/actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { StatusChip } from "@/components/ui/StatusChip";
import { FormField } from "@/components/ui/FormField";
import { BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import type { PendingDonor } from "@/services/verificationService";

/**
 * Admin review card for one pending donor.
 *
 * Presentation only. `verifyDonorAction` / `rejectDonorAction` are the
 * exact existing server actions — same names, same payloads, same
 * validation. The rejection-reason minimum (5 characters) mirrors
 * `donorRejectSchema` exactly; it is not a new rule.
 *
 * `isAvailable` is the DTO availability flag, not eligibility. This card
 * does not apply the 56-day rule or any other client-side calculation.
 *
 * Reject stays an inline reason + button, matching the existing
 * interaction (no ConfirmDialog — the original flow never used one).
 */
function formatWaitingSince(updatedAt: string): string {
  return new Date(updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDonationDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminDonorReviewCard({ donor }: { donor: PendingDonor }) {
  const headingId = useId();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const busy = verifying || rejecting;
  const bloodGroupLabel =
    BLOOD_GROUP_LABELS[donor.bloodGroup as BloodGroup] ?? donor.bloodGroup;

  async function onVerify() {
    if (busy) return;
    setError(null);
    setInfo(null);
    setVerifying(true);
    const result = await verifyDonorAction(donor.donorId);
    setVerifying(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo("Donor verified.");
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
    const result = await rejectDonorAction(donor.donorId, reason);
    setRejecting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo("Donor rejected.");
  }

  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-sm border border-border bg-muted px-2 py-0.5 text-caption font-medium text-text-secondary">
          {bloodGroupLabel}
        </span>
        <StatusChip kind="verification" value={donor.verificationStatus} />
      </div>

      <div className="flex flex-col gap-1">
        <h3 id={headingId} className="text-body-strong text-text">
          {donor.donorName}
        </h3>
        <dl className="flex flex-col gap-0.5 text-body text-text-secondary">
          <div className="flex flex-wrap gap-1">
            <dt className="text-text-tertiary">Availability:</dt>
            <dd>{donor.isAvailable ? "Available" : "Not available"}</dd>
          </div>
          <div className="flex flex-wrap gap-1">
            <dt className="text-text-tertiary">Night availability:</dt>
            <dd>{donor.isAvailableAtNight ? "Yes" : "No"}</dd>
          </div>
          {donor.lastDonationDate && (
            <div className="flex flex-wrap gap-1">
              <dt className="text-text-tertiary">Last donation:</dt>
              <dd>{formatDonationDate(donor.lastDonationDate)}</dd>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            <dt className="text-text-tertiary">Location:</dt>
            <dd>{donor.locationSummary ?? "Location missing"}</dd>
          </div>
          <div className="flex flex-wrap gap-1">
            <dt className="text-text-tertiary">Waiting since:</dt>
            <dd>{formatWaitingSince(donor.updatedAt)}</dd>
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
            placeholder="Explain why this donor is being rejected"
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
          aria-label={`Verify ${donor.donorName}`}
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
          aria-label={`Reject ${donor.donorName}`}
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
