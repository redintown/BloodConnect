"use client";

import { useEffect } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";

/**
 * Dumb location widget: it exposes coordinates via onChange and has no
 * opinion about where they're used, so the same component works for a donor
 * setting their home area and a requester pinning a hospital.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value?: { latitude: number; longitude: number } | null;
  onChange?: (coords: { latitude: number; longitude: number } | null) => void;
}) {
  const { coordinates, loading, error, request } = useGeolocation();
  const display = value ?? null;

  useEffect(() => {
    if (coordinates) onChange?.(coordinates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={request}
        className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {loading ? "Getting location…" : display ? "Update my location" : "Use my current location"}
      </button>
      {display && (
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
          <p>
            {display.latitude.toFixed(4)}, {display.longitude.toFixed(4)}
            <span className="block text-gray-400">Exact location is visible only to you.</span>
          </p>
          <button
            type="button"
            onClick={() => onChange?.(null)}
            className="shrink-0 font-medium text-gray-600 hover:text-emergency"
          >
            Clear
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
