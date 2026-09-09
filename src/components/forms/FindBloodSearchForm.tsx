"use client";

import { useState } from "react";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from "@/lib/constants/bloodGroups";
import {
  PUBLIC_SEARCH_ORG_TYPES,
  PUBLIC_SEARCH_RADIUS_KM,
  publicBloodSearchSchema,
  type PublicSearchOrgType,
  type PublicSearchRadiusKm,
} from "@/schemas/publicBloodSearch.schema";
import {
  searchPublicBloodAvailabilityAction,
  type PublicBloodSearchResultView,
} from "@/app/(public)/actions";
import { LocationPicker } from "@/components/forms/LocationPicker";
import type { Coordinates } from "@/types/domain";

const inputClassName =
  "w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-emergency focus:ring-1 focus:ring-emergency";

const DISCLAIMER =
  "Availability is indicative and may change. Please confirm with the organization. This does not reserve or guarantee blood.";

export function FindBloodSearchForm() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [radiusKm, setRadiusKm] = useState<PublicSearchRadiusKm>(10);
  const [organizationType, setOrganizationType] = useState<PublicSearchOrgType>("ALL");
  const [results, setResults] = useState<PublicBloodSearchResultView[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResults(null);
    setExpandedId(null);

    if (!location) {
      setFieldErrors({ location: "Choose a location to search nearby blood availability." });
      return;
    }

    const parsed = publicBloodSearchSchema.safeParse({
      bloodGroup: bloodGroup || undefined,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm,
      organizationType,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        bloodGroup: flattened.bloodGroup?.[0] ?? "",
        location: flattened.latitude?.[0] ?? flattened.longitude?.[0] ?? "",
        radiusKm: flattened.radiusKm?.[0] ?? "",
        organizationType: flattened.organizationType?.[0] ?? "",
      });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    const response = await searchPublicBloodAvailabilityAction(parsed.data);
    setLoading(false);

    if ("error" in response) {
      setError(response.error);
      return;
    }

    setResults(response.results);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {DISCLAIMER}
      </p>

      <form onSubmit={onSearch} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Blood group
          <select
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

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-gray-700">Location</legend>
          <LocationPicker value={location} onChange={setLocation} />
          <p className="text-xs text-gray-500">
            Use your location or set a pin. Exact coordinates stay on your device/session and are not
            shown in results.
          </p>
          {fieldErrors.location && (
            <span className="text-sm text-red-600">{fieldErrors.location}</span>
          )}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Search radius
          <select
            value={radiusKm}
            onChange={(event) => setRadiusKm(Number(event.target.value) as PublicSearchRadiusKm)}
            className={inputClassName}
          >
            {PUBLIC_SEARCH_RADIUS_KM.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-gray-700">Organization type</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PUBLIC_SEARCH_ORG_TYPES.map((type) => (
              <label
                key={type}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${
                  organizationType === type ? "border-emergency bg-emergency/5" : "border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="organizationType"
                  value={type}
                  checked={organizationType === type}
                  onChange={() => setOrganizationType(type)}
                  className="accent-emergency"
                />
                {type === "ALL" ? "All" : type === "HOSPITAL" ? "Hospitals" : "Blood banks"}
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emergency px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {results && results.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">No verified organizations with possible availability were found nearby.</p>
          <p className="mt-1">Try a wider radius or a different blood group.</p>
        </div>
      )}

      {results && results.length > 0 && (
        <ul className="flex flex-col gap-3">
          {results.map((item) => {
            const expanded = expandedId === item.organizationId;
            return (
              <li key={`${item.organizationType}:${item.organizationId}`}>
                <article className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900">{item.name}</h2>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                      {item.organizationType === "HOSPITAL" ? "Hospital" : "Blood bank"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{item.distanceLabel}</p>
                  <p className="mt-1 text-sm text-gray-700">{item.address}</p>
                  <p className="mt-2 text-sm font-medium text-green-800">Possible availability</p>
                  {item.freshnessLabel && (
                    <p className="text-xs text-gray-500">{item.freshnessLabel}</p>
                  )}
                  {item.organizationType === "HOSPITAL" && item.has24hEmergency && (
                    <p className="mt-1 text-xs font-medium text-green-700">24h emergency services</p>
                  )}
                  {item.organizationType === "BLOOD_BANK" && item.emergencyHours && (
                    <p className="mt-1 text-xs text-gray-600">Emergency hours: {item.emergencyHours}</p>
                  )}

                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-emergency"
                    onClick={() =>
                      setExpandedId(expanded ? null : item.organizationId)
                    }
                  >
                    {expanded ? "Hide contact" : "Show contact"}
                  </button>

                  {expanded && (
                    <p className="mt-2 text-sm text-gray-800">
                      Phone: <span className="font-medium">{item.phone}</span>
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
