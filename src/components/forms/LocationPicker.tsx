"use client";

import { useEffect } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icon";

/**
 * Shared location control for donor/org/request forms.
 *
 * Coordinates are held in form state and submitted to existing actions —
 * they are never rendered as latitude/longitude text. The UI only shows
 * whether a location is set.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value?: { latitude: number; longitude: number } | null;
  onChange?: (coords: { latitude: number; longitude: number } | null) => void;
}) {
  const { coordinates, loading, error, request } = useGeolocation();
  const hasLocation = value != null;

  useEffect(() => {
    if (coordinates) onChange?.(coordinates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates]);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        fullWidth
        onClick={request}
        loading={loading}
        loadingLabel="Getting location…"
      >
        {hasLocation ? "Update my location" : "Use my current location"}
      </Button>

      {hasLocation && (
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-caption text-success">
            <Icon name="check" className="h-4 w-4" />
            Location set
            <span className="text-text-tertiary">
              — exact coordinates stay private and are never shown here.
            </span>
          </p>
          <button
            type="button"
            onClick={() => onChange?.(null)}
            className="inline-flex min-h-control shrink-0 items-center rounded-md px-2 text-label text-text-secondary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
          >
            Clear
          </button>
        </div>
      )}

      {!hasLocation && (
        <p className="text-caption text-text-tertiary">
          Matching needs a location. Your exact coordinates are never shown to other people.
        </p>
      )}

      {error && (
        <Alert variant="warning" title="Location unavailable">
          {error}
        </Alert>
      )}
    </div>
  );
}
