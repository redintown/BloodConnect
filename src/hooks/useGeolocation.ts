"use client";

import { useCallback, useState } from "react";
import type { Coordinates } from "@/types/domain";

interface UseGeolocationState {
  coordinates: Coordinates | null;
  loading: boolean;
  error: string | null;
  request: () => void;
}

/**
 * Thin wrapper around the Browser Geolocation API for the LocationPicker
 * component. Kept separate from locationService (which is import-safe on
 * the server) because this one touches `navigator` directly.
 */
export function useGeolocation(): UseGeolocationState {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Location isn't supported on this device.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLoading(false);
      },
      () => {
        setError("Couldn't get your location. Please allow location access and try again.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  return { coordinates, loading, error, request };
}
