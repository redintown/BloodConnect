"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
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
import { useGeolocation } from "@/hooks/useGeolocation";
import type { Coordinates } from "@/types/domain";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SkeletonPanel } from "@/components/ui/Skeleton";

/**
 * Public blood availability search — presentation only.
 *
 * The data contract is unchanged: the same four filters go through
 * `publicBloodSearchSchema` into the existing
 * `searchPublicBloodAvailabilityAction`, and only the fields that action
 * already returns are rendered. Nothing here queries the database, widens
 * the search, or reinterprets a result.
 *
 * Privacy constraints that the layout must keep honouring:
 *  - distance is shown only through the server's coarse `distanceLabel`
 *    ("N km away"); the raw `distanceKmRounded` number is never rendered;
 *  - `organizationId` is a key, never output;
 *  - inventory freshness is shown through the server's `freshnessLabel`,
 *    never as a unit count or a raw timestamp;
 *  - the phone belongs to a verified organization (not a donor) and stays
 *    behind the existing expand-only "Show contact" control.
 *
 * Location comes from the shared `useGeolocation` hook — the same mechanism
 * LocationPicker uses — rather than the LocationPicker component itself,
 * because that component is still shared with four portal forms that this
 * step must not restyle.
 */
const DISCLAIMER =
  "Availability is indicative and may change. Please confirm with the organization. This does not reserve or guarantee blood.";

/** Existing filter labels, unchanged. Values stay the schema's enum. */
const ORG_TYPE_LABELS: Record<PublicSearchOrgType, string> = {
  ALL: "All",
  HOSPITAL: "Hospitals",
  BLOOD_BANK: "Blood banks",
};

interface SearchedQuery {
  bloodGroup: BloodGroup;
  radiusKm: PublicSearchRadiusKm;
}

