"use client";

import { useState } from "react";
import { availabilitySchema } from "@/schemas/availability.schema";
import { saveDonorAvailabilityAction } from "@/app/(donor)/actions";

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
}: {
  isAvailable: boolean;
  isAvailableAtNight: boolean;
}) {
  const [available, setAvailable] = useState(isAvailable);
  const [night, setNight] = useState(isAvailableAtNight && isAvailable);
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

    const parsed = availabilitySchema.safeParse({
      isAvailable: available,
      isAvailableAtNight: night,
    });
    if (!parsed.success) {
      setError("Invalid input");
      return;
    }

    setLoading(true);
    const result = await saveDonorAvailabilityAction(parsed.data);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setInfo("Availability saved.");
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
        {loading ? "Saving…" : "Save availability"}
      </button>
    </form>
  );
}
