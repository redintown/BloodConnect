"use client";

import { useState } from "react";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import { donorProfileSchema } from "@/schemas/donor.schema";
import { saveDonorProfileAction, submitDonorVerificationAction } from "@/app/(donor)/actions";
import { LocationPicker } from "@/components/forms/LocationPicker";
import { nextEligibleDate } from "@/lib/donors/eligibility";
import type { Coordinates, DonorProfile } from "@/types/domain";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/lib/utils/cn";

/**
 * Donor profile editor — presentation only.
 *
 * Saves through `saveDonorProfileAction` / `submitDonorVerificationAction`.
 * Eligibility is displayed from the saved profile DTO (`isEligible`); the
 * wait-until date is shown only when the backend already marks the donor
 * ineligible and a last-donation date exists. No client-side eligibility
 * boolean is computed while editing.
 */
export function DonorProfileForm({ profile }: { profile: DonorProfile | null }) {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">(profile?.bloodGroup ?? "");
  const [lastDonationDate, setLastDonationDate] = useState(profile?.lastDonationDate ?? "");
  const [location, setLocation] = useState<Coordinates | null>(profile?.location ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationInfo, setVerificationInfo] = useState<string | null>(null);

  const savedWaitUntil =
    profile && !profile.isEligible && profile.lastDonationDate
      ? nextEligibleDate(profile.lastDonationDate)
      : null;

  const dateDirty = (lastDonationDate || "") !== (profile?.lastDonationDate ?? "");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setInfo(null);

    const parsed = donorProfileSchema.safeParse({
      bloodGroup: bloodGroup || undefined,
      lastDonationDate: lastDonationDate || null,
      location,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        bloodGroup: flattened.bloodGroup?.[0] ?? "",
        lastDonationDate: flattened.lastDonationDate?.[0] ?? "",
        location: flattened.location?.[0] ?? "",
      });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    const result = await saveDonorProfileAction(parsed.data);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo("Profile saved.");
  }

  async function onSubmitVerification() {
    if (verificationLoading) return;
    setVerificationError(null);
    setVerificationInfo(null);
    setVerificationLoading(true);

    try {
      const result = await submitDonorVerificationAction();
      setVerificationLoading(false);

      if ("error" in result) {
        setVerificationError(result.error);
        return;
      }
      setVerificationInfo("Submitted. Your donor account is now pending admin review.");
    } catch {
      setVerificationLoading(false);
      setVerificationError("Something went wrong");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      {profile && (
        <section aria-labelledby="profile-status-heading" className="flex flex-col gap-3">
          <SectionHeader id="profile-status-heading" title="Profile status" />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <p className="text-label text-text-secondary">Blood group</p>
              <p className="text-blood-group text-text">{BLOOD_GROUP_LABELS[profile.bloodGroup]}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <p className="text-label text-text-secondary">Verification</p>
              <StatusChip kind="verification" value={profile.verificationStatus} />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <p className="text-label text-text-secondary">Eligibility</p>
              <span
                className={cn(
                  "inline-flex w-fit items-center rounded-sm border px-2 py-0.5 text-caption font-medium",
                  profile.isEligible
                    ? "border-success/20 bg-success-surface text-success"
                    : "border-warning/25 bg-warning-surface text-warning"
                )}
              >
                {profile.isEligible ? "Eligible to donate" : "Not currently eligible"}
              </span>
              {!profile.isEligible && savedWaitUntil && (
                <p className="text-caption text-text-secondary">Wait until {savedWaitUntil}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <p className="text-label text-text-secondary">Location</p>
              <p className="text-body-strong text-text">
                {profile.location ? "Set" : "Not set"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            {profile.verificationStatus === "UNVERIFIED" && (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-body-strong text-text">
                    Donor account is not automatically verified.
                  </p>
                  <p className="mt-1 text-body text-text-secondary">
                    Submit your profile for admin review.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="w-fit"
                  loading={verificationLoading}
                  loadingLabel="Submitting…"
                  onClick={() => void onSubmitVerification()}
                >
                  Submit verification
                </Button>
              </div>
            )}

            {profile.verificationStatus === "PENDING" && (
              <div>
                <p className="text-body-strong text-text">Verification pending</p>
                <p className="mt-1 text-body text-text-secondary">Admin review is in progress.</p>
              </div>
            )}

            {profile.verificationStatus === "VERIFIED" && (
              <div>
                <p className="text-body-strong text-success">Your donor account is verified.</p>
                <p className="mt-1 text-body text-text-secondary">
                  Thank you for helping the community.
                </p>
              </div>
            )}

            {profile.verificationStatus === "REJECTED" && (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-body-strong text-danger">Donor verification rejected</p>
                  {profile.rejectionReason && (
                    <p className="mt-1 text-body text-text-secondary">
                      Reason: {profile.rejectionReason}
                    </p>
                  )}
                  <p className="mt-1 text-body text-text-secondary">
                    Please update your profile and resubmit for verification.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                  loading={verificationLoading}
                  loadingLabel="Submitting…"
                  onClick={() => void onSubmitVerification()}
                >
                  Resubmit for verification
                </Button>
              </div>
            )}

            {verificationError && (
              <Alert variant="danger" className="mt-3" title="Could not submit">
                {verificationError}
              </Alert>
            )}
            {verificationInfo && (
              <Alert variant="success" className="mt-3">
                {verificationInfo}
              </Alert>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="donor-info-heading" className="flex flex-col gap-4">
        <SectionHeader
          id="donor-info-heading"
          title="Donor information"
          description="Blood group and last donation are used for matching."
        />

        <FormField label="Blood group" error={fieldErrors.bloodGroup || null} required>
          {({ id, describedBy, invalid, className, required }) => (
            <select
              id={id}
              name="bloodGroup"
              value={bloodGroup}
              onChange={(event) => setBloodGroup(event.target.value as BloodGroup | "")}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={className}
            >
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {BLOOD_GROUP_LABELS[group]}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField
          label="Last donation date"
          helperText={
            dateDirty
              ? "Eligibility updates after you save. Leave blank if you have never donated."
              : "Leave blank if you have never donated."
          }
          error={fieldErrors.lastDonationDate || null}
        >
          {({ id, describedBy, invalid, className }) => (
            <input
              id={id}
              type="date"
              name="lastDonationDate"
              value={lastDonationDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setLastDonationDate(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={className}
            />
          )}
        </FormField>

        {!lastDonationDate && (
          <p className="text-caption text-text-tertiary">No donation recorded</p>
        )}
      </section>

      <section aria-labelledby="location-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="location-heading"
          title="Location"
          description="Used to find nearby requests. Exact coordinates are never shown to others."
        />
        <fieldset
          aria-invalid={fieldErrors.location ? true : undefined}
          className="flex flex-col gap-2"
        >
          <legend className="sr-only">Location</legend>
          <LocationPicker value={location} onChange={setLocation} />
          {fieldErrors.location && (
            <p role="alert" className="text-caption text-danger">
              {fieldErrors.location}
            </p>
          )}
        </fieldset>
      </section>

      {error && (
        <Alert variant="danger" title="Could not save">
          {error}
        </Alert>
      )}
      {info && <Alert variant="success">{info}</Alert>}

      <Button type="submit" fullWidth loading={loading} loadingLabel="Saving…">
        Save profile
      </Button>
    </form>
  );
}