export function FindBloodSearchForm() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">("");
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [radiusKm, setRadiusKm] = useState<PublicSearchRadiusKm>(10);
  const [organizationType, setOrganizationType] = useState<PublicSearchOrgType>("ALL");
  const [results, setResults] = useState<PublicBloodSearchResultView[] | null>(null);
  const [searched, setSearched] = useState<SearchedQuery | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    coordinates,
    loading: locating,
    error: locationError,
    request: requestLocation,
  } = useGeolocation();

  useEffect(() => {
    if (coordinates) setLocation(coordinates);
  }, [coordinates]);

  async function runSearch() {
    // Guards a second submit while the action is already in flight.
    if (loading) return;
    setError(null);
    setResults(null);
    setExpandedId(null);

    // Both requirements are reported together so the first field is never
    // silently blamed for the second one's absence.
    const missing: Record<string, string> = {};
    if (!bloodGroup) missing.bloodGroup = "Select the blood group you need.";
    if (!location) missing.location = "Choose a location to search nearby blood availability.";
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      return;
    }

    const parsed = publicBloodSearchSchema.safeParse({
      bloodGroup: bloodGroup || undefined,
      latitude: location?.latitude,
      longitude: location?.longitude,
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

    setSearched({ bloodGroup: parsed.data.bloodGroup, radiusKm: parsed.data.radiusKm });
    setResults(response.results);
  }

  const resultCount = results?.length;

  // One announcement per outcome. The loading case is announced by
  // SkeletonPanel's own status region, so it is skipped here.
  const liveMessage =
    loading || results === null
      ? ""
      : resultCount === 0
        ? "No matching organizations found for this search."
        : `${resultCount} organization${resultCount === 1 ? "" : "s"} found.`;

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="warning">{DISCLAIMER}</Alert>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch();
          }}
          noValidate
          aria-label="Blood availability search"
          className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 sm:p-5 lg:sticky lg:top-6 lg:col-span-1"
        >
          <fieldset
            aria-describedby={fieldErrors.bloodGroup ? "blood-group-error" : undefined}
            aria-invalid={fieldErrors.bloodGroup ? true : undefined}
            className="flex flex-col gap-2"
          >
            <legend className="text-label text-text">Blood group</legend>

            {/* Two rows of four keeps every group tappable at 360px while
                staying scannable as a group matrix. Labels are the existing
                display labels; the submitted value is the unchanged enum. */}
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_GROUPS.map((group) => {
                const selected = bloodGroup === group;
                return (
                  <label
                    key={group}
                    className={cn(
                      "flex min-h-control cursor-pointer items-center justify-center rounded-md border text-blood-group transition-colors",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info has-[:focus-visible]:ring-offset-1",
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
              <p id="blood-group-error" role="alert" className="text-caption text-danger">
                {fieldErrors.bloodGroup}
              </p>
            )}
          </fieldset>

          <fieldset
            aria-describedby={
              fieldErrors.location ? "location-help location-error" : "location-help"
            }
            aria-invalid={fieldErrors.location ? true : undefined}
            className="flex flex-col gap-2"
          >
            <legend className="text-label text-text">Location</legend>

            <p id="location-help" className="text-caption text-text-tertiary">
              Results are ordered by distance, so the search needs your location. Your coordinates
              stay on your device and never appear in results.
            </p>

            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={requestLocation}
              loading={locating}
              loadingLabel="Getting location…"
            >
              {location ? "Update my location" : "Use my current location"}
            </Button>

            {location && (
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-caption text-success">
                  <Icon name="check" className="h-4 w-4" />
                  Using your current location
                </p>
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  className="inline-flex min-h-control items-center rounded-md px-2 text-label text-text-secondary hover:bg-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
                >
                  Clear
                </button>
              </div>
            )}

            {locationError && (
              <Alert variant="warning" title="Location unavailable">
                {locationError}{" "}
                <Link href="/request-blood" className="font-medium text-text underline underline-offset-4">
                  Create a blood request
                </Link>{" "}
                instead if you cannot share it.
              </Alert>
            )}

            {fieldErrors.location && (
              <p id="location-error" role="alert" className="text-caption text-danger">
                {fieldErrors.location}
              </p>
            )}
          </fieldset>

          <FormField label="Search radius" error={fieldErrors.radiusKm || null}>
            {({ id, describedBy, invalid, className }) => (
              <select
                id={id}
                value={radiusKm}
                onChange={(event) =>
                  setRadiusKm(Number(event.target.value) as PublicSearchRadiusKm)
                }
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className={className}
              >
                {PUBLIC_SEARCH_RADIUS_KM.map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-label text-text">Organization type</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {PUBLIC_SEARCH_ORG_TYPES.map((type) => {
                const selected = organizationType === type;
                return (
                  <label
                    key={type}
                    className={cn(
                      "flex min-h-control cursor-pointer items-center justify-center rounded-md border px-2 text-label transition-colors",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info has-[:focus-visible]:ring-offset-1",
                      selected
                        ? "border-primary bg-muted text-text"
                        : "border-border-strong bg-surface text-text-secondary hover:bg-muted"
                    )}
                  >
                    <input
                      type="radio"
                      name="organizationType"
                      value={type}
                      checked={selected}
                      onChange={() => setOrganizationType(type)}
                      className="sr-only"
                    />
                    {ORG_TYPE_LABELS[type]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" fullWidth loading={loading} loadingLabel="Searching…">
            Search blood
          </Button>
        </form>

        <section
          aria-labelledby="results-heading"
          aria-busy={loading || undefined}
          className="flex flex-col gap-3 lg:col-span-2"
        >
          <SectionHeader
            id="results-heading"
            title="Results"
            count={resultCount}
            description={
              searched
                ? `Possible ${BLOOD_GROUP_LABELS[searched.bloodGroup]} stock within ${searched.radiusKm} km.`
                : undefined
            }
          />

          <p aria-live="polite" className="sr-only">
            {liveMessage}
          </p>

          {loading && <SkeletonPanel label="Searching for blood availability…" rows={3} />}

          {!loading && error && (
            <ErrorState
              title="Search failed"
              message={error}
              onRetry={() => void runSearch()}
              retryLabel="Try again"
            />
          )}

          {!loading && !error && results === null && (
            <EmptyState
              icon="search"
              title="Start a search"
              description="Pick the blood group you need and share your location, then search verified hospitals and blood banks nearby."
            />
          )}

          {!loading && !error && results !== null && results.length === 0 && (
            <EmptyState
              icon="search"
              title="No blood found nearby"
              description={
                searched
                  ? `No verified organization within ${searched.radiusKm} km reported possible ${BLOOD_GROUP_LABELS[searched.bloodGroup]} stock. That covers this search only — try a wider radius, a different blood group, or all organization types.`
                  : "No verified organizations with possible availability were found nearby. Try a wider radius or a different blood group."
              }
              action={
                <Link
                  href="/request-blood"
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  Create a blood request
                </Link>
              }
            />
          )}

          {!loading && !error && results !== null && results.length > 0 && (
            <ul className="grid gap-3 md:grid-cols-2">
              {results.map((item, index) => {
                const expanded = expandedId === item.organizationId;
                // Index-based so no identifier reaches the DOM at all.
                const contactId = `find-blood-contact-${index}`;

                return (
                  <li key={`${item.organizationType}:${item.organizationId}`}>
                    <article className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="text-h3 text-text">{item.name}</h3>
                        <span className="inline-flex shrink-0 items-center rounded-sm border border-border bg-muted px-2 py-0.5 text-caption font-medium text-text-secondary">
                          {item.organizationType === "HOSPITAL" ? "Hospital" : "Blood bank"}
                        </span>
                      </div>

                      {/* Server-formatted coarse distance only — never the
                          underlying rounded kilometre number. */}
                      <p className="text-body-strong text-text">{item.distanceLabel}</p>

                      <p className="flex items-start gap-1.5 text-label font-normal text-text-secondary">
                        <Icon name="building" className="mt-px h-4 w-4" />
                        {item.address}
                      </p>

                      <span className="inline-flex w-fit items-center gap-1.5 rounded-sm border border-success/20 bg-success-surface px-2 py-0.5 text-caption font-medium text-success">
                        <Icon name="check" className="h-3.5 w-3.5" />
                        Possible availability
                      </span>

                      {item.freshnessLabel && (
                        <p className="text-caption text-text-tertiary">{item.freshnessLabel}</p>
                      )}

                      {item.organizationType === "HOSPITAL" && item.has24hEmergency && (
                        <p className="flex items-center gap-1.5 text-caption text-text-secondary">
                          <Icon name="clock" className="h-3.5 w-3.5" />
                          24h emergency services
                        </p>
                      )}

                      {item.organizationType === "BLOOD_BANK" && item.emergencyHours && (
                        <p className="flex items-center gap-1.5 text-caption text-text-secondary">
                          <Icon name="clock" className="h-3.5 w-3.5" />
                          Emergency hours: {item.emergencyHours}
                        </p>
                      )}

                      <div className="mt-auto flex flex-col gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-expanded={expanded}
                          aria-controls={contactId}
                          onClick={() => setExpandedId(expanded ? null : item.organizationId)}
                        >
                          {expanded ? "Hide contact" : "Show contact"}
                        </Button>

                        {expanded && (
                          <p id={contactId} className="text-label font-normal text-text-secondary">
                            Phone:{" "}
                            <a
                              href={`tel:${item.phone}`}
                              className="font-medium text-text underline underline-offset-4"
                            >
                              {item.phone}
                            </a>
                          </p>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
