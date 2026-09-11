"use client";

import { useState } from "react";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import { REQUEST_URGENCIES, type RequestUrgency } from "@/lib/constants/requestStatus";
import { createBloodRequestSchema } from "@/schemas/bloodRequest.schema";
import {
  createBloodRequestAndFindDonorsAction,
  updateBloodRequestAction,
} from "@/app/(requester)/actions";
import { LocationPicker } from "@/components/forms/LocationPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";
import type { BloodRequest, Coordinates } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const URGENCY_LABELS: Record<RequestUrgency, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MODERATE: "Moderate",
};

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

/**
 * Create / edit blood request form — presentation only.
 *
 * Create still calls `createBloodRequestAndFindDonorsAction` (redirect on
 * success). Edit still calls `updateBloodRequestAction`. Schema and field
 * set are unchanged.
 */
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
  const [isEmergency, setIsEmergency] = useState(request?.isEmergency ?? false);
  const [location, setLocation] = useState<Coordinates | null>(request?.location ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"idle" | "creating" | "matching">("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
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
      isEmergency,
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

  const createLoadingLabel =
    loadingStage === "matching" ? "Finding compatible donors…" : "Creating your request…";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      <section aria-labelledby="blood-requirement-heading" className="flex flex-col gap-4">
        <SectionHeader
          id="blood-requirement-heading"
          title="Blood requirement"
          description="Which blood group is needed, and how many units."
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-label font-medium text-text">
            Blood group needed <span className="text-danger">*</span>
          </legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Blood group needed">
            {BLOOD_GROUPS.map((group) => {
              const selected = bloodGroup === group;
              return (
                <label
                  key={group}
                  className={cn(
                    "flex min-h-control cursor-pointer items-center justify-center rounded-md border px-2 text-body-strong transition-colors",
                    "focus-within:ring-2 focus-within:ring-info focus-within:ring-offset-1",
                    selected
                      ? "border-primary bg-muted text-text"
                      : "border-border-strong bg-surface text-text-secondary hover:bg-muted"
                  )}
                >
                  <input
                    type="radio"
                    name="bloodGroup"
                    value={group}
                    checked={selected}
                    onChange={() => setBloodGroup(group)}
                    className="sr-only"
                  />
                  {BLOOD_GROUP_LABELS[group]}
                </label>
              );
            })}
          </div>
          {fieldErrors.bloodGroup && (
            <p role="alert" className="text-caption text-danger">
              {fieldErrors.bloodGroup}
            </p>
          )}
        </fieldset>

        <FormField label="Units needed" error={fieldErrors.quantityUnits || null} required>
          {({ id, describedBy, invalid, className, required }) => (
            <input
              id={id}
              type="number"
              name="quantityUnits"
              min={1}
              max={20}
              value={quantityUnits}
              onChange={(event) => setQuantityUnits(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={className}
            />
          )}
        </FormField>
      </section>

      <section aria-labelledby="where-heading" className="flex flex-col gap-4">
        <SectionHeader
          id="where-heading"
          title="Where it is needed"
          description="Hospital or clinic name, plus a location for nearby matching. Exact coordinates are never shown here."
        />

        <FormField
          label="Hospital"
          error={fieldErrors.hospitalNameFreeform || null}
          required
        >
          {({ id, describedBy, invalid, className, required }) => (
            <input
              id={id}
              type="text"
              name="hospitalNameFreeform"
              value={hospitalNameFreeform}
              onChange={(event) => setHospitalNameFreeform(event.target.value)}
              placeholder="Hospital or clinic name"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={className}
            />
          )}
        </FormField>

        <fieldset
          aria-invalid={fieldErrors.location ? true : undefined}
          className="flex flex-col gap-2"
        >
          <legend className="text-label font-medium text-text">
            Location <span className="text-danger">*</span>
          </legend>
          <LocationPicker value={location} onChange={setLocation} />
          {fieldErrors.location && (
            <p role="alert" className="text-caption text-danger">
              {fieldErrors.location}
            </p>
          )}
        </fieldset>
      </section>

      <section aria-labelledby="timing-heading" className="flex flex-col gap-4">
        <SectionHeader
          id="timing-heading"
          title="Timing"
          description="Urgency and optional needed-by time. Needed-by is used as the request expiry when set."
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-label font-medium text-text">Urgency</legend>
          <div className="grid grid-cols-3 gap-2">
            {REQUEST_URGENCIES.map((value) => {
              const selected = urgency === value;
              return (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-control cursor-pointer items-center justify-center rounded-md border px-2 text-label font-medium transition-colors",
                    "focus-within:ring-2 focus-within:ring-info focus-within:ring-offset-1",
                    selected
                      ? "border-primary bg-muted text-text"
                      : "border-border-strong bg-surface text-text-secondary hover:bg-muted"
                  )}
                >
                  <input
                    type="radio"
                    name="urgency"
                    value={value}
                    checked={selected}
                    onChange={() => setUrgency(value)}
                    className="sr-only"
                  />
                  {URGENCY_LABELS[value]}
                </label>
              );
            })}
          </div>
          {fieldErrors.urgency && (
            <p role="alert" className="text-caption text-danger">
              {fieldErrors.urgency}
            </p>
          )}
        </fieldset>

        <FormField
          label="Needed by"
          helperText="Optional. Used as the request expiry time."
          error={fieldErrors.requiredBy || null}
        >
          {({ id, describedBy, invalid, className }) => (
            <input
              id={id}
              type="datetime-local"
              name="requiredBy"
              value={requiredBy}
              onChange={(event) => setRequiredBy(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={className}
            />
          )}
        </FormField>
      </section>

      <section aria-labelledby="emergency-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="emergency-heading"
          title="Emergency response"
          description="Separate from urgency. Only enable when emergency response pathways should be used."
        />

        <button
          type="button"
          role="switch"
          aria-checked={isEmergency}
          aria-label="Emergency request"
          onClick={() => setIsEmergency((value) => !value)}
          className={cn(
            "flex min-h-control w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1",
            isEmergency
              ? "border-emergency/30 bg-emergency-surface"
              : "border-border-strong bg-surface hover:bg-muted"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border",
              isEmergency
                ? "border-emergency bg-emergency text-white"
                : "border-border-strong bg-surface"
            )}
            aria-hidden
          >
            {isEmergency && <Icon name="check" className="h-3.5 w-3.5" />}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-body-strong text-text">Emergency request</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-sm border px-2 py-0.5 text-caption font-medium",
                  isEmergency
                    ? "border-emergency/25 bg-surface text-emergency"
                    : "border-border bg-muted text-text-secondary"
                )}
              >
                {isEmergency ? "On" : "Off"}
              </span>
            </span>
            <span className="text-caption text-text-secondary">
              {isEmergency
                ? "On — donors who opted into Emergency Response may be notified, including donors who may currently be marked unavailable for normal matching."
                : "Off — this stays a normal request. Matching uses standard availability."}
            </span>
            {urgency === "CRITICAL" && !isEmergency && (
              <span className="text-caption text-warning">
                Critical urgency — consider enabling Emergency Response if the situation needs it.
              </span>
            )}
          </span>
        </button>
      </section>

      <section aria-labelledby="details-heading" className="flex flex-col gap-4">
        <SectionHeader
          id="details-heading"
          title="Contact and notes"
          description="Who donors or coordinators should reach, and any useful clinical context."
        />

        <FormField label="Contact name" error={fieldErrors.contactName || null} required>
          {({ id, describedBy, invalid, className, required }) => (
            <input
              id={id}
              type="text"
              name="contactName"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={className}
            />
          )}
        </FormField>

        <FormField label="Contact phone" error={fieldErrors.contactPhone || null} required>
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

        <FormField
          label="Notes"
          helperText="Optional. Useful details for donors (ward, patient context). Max 500 characters."
          error={fieldErrors.notes || null}
        >
          {({ id, describedBy, invalid, className }) => (
            <textarea
              id={id}
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Optional details for donors"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={className}
            />
          )}
        </FormField>
      </section>

      {error && (
        <Alert variant="danger" title="Could not submit">
          {error}
        </Alert>
      )}
      {info && <Alert variant="success">{info}</Alert>}

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          variant={mode === "create" && isEmergency ? "emergency" : "primary"}
          fullWidth
          loading={loading}
          loadingLabel={mode === "edit" ? "Saving…" : createLoadingLabel}
          disabled={loading}
        >
          {mode === "edit" ? "Save changes" : "Find Donors Now"}
        </Button>
        {mode === "create" && !loading && (
          <p className="text-center text-caption text-text-tertiary">
            Creates your request and searches nearby compatible donors in one step.
          </p>
        )}
      </div>
    </form>
  );
}
