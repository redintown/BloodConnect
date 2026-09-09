"use client";

import { useState } from "react";
import { hospitalProfileSchema } from "@/schemas/hospital.schema";
import {
  saveHospitalProfileAction,
  submitHospitalVerificationAction,
} from "@/app/(org)/profileActions";
import { LocationPicker } from "@/components/forms/LocationPicker";
import type { Hospital } from "@/types/domain";

const inputClassName =
  "w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-emergency focus:ring-1 focus:ring-emergency";

const STATUS_COPY: Record<Hospital["verificationStatus"], string> = {
  UNVERIFIED: "Not submitted for verification yet.",
  PENDING: "Awaiting admin review. Having a HOSPITAL role does not mean you are verified.",
  VERIFIED: "Verified. Changing name, phone, address, or location requires re-verification.",
  REJECTED: "Rejected. Update your profile and resubmit.",
};

export function HospitalProfileForm({ profile }: { profile: Hospital | null }) {
  const [name, setName] = useState(profile?.name ?? "");
  const [contactPhone, setContactPhone] = useState(profile?.phone ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [has24hEmergency, setHas24hEmergency] = useState(profile?.has24hEmergency ?? false);
  const [location, setLocation] = useState(profile?.location ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [status, setStatus] = useState(profile?.verificationStatus ?? null);
  const [rejectionReason, setRejectionReason] = useState(profile?.rejectionReason ?? null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const parsed = hospitalProfileSchema.safeParse({
      name,
      contactPhone,
      address,
      location,
      has24hEmergency,
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
    const result = await saveHospitalProfileAction(parsed.data);
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
    setError(null);
    setInfo(null);
    setLoading(true);
    const result = await submitHospitalVerificationAction();
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
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <p className="font-medium text-gray-800">
          Verification: {status ?? "No profile yet"}
        </p>
        <p className="text-gray-600">
          {status ? STATUS_COPY[status] : "Create a profile to request verification."}
        </p>
        {status === "REJECTED" && rejectionReason && (
          <p className="mt-2 text-red-700">Reason: {rejectionReason}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          HOSPITAL role ≠ verified organization. Only VERIFIED hospitals receive escalations.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Hospital name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClassName}
            required
          />
          {fieldErrors.name && <span className="font-normal text-red-600">{fieldErrors.name}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Phone
          <input
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            className={inputClassName}
            required
          />
          {fieldErrors.contactPhone && (
            <span className="font-normal text-red-600">{fieldErrors.contactPhone}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Address
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className={inputClassName}
            rows={3}
            required
          />
          {fieldErrors.address && (
            <span className="font-normal text-red-600">{fieldErrors.address}</span>
          )}
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={has24hEmergency}
            onChange={(event) => setHas24hEmergency(event.target.checked)}
          />
          24-hour emergency services
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-gray-700">Location</legend>
          <LocationPicker value={location} onChange={setLocation} />
          {fieldErrors.location && <span className="text-sm text-red-600">{fieldErrors.location}</span>}
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {info && <p className="text-sm text-green-700">{info}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emergency px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Saving…" : profile ? "Save profile" : "Create profile"}
        </button>
      </form>

      {canResubmit && (
        <button
          type="button"
          disabled={loading}
          onClick={onSubmitVerification}
          className="rounded-xl border border-emergency px-4 py-3 font-semibold text-emergency disabled:opacity-60"
        >
          Resubmit for verification
        </button>
      )}
    </div>
  );
}
