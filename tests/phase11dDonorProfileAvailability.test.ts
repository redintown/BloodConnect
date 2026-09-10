import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { DONOR_NAV_SECTIONS } from "@/components/nav/donorNav";
import { flattenNavSections } from "@/components/nav/navConfig";
import { EMERGENCY_RADIUS_KM_OPTIONS } from "@/lib/matching/emergencyCriteria";
import { BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function readCode(rel: string) {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const PROFILE_PAGE = "src/app/(donor)/donor/profile/page.tsx";
const AVAIL_PAGE = "src/app/(donor)/donor/availability/page.tsx";
const PROFILE_FORM = "src/components/forms/DonorProfileForm.tsx";
const AVAIL_FORM = "src/components/forms/AvailabilitySelector.tsx";
const LOCATION = "src/components/forms/LocationPicker.tsx";
const DASHBOARD = "src/app/(donor)/donor/page.tsx";
const POPUP = "src/components/forms/DonorMatchPopup.tsx";
const OVERLAY = "src/components/forms/DonorPortalMatchOverlay.tsx";
const REQUESTS = "src/app/(donor)/donor/requests/page.tsx";
const HISTORY = "src/app/(donor)/donor/history/page.tsx";
const ACTIONS = "src/app/(donor)/actions.ts";

describe("Phase 11D Step 3 — profile route", () => {
  const page = read(PROFILE_PAGE);
  const form = read(PROFILE_FORM);
  const formCode = readCode(PROFILE_FORM);

  it("renders the profile route with PageHeader and existing form", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Donor profile");
    expect(page).toContain("DonorProfileForm");
    expect(page).toContain("donorService.getOwnProfile");
    expect(page).toContain('requireRole("DONOR")');
  });

  it("marks Profile as an existing nav destination", () => {
    const items = flattenNavSections(DONOR_NAV_SECTIONS);
    expect(items.some((i) => i.href === "/donor/profile")).toBe(true);
  });

  it("presents blood groups with human labels, not raw enums", () => {
    expect(form).toContain("BLOOD_GROUP_LABELS");
    expect(formCode).not.toContain("O_NEGATIVE");
    expect(Object.values(BLOOD_GROUP_LABELS).some((l) => l.includes("−") || l.includes("-"))).toBe(
      true
    );
  });

  it("shows eligibility from saved profile DTO without client 56-day boolean", () => {
    expect(form).toContain("profile.isEligible");
    expect(formCode).not.toContain("isEligibleFromLastDonation");
    expect(formCode).not.toContain("MIN_DAYS_BETWEEN_DONATIONS");
  });

  it("distinguishes verification states with human-readable treatment", () => {
    expect(form).toContain('verificationStatus === "UNVERIFIED"');
    expect(form).toContain('verificationStatus === "PENDING"');
    expect(form).toContain('verificationStatus === "VERIFIED"');
    expect(form).toContain('verificationStatus === "REJECTED"');
    expect(form).toContain("StatusChip");
    expect(form).toContain("kind=\"verification\"");
    expect(form).toContain("Donor account is not automatically verified.");
    expect(form).toContain("Resubmit for verification");
  });

  it("shows location as Set / Not set without exact coordinates", () => {
    expect(form).toContain('"Set"');
    expect(form).toContain('"Not set"');
    expect(formCode).not.toContain("toFixed");
    expect(formCode).not.toContain(".latitude");
    expect(readCode(LOCATION)).not.toContain("toFixed");
    expect(read(LOCATION)).toContain("Location set");
  });

  it("does not expose UUIDs or invent donation history queries", () => {
    expect(formCode).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(formCode).not.toContain("getDonationHistory");
    expect(form).toContain("No donation recorded");
  });

  it("uses shared form primitives and explicit save with loading/error/success", () => {
    expect(form).toContain("FormField");
    expect(form).toContain("Button");
    expect(form).toContain("Alert");
    expect(form).toContain("SectionHeader");
    expect(form).toContain("saveDonorProfileAction");
    expect(form).toContain("submitDonorVerificationAction");
    expect(form).toContain("loading={loading}");
    expect(form).toContain("loadingLabel=\"Saving…\"");
    expect(form).toContain("Profile saved.");
    expect(form).toContain('variant="danger"');
    expect(form).toContain("if (loading) return");
  });

  it("does not invent profile fields beyond the existing schema", () => {
    expect(form).toContain("donorProfileSchema");
    expect(formCode).not.toContain("phone");
    expect(formCode).not.toContain("email");
    expect(formCode).not.toContain("nationalId");
  });
});

describe("Phase 11D Step 3 — availability route", () => {
  const page = read(AVAIL_PAGE);
  const form = read(AVAIL_FORM);
  const formCode = readCode(AVAIL_FORM);

  it("renders availability with PageHeader and existing selector", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Availability");
    expect(page).toContain("AvailabilitySelector");
    expect(page).toContain("donorService.getOwnProfile");
  });

  it("marks Availability as an existing nav destination", () => {
    const items = flattenNavSections(DONOR_NAV_SECTIONS);
    expect(items.some((i) => i.href === "/donor/availability")).toBe(true);
  });

  it("separates normal availability from Emergency Response", () => {
    expect(form).toContain("Normal availability");
    expect(form).toContain("Emergency Response");
    expect(form).toContain(
      "Emergency requests can reach you even when normal availability is off"
    );
    expect(form).toContain("does not disable Emergency Response");
    const normalIdx = form.indexOf("Normal availability");
    const emergencyIdx = form.indexOf('title="Emergency Response"');
    expect(normalIdx).toBeGreaterThan(-1);
    expect(emergencyIdx).toBeGreaterThan(normalIdx);
  });

  it("uses accessible switches with On/Off labels", () => {
    expect(form).toContain('role="switch"');
    expect(form).toContain("aria-checked");
    expect(form).toContain("aria-label");
    expect(form).toContain('"On"');
    expect(form).toContain('"Off"');
    expect(form).toContain("min-h-control");
  });

  it("preserves emergency radius options and explicit dual-save actions", () => {
    expect(form).toContain("EMERGENCY_RADIUS_KM_OPTIONS");
    for (const km of EMERGENCY_RADIUS_KM_OPTIONS) {
      expect(form).toContain(`{km} km`);
    }
    expect(form).toContain("saveDonorAvailabilityAction");
    expect(form).toContain("saveDonorEmergencySettingsAction");
    expect(form).toContain("Save settings");
    expect(form).toContain("if (loading) return");
    expect(formCode).not.toContain("useEffect");
    expect(formCode).not.toContain("debounce");
  });

  it("does not show coordinates or raw enum strings", () => {
    expect(formCode).not.toContain("toFixed");
    expect(formCode).not.toContain("latitude");
    expect(formCode).not.toContain("longitude");
    expect(formCode).not.toContain("O_NEGATIVE");
  });

  it("surfaces loading, error, and success feedback", () => {
    expect(form).toContain("loading={loading}");
    expect(form).toContain("Could not save");
    expect(form).toContain("Availability and emergency response settings saved.");
  });
});

