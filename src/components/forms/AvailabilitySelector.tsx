"use client";

import { useState } from "react";
import { availabilitySchema, emergencySettingsSchema } from "@/schemas/availability.schema";
import {
  saveDonorAvailabilityAction,
  saveDonorEmergencySettingsAction,
} from "@/app/(donor)/actions";
import { EMERGENCY_RADIUS_KM_OPTIONS } from "@/lib/matching/emergencyCriteria";

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${
        checked ? "border-emergency bg-emergency/5" : "border-gray-300"
      } disabled:opacity-50`}
    >
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        <span className="block text-xs text-gray-500">{description}</span>
      </span>
      <span className={`h-3 w-3 rounded-full ${checked ? "bg-emergency" : "bg-gray-300"}`} />
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
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <ToggleRow
        label="Available to donate"
        description="Nearby matching requests can include you."
        checked={available}
        onChange={onAvailableChange}
      />
      <ToggleRow
        label="Available at night"
        description="Include me in night-time emergency matching."
        checked={night}
        disabled={!available}
        onChange={setNight}
      />

      <div className="mt-2 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">Emergency Response</h3>
        <p className="mt-1 text-xs text-gray-500">
          When enabled, you may receive urgent blood requests even when your normal availability is
          off. You always choose whether to accept.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <ToggleRow
            label={emergencyOn ? "ON" : "OFF"}
            description="Independent of normal availability — turning this on does not mark you available."
            checked={emergencyOn}
            onChange={setEmergencyOn}
          />
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Emergency radius
            <select
              value={radiusKm}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              disabled={!emergencyOn}
              className="rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-emergency focus:ring-1 focus:ring-emergency disabled:opacity-50"
            >
              {EMERGENCY_RADIUS_KM_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

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
        {loading ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
