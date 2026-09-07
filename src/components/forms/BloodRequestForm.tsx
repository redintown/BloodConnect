"use client";

import { useState } from "react";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import { REQUEST_URGENCIES, type RequestUrgency } from "@/lib/constants/requestStatus";
import { createBloodRequestSchema } from "@/schemas/bloodRequest.schema";
import { createBloodRequestAndFindDonorsAction, updateBloodRequestAction } from "@/app/(requester)/actions";
import { LocationPicker } from "@/components/forms/LocationPicker";
import type { BloodRequest, Coordinates } from "@/types/domain";

const inputClassName =
  "w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-emergency focus:ring-1 focus:ring-emergency";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function BloodRequestForm({
  mode = "create",
  request,
}: {
  mode?: "create" | "edit";
  request?: BloodRequest;
}) {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">(request?.bloodGroup ?? "");
  const [quantityUnits, setQuantityUnits] = useState(String(request?.quantityUnits ?? 1));
  const [urgency, setUrgency] = useState<RequestUrgency>(request?.urgency ?? "CRITICAL");
  const [requiredBy, setRequiredBy] = useState(toDatetimeLocalValue(request?.requiredBy));
  const [hospitalNameFreeform, setHospitalNameFreeform] = useState(
    request?.hospitalNameFreeform ?? ""
  );
  const [contactName, setContactName] = useState(request?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(request?.contactPhone ?? "");
  const [notes, setNotes] = useState(request?.notes ?? "");
  const [location, setLocation] = useState<Coordinates | null>(request?.location ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"idle" | "creating" | "matching">("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const parsed = createBloodRequestSchema.safeParse({
      bloodGroup: bloodGroup || undefined,
      quantityUnits,
      urgency,
      requiredBy: fromDatetimeLocalValue(requiredBy),
      hospitalNameFreeform: hospitalNameFreeform || null,
      hospitalId: request?.hospitalId ?? null,
      location: location ?? undefined,
      contactName,
      contactPhone,
      notes: notes || null,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        bloodGroup: flattened.bloodGroup?.[0] ?? "",
        quantityUnits: flattened.quantityUnits?.[0] ?? "",
        urgency: flattened.urgency?.[0] ?? "",
        requiredBy: flattened.requiredBy?.[0] ?? "",
        hospitalNameFreeform: flattened.hospitalNameFreeform?.[0] ?? "",
        contactName: flattened.contactName?.[0] ?? "",
        contactPhone: flattened.contactPhone?.[0] ?? "",
        notes: flattened.notes?.[0] ?? "",
        location: flattened.location?.[0] ?? "",
      });
      return;
    }

    setFieldErrors({});
    setLoading(true);

    if (mode === "edit" && request) {
      const result = await updateBloodRequestAction(request.id, parsed.data);
      setLoading(false);
      setLoadingStage("idle");
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setInfo("Request updated.");
      return;
    }

    setLoadingStage("creating");
    // Brief staged copy while the single server orchestration runs.
    const stageTimer = window.setTimeout(() => setLoadingStage("matching"), 450);

    const result = await createBloodRequestAndFindDonorsAction(parsed.data);
    window.clearTimeout(stageTimer);
    setLoading(false);
    setLoadingStage("idle");
    // Successful create+match redirects; only errors return here.
    if (result?.error) setError(result.error);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Blood group needed
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
        Units needed
        <input
          type="number"
          name="quantityUnits"
          min={1}
          max={20}
          value={quantityUnits}
          onChange={(event) => setQuantityUnits(event.target.value)}
          className={inputClassName}
          required
        />
        {fieldErrors.quantityUnits && (
          <span className="font-normal text-red-600">{fieldErrors.quantityUnits}</span>
        )}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">Urgency</legend>
        <div className="grid grid-cols-3 gap-2">
          {REQUEST_URGENCIES.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center justify-center rounded-xl border px-2 py-3 text-xs font-semibold ${
                urgency === value ? "border-emergency bg-emergency/5 text-emergency" : "border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="urgency"
                value={value}
                checked={urgency === value}
                onChange={() => setUrgency(value)}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
        {fieldErrors.urgency && <span className="text-sm text-red-600">{fieldErrors.urgency}</span>}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Needed by
        <input
          type="datetime-local"
          name="requiredBy"
          value={requiredBy}
          onChange={(event) => setRequiredBy(event.target.value)}
          className={inputClassName}
        />
        <span className="font-normal text-xs text-gray-500">Optional. Used as the request expiry time.</span>
        {fieldErrors.requiredBy && (
          <span className="font-normal text-red-600">{fieldErrors.requiredBy}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Hospital
        <input
          type="text"
          name="hospitalNameFreeform"
          value={hospitalNameFreeform}
          onChange={(event) => setHospitalNameFreeform(event.target.value)}
          placeholder="Hospital or clinic name"
          className={inputClassName}
          required
        />
        {fieldErrors.hospitalNameFreeform && (
          <span className="font-normal text-red-600">{fieldErrors.hospitalNameFreeform}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Contact name
        <input
          type="text"
          name="contactName"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          className={inputClassName}
          required
        />
        {fieldErrors.contactName && (
          <span className="font-normal text-red-600">{fieldErrors.contactName}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Contact phone
        <input
          type="tel"
          name="contactPhone"
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
        Notes
        <textarea
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className={inputClassName}
          placeholder="Optional details for donors"
        />
        {fieldErrors.notes && <span className="font-normal text-red-600">{fieldErrors.notes}</span>}
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
        className="rounded-xl bg-emergency px-6 py-3 font-semibold text-white hover:bg-emergency-hover disabled:opacity-60"
      >
        {mode === "edit"
          ? loading
            ? "Saving…"
            : "Save changes"
          : loading
            ? loadingStage === "matching"
              ? "Finding compatible donors…"
              : "Creating your request…"
            : "Find Donors Now"}
      </button>
      {mode === "create" && !loading && (
        <p className="text-center text-xs text-gray-500">
          Creates your request and searches nearby compatible donors in one step.
        </p>
      )}
    </form>
  );
}