describe("Phase 11D Step 3 — a11y and layout guards", () => {
  it("uses semantic headings via PageHeader and SectionHeader", () => {
    expect(read(PROFILE_PAGE)).toContain("PageHeader");
    expect(read(AVAIL_PAGE)).toContain("PageHeader");
    expect(read(PROFILE_FORM)).toContain("SectionHeader");
    expect(read(AVAIL_FORM)).toContain("SectionHeader");
    expect(read(PROFILE_FORM)).toContain("aria-labelledby");
    expect(read(AVAIL_FORM)).toContain("aria-labelledby");
  });

  it("wires FormField accessibility attributes on profile controls", () => {
    const form = read(PROFILE_FORM);
    expect(form).toContain("aria-describedby");
    expect(form).toContain("aria-invalid");
  });

  it("avoids max-w-lg as the page container", () => {
    expect(readCode(PROFILE_PAGE)).not.toContain("max-w-lg");
    expect(readCode(AVAIL_PAGE)).not.toContain("max-w-lg");
  });
});

describe("Phase 11D Step 3 — boundary: no backend or sibling UI drift", () => {
  it("does not modify donor actions", () => {
    const actions = read(ACTIONS);
    expect(actions).toContain("saveDonorProfileAction");
    expect(actions).toContain("saveDonorAvailabilityAction");
    expect(actions).toContain("saveDonorEmergencySettingsAction");
    expect(actions).toContain("submitDonorVerificationAction");
  });

  it("leaves dashboard, match popup, overlay, requests, and history wiring intact", () => {
    expect(read(DASHBOARD)).toContain("Your donor dashboard");
    expect(read(POPUP)).toContain("DonorMatchPopup");
    expect(read(OVERLAY)).toContain("DonorPortalMatchOverlay");
    expect(read(REQUESTS).length).toBeGreaterThan(0);
    expect(read(HISTORY).length).toBeGreaterThan(0);
  });

  it("keeps LocationPicker on geolocation without exposing coordinates", () => {
    const picker = readCode(LOCATION);
    expect(picker).toContain("useGeolocation");
    expect(picker).not.toContain("toFixed");
    expect(picker).not.toContain("Google");
    expect(picker).not.toContain("geocod");
  });
});
