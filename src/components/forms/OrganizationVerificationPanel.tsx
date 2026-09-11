"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import type { VerificationStatus } from "@/lib/constants/verification";
import { cn } from "@/lib/utils/cn";

/**
 * Verification presentation for hospital / blood-bank profiles.
 *
 * Presentation only: it renders the existing verification status from the
 * owner's profile DTO and calls the submit handler the form already owns.
 * No new states, no review timelines, no reviewer/admin metadata.
 */
export function OrganizationVerificationPanel({
  status,
  rejectionReason,
  roleLabel,
  organizationLabel,
  canSubmit,
  loading,
  onSubmit,
}: {
  /** Null when no profile exists yet. */
  status: VerificationStatus | null;
  rejectionReason: string | null;
  /** Existing role name, e.g. "HOSPITAL". */
  roleLabel: string;
  /** Human organization type, e.g. "hospitals". */
  organizationLabel: string;
  canSubmit: boolean;
  loading: boolean;
  onSubmit: () => void;
}) {
  const tone =
    status === "VERIFIED"
      ? "border-success/20 bg-success-surface"
      : status === "REJECTED"
        ? "border-danger/25 bg-danger-surface"
        : status === "PENDING"
          ? "border-warning/25 bg-warning-surface"
          : "border-border bg-surface";

  return (
    <section aria-labelledby="verification-heading" className="flex flex-col gap-3">
      <SectionHeader
        id="verification-heading"
        title="Verification"
        description={`Role ${roleLabel} does not mean verified. Only verified ${organizationLabel} receive escalations.`}
      />

      <div className={cn("flex flex-col gap-3 rounded-lg border p-4", tone)}>
        <div className="flex flex-wrap items-center gap-2">
          {status ? (
            <StatusChip kind="verification" value={status} />
          ) : (
            <span className="inline-flex items-center rounded-sm border border-border bg-muted px-2 py-0.5 text-caption font-medium text-text-secondary">
              No profile yet
            </span>
          )}
        </div>

        {status === null && (
          <p className="text-body text-text-secondary">
            Create a profile to request verification.
          </p>
        )}
        {status === "UNVERIFIED" && (
          <p className="text-body text-text-secondary">
            Not submitted for verification yet. Submit your profile for admin review.
          </p>
        )}
        {status === "PENDING" && (
          <p className="text-body text-text-secondary">
            Submitted and awaiting admin review.
          </p>
        )}
        {status === "VERIFIED" && (
          <p className="text-body text-text-secondary">
            Verified. Changing name, phone, address, or location requires re-verification.
          </p>
        )}
        {status === "REJECTED" && (
          <>
            <p className="text-body text-text-secondary">
              Rejected. Update your profile and resubmit.
            </p>
            {rejectionReason && (
              <p className="text-body text-text">Reason: {rejectionReason}</p>
            )}
          </>
        )}

        {canSubmit && (
          <Button
            type="button"
            variant={status === "REJECTED" ? "secondary" : "primary"}
            size="sm"
            className="w-fit"
            loading={loading}
            loadingLabel="Submitting…"
            disabled={loading}
            onClick={onSubmit}
          >
            {status === "REJECTED" ? "Resubmit for verification" : "Submit for verification"}
          </Button>
        )}
      </div>
    </section>
  );
}

/** Shared unsaved-changes hint so both organization forms read the same. */
export function UnsavedChangesNote({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <Alert variant="info">You have unsaved changes. Save to apply them.</Alert>
  );
}
