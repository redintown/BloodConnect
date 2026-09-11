"use client";

import { useState } from "react";
import { bloodBankProfileSchema } from "@/schemas/bloodBank.schema";
import {
  saveBloodBankProfileAction,
  submitBloodBankVerificationAction,
} from "@/app/(org)/profileActions";
import { LocationPicker } from "@/components/forms/LocationPicker";
import {
  OrganizationVerificationPanel,
  UnsavedChangesNote,
} from "@/components/forms/OrganizationVerificationPanel";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import type { BloodBank } from "@/types/domain";

/**
 * Blood bank organization profile — presentation only.
 *
 * Same contracts as before: `bloodBankProfileSchema` for client-side field
 * errors, `saveBloodBankProfileAction` for create/update, and
 * `submitBloodBankVerificationAction` for verification submission.
 */
export function BloodBankProfileForm({ profile }: { profile: BloodBank | null }) {
  const [name, setName] = useState(profile?.name ?? "");
  const [contactPhone, setContactPhone] = useState(profile?.phone ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [emergencyHours, setEmergencyHours] = useState(profile?.emergencyHours ?? "");
  const [location, setLocation] = useState(profile?.location ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [status, setStatus] = useState(profile?.verificationStatus ?? null);
  const [rejectionReason, setRejectionReason] = useState(profile?.rejectionReason ?? null);
  const [loading, setLoading] = useState(false);

  const dirty =
    name !== (profile?.name ?? "") ||
    contactPhone !== (profile?.phone ?? "") ||
    address !== (profile?.address ?? "") ||
    emergencyHours !== (profile?.emergencyHours ?? "") ||
    location?.latitude !== profile?.location?.latitude ||
    location?.longitude !== profile?.location?.longitude;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setInfo(null);

    const parsed = bloodBankProfileSchema.safeParse({
      name,
      contactPhone,
      address,
      location,
      emergencyHours: emergencyHours || null,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        name: flattened.name?.[0] ?? "",
        contactPhone: flattened.contactPhone?.[0] ?? "",
        address: flattened.address?.[0] ?? "",
        location: flattened.location?.[0] ?? "",
      });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    const result = await saveBloodBankProfileAction(parsed.data);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }

    if (result.reVerificationRequired) {
      setStatus("PENDING");
      setRejectionReason(null);
      setInfo("Profile saved. Sensitive changes require re-verification — status is now PENDING.");
    } else {
      setStatus((current) => current ?? "PENDING");
      setInfo(profile ? "Profile saved." : "Profile created and submitted as PENDING.");
    }
  }

  async function onSubmitVerification() {
    if (loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    const result = await submitBloodBankVerificationAction();
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStatus("PENDING");
    setRejectionReason(null);
    setInfo("Submitted for verification.");
  }

  const canResubmit = status === "REJECTED" || status === "UNVERIFIED";

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="org-summary-heading" className="flex flex-col gap-3">
        <SectionHeader id="org-summary-heading" title="Organization summary" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
            <p className="text-label text-text-secondary">Organization</p>
            <p className="text-body-strong text-text">
              {profile?.name || "Not created yet"}
            </p>
            <p className="text-caption text-text-tertiary">Blood bank</p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <p className="text-label text-text-secondary">Verification</p>
            {status ? (
              <StatusChip kind="verification" value={status} />
            ) : (
              <p className="text-body-strong text-text">No profile yet</p>
            )}
          </div>
        </div>
      </section>

      <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
        <section aria-labelledby="org-info-heading" className="flex flex-col gap-4">
          <SectionHeader
            id="org-info-heading"
            title="Organization information"
            description="Name, phone, and address are used when your blood bank is escalated to."
          />

          <FormField label="Blood bank name" error={fieldErrors.name || null} required>
            {({ id, describedBy, invalid, className, required }) => (
              <input
                id={id}
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                required={required}
                className={className}
              />
            )}
          </FormField>

          <FormField
            label="Phone"
            helperText="Reachable number for emergency coordination."
            error={fieldErrors.contactPhone || null}
            required
          >
            {({ id, describedBy, invalid, className, required }) => (
              <input
                id={id}
                type="tel"
                name="contactPhone"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                required={required}
                className={className}
              />
            )}
          </FormField>

          <FormField label="Address" error={fieldErrors.address || null} required>
            {({ id, describedBy, invalid, className, required }) => (
              <textarea
                id={id}
                name="address"
                rows={3}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                required={required}
                className={className}
              />
            )}
          </FormField>

          <FormField
            label="Emergency hours"
            helperText="Optional. When your blood bank can respond, e.g. 24/7 or 8am–10pm."
          >
            {({ id, describedBy, className }) => (
              <input
                id={id}
                name="emergencyHours"
                value={emergencyHours}
                onChange={(event) => setEmergencyHours(event.target.value)}
                placeholder="e.g. 24/7 or 8am–10pm"
                aria-describedby={describedBy}
                className={className}
              />
            )}
          </FormField>
        </section>

        <section aria-labelledby="org-location-heading" className="flex flex-col gap-3">
          <SectionHeader
            id="org-location-heading"
            title="Location"
            description="Used to find nearby organizations during escalation. Exact coordinates are not shown here."
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

        <UnsavedChangesNote visible={dirty && !loading} />

        {error && (
          <Alert variant="danger" title="Could not save">
            {error}
          </Alert>
        )}
        {info && <Alert variant="success">{info}</Alert>}

        <Button
          type="submit"
          fullWidth
          loading={loading}
          loadingLabel="Saving…"
          disabled={loading}
        >
          {profile ? "Save profile" : "Create profile"}
        </Button>
      </form>

      <OrganizationVerificationPanel
        status={status}
        rejectionReason={rejectionReason}
        roleLabel="BLOOD_BANK"
        organizationLabel="blood banks"
        canSubmit={canResubmit}
        loading={loading}
        onSubmit={() => void onSubmitVerification()}
      />
    </div>
  );
}
