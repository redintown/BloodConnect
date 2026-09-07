import { NotImplementedError } from "@/lib/errors/AppError";
import type { Coordinates } from "@/types/domain";

/**
 * The ONLY module allowed to know about raw geo math / PostGIS query
 * shapes. UI code asks locationService for "nearby donors" or "distance",
 * never writes geo SQL itself.
 *
 * getBrowserLocation runs client-side (wraps the Geolocation API); the
 * rest are server-side helpers over PostGIS. Splitting them here — rather
 * than in a hook — means server code (escalation, matching) can reuse the
 * same distance logic the UI does.
 */
export interface LocationService {
  getBrowserLocation(): Promise<Coordinates>;
  distanceKm(a: Coordinates, b: Coordinates): number;
  findNearby(center: Coordinates, radiusKm: number): Promise<unknown[]>;
  encodeWgs84Point(coords: Coordinates): string;
  decodeWgs84Point(value: unknown): Coordinates | null;
}

export const locationService: LocationService = {
  async getBrowserLocation() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      throw new Error("Geolocation is not available in this environment.");
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10_000 }
      );
    });
  },
  distanceKm(a, b) {
    // Haversine formula — good enough for "nearby" ranking; PostGIS is used
    // for the actual indexed nearest-neighbour query in findNearby.
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  },
  async findNearby() {
    throw new NotImplementedError("locationService.findNearby");
  },
  encodeWgs84Point(coords) {
    return `SRID=4326;POINT(${coords.longitude} ${coords.latitude})`;
  },
  decodeWgs84Point(value) {
    if (!value) return null;
    if (
      typeof value === "object" &&
      value !== null &&
      "coordinates" in value &&
      Array.isArray((value as { coordinates: unknown }).coordinates)
    ) {
      const [longitude, latitude] = (value as { coordinates: unknown[] }).coordinates;
      if (typeof latitude === "number" && typeof longitude === "number") {
        return { latitude, longitude };
      }
    }
    if (typeof value === "object" && value !== null && "latitude" in value && "longitude" in value) {
      const { latitude, longitude } = value as { latitude: unknown; longitude: unknown };
      if (typeof latitude === "number" && typeof longitude === "number") {
        return { latitude, longitude };
      }
    }
    return null;
  },
};
