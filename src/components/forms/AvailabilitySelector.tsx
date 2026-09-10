"use client";

import { useState } from "react";
import { availabilitySchema, emergencySettingsSchema } from "@/schemas/availability.schema";
import {
  saveDonorAvailabilityAction,
  saveDonorEmergencySettingsAction,
} from "@/app/(donor)/actions";
import { EMERGENCY_RADIUS_KM_OPTIONS } from "@/lib/matching/emergencyCriteria";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils/cn";

/**
 * Normal availability + Emergency Response settings.
 *
 * Two separate concepts, saved through the existing actions:
 * `saveDonorAvailabilityAction` then `saveDonorEmergencySettingsAction`.
 * Explicit save only — no auto-save.
 */
function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
  tone = "default",
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  tone?: "default" | "emergency";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-control w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? tone === "emergency"
            ? "border-emergency/25 bg-emergency-surface"
            : "border-success/20 bg-success-surface"
          : "border-border-strong bg-surface hover:bg-muted"
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-strong text-text">{label}</span>
        <span className="text-caption text-text-secondary">{description}</span>
      </span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-sm border px-2 py-0.5 text-caption font-medium",
          checked
            ? tone === "emergency"
              ? "border-emergency/25 bg-surface text-emergency"
              : "border-success/20 bg-surface text-success"
            : "border-border bg-muted text-text-secondary"
        )}
      >
        {checked ? "On" : "Off"}
      </span>
    </button>
  );
}

export function AvailabilitySelector({
  isAvailable,
  isAvailableAtNight,
  emergencyResponseEnabled,
  emergencyRadiusKm,
}: {
  isAvailable: boolean;
  isAvailableAtNight: boolean;
  emergencyResponseEnabled: boolean;
  emergencyRadiusKm: number;
}) {
  const [available, setAvailable] = useState(isAvailable);
  const [night, setNight] = useState(isAvailableAtNight && isAvailable);
  const [emergencyOn, setEmergencyOn] = useState(emergencyResponseEnabled);
  const [radiusKm, setRadiusKm] = useState(emergencyRadiusKm);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onAvailableChange(value: boolean) {
    setAvailable(value);
    if (!value) setNight(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setInfo(null);

    const availability = availabilitySchema.safeParse({
      isAvailable: available,
      isAvailableAtNight: night,
    });
    const emergency = emergencySettingsSchema.safeParse({
      emergencyResponseEnabled: emergencyOn,
      emergencyRadiusKm: radiusKm,
    });
    if (!availability.success || !emergency.success) {
      setError("Invalid input");
      return;
    }

    setLoading(true);
    const availResult = await saveDonorAvailabilityAction(availability.data);
    if ("error" in availResult) {
      setLoading(false);
      setError(availResult.error);
      return;
    }

    const emergencyResult = await saveDonorEmergencySettingsAction(emergency.data);
    setLoading(false);
    if ("error" in emergencyResult) {
      setError(emergencyResult.error);
      return;
    }
    setInfo("Availability and emergency response settings saved.");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      <section aria-labelledby="normal-availability-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="normal-availability-heading"
          title="Normal availability"
          description="Controls whether you appear in normal matching. Turning this off does not disable Emergency Response."
        />

        <ToggleRow
          label="Available to donate"
          description="Nearby matching requests can include you."
          checked={available}
          onChange={onAvailableChange}
        />
        <ToggleRow
          label="Available at night"
          description="Include me in night-time matching when I am available."
          checked={night}
          disabled={!available}
          onChange={setNight}
        />
      </section>

      <section
        aria-labelledby="emergency-response-heading"
        className="flex flex-col gap-3 border-t border-border pt-8"
      >
        <SectionHeader
          id="emergency-response-heading"
          title="Emergency Response"
          description="Emergency requests can reach you even when normal availability is off. You always choose whether to accept."
        />

        <ToggleRow
          label="Emergency Response"
          description={
            emergencyOn
              ? "On — urgent requests within your radius can reach you."
              : "Off — emergency matching will not include you."
          }
          checked={emergencyOn}
          onChange={setEmergencyOn}
          tone="emergency"
        />

        <FormField
          label="Emergency radius"
          helperText="How far you are willing to travel for emergency requests."
        >
          {({ id, describedBy, className }) => (
            <select
              id={id}
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              disabled={!emergencyOn}
              aria-describedby={describedBy}
              className={className}
            >
              {EMERGENCY_RADIUS_KM_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </select>
          )}
        </FormField>
      </section>

      {error && (
        <Alert variant="danger" title="Could not save">
          {error}
        </Alert>
      )}
      {info && <Alert variant="success">{info}</Alert>}

      <Button type="submit" fullWidth loading={loading} loadingLabel="Saving…">
        Save settings
      </Button>
    </form>
  );
}
