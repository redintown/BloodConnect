"use client";

import { useState } from "react";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import { donorProfileSchema } from "@/schemas/donor.schema";
import { saveDonorProfileAction, submitDonorVerificationAction } from "@/app/(donor)/actions";
import { LocationPicker } from "@/components/forms/LocationPicker";
import { isEligibleFromLastDonation, nextEligibleDate } from "@/lib/donors/eligibility";
import type { Coordinates, DonorProfile } from "@/types/domain";

const inputClassName =
  "w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-emergency focus:ring-1 focus:ring-emergency";

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

  const eligiblePreview = isEligibleFromLastDonation(lastDonationDate || null);
  const nextDate = lastDonationDate ? nextEligibleDate(lastDonationDate) : null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {profile && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          {profile.verificationStatus === "UNVERIFIED" && (
            <>
              <p className="text-sm font-medium text-gray-800">Donor account is not automatically verified.</p>
              <p className="mt-1 text-sm text-gray-600">Submit your profile for admin review.</p>
              <button
                type="button"
                onClick={onSubmitVerification}
                disabled={verificationLoading}
                className="mt-3 rounded-xl bg-emergency px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {verificationLoading ? "Submitting..." : "Submit verification"}
              </button>
            </>
          )}

          {profile.verificationStatus === "PENDING" && (
            <>
              <p className="text-sm font-medium text-gray-800">Verification pending</p>
              <p className="mt-1 text-sm text-gray-600">Admin review is in progress.</p>
            </>
          )}

          {profile.verificationStatus === "VERIFIED" && (
            <>
              <p className="text-sm font-medium text-green-800">Your donor account is verified.</p>
              <p className="mt-1 text-sm text-gray-600">Thank you for helping the community.</p>
            </>
          )}

          {profile.verificationStatus === "REJECTED" && (
            <>
              <p className="text-sm font-medium text-red-800">
                Donor verification rejected
              </p>
              {profile.rejectionReason && (
                <p className="mt-1 text-sm text-gray-700">
                  Reason: {profile.rejectionReason}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-600">
                Please update your profile and resubmit for verification.
              </p>
              <button
                type="button"
                onClick={onSubmitVerification}
                disabled={verificationLoading}
                className="mt-3 rounded-xl border border-emergency px-4 py-2 text-sm font-semibold text-emergency disabled:opacity-60"
              >
                {verificationLoading ? "Submitting..." : "Resubmit for verification"}
              </button>
            </>
          )}

          {verificationError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {verificationError}
            </p>
          )}
          {verificationInfo && (
            <p className="mt-2 text-sm text-green-700">
              {verificationInfo}
            </p>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Blood group
        <select
          name="bloodGroup"
          value={bloodGroup}
          onChange={(event) => setBloodGroup(event.target.value as BloodGroup | "")}
          className={inputClassName}
          required
        >
          <option value="">Select blood group</option>
          {BLOOD_GROUPS.map((group) => (
            <option key={group} value={group}>
              {BLOOD_GROUP_LABELS[group]}
            </option>
          ))}
        </select>
        {fieldErrors.bloodGroup && (
          <span className="font-normal text-red-600">{fieldErrors.bloodGroup}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Last donation date
        <input
          type="date"
          name="lastDonationDate"
          value={lastDonationDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setLastDonationDate(event.target.value)}
          className={inputClassName}
        />
        <span className="font-normal text-xs text-gray-500">Leave blank if you have never donated.</span>
        {fieldErrors.lastDonationDate && (
          <span className="font-normal text-red-600">{fieldErrors.lastDonationDate}</span>
        )}
      </label>

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <p className="font-medium text-gray-800">Eligibility</p>
        {eligiblePreview ? (
          <p className="text-green-700">Eligible to donate</p>
        ) : (
          <p className="text-gray-700">
            Not eligible yet{nextDate ? ` — wait until ${nextDate}` : ""}.
          </p>
        )}
      </div>

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
        className="rounded-xl bg-emergency px-6 py-3 font-semibold text-white hover:bg-emergency-hover disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
