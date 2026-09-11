import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";
import { REQUESTER_NAV_SECTIONS } from "@/components/nav/requesterNav";
import { flattenNavSections } from "@/components/nav/navConfig";

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

const PAGE = "src/app/(requester)/request-blood/page.tsx";
const FORM = "src/components/forms/BloodRequestForm.tsx";
const SCHEMA = "src/schemas/bloodRequest.schema.ts";
const ACTIONS = "src/app/(requester)/actions.ts";
const DASHBOARD = "src/app/(requester)/requests/page.tsx";
const LAYOUT = "src/app/(requester)/layout.tsx";
const NAV = "src/components/nav/requesterNav.ts";
const DETAIL = "src/app/(requester)/requests/[id]/page.tsx";

const DONOR_DASHBOARD = "src/app/(donor)/donor/page.tsx";
const DONOR_POPUP = "src/components/forms/DonorMatchPopup.tsx";

describe("Phase 11E Step 2 — create request route", () => {
  const page = read(PAGE);
  const form = read(FORM);
  const formCode = readCode(FORM);

  it("renders Request blood with PageHeader and existing form", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Request blood");
    expect(page).toContain("BloodRequestForm");
    expect(page).toContain('mode="create"');
    expect(page).toContain('href="/requests"');
  });

  it("keeps New request in requester nav without inventing routes", () => {
    const items = flattenNavSections(REQUESTER_NAV_SECTIONS);
    expect(items.some((i) => i.href === "/request-blood")).toBe(true);
    expect(read(NAV)).not.toContain('"/requester"');
  });

  it("presents blood groups with human labels via chip radios", () => {
    expect(form).toContain("BLOOD_GROUP_LABELS");
    expect(form).toContain('type="radio"');
    expect(form).toContain('name="bloodGroup"');
    for (const group of BLOOD_GROUPS) {
      expect(Object.values(BLOOD_GROUP_LABELS)).toContain(BLOOD_GROUP_LABELS[group]);
    }
    expect(formCode).not.toContain(">A_POS<");
    expect(formCode).not.toContain(">O_NEG<");
  });

  it("keeps quantity, location, timing, contact, notes, and emergency fields", () => {
    expect(form).toContain("Units needed");
    expect(form).toContain("LocationPicker");
    expect(form).toContain("Needed by");
    expect(form).toContain("Urgency");
    expect(form).toContain("REQUEST_URGENCIES");
    expect(form).toContain("URGENCY_LABELS");
    expect(form).toContain("Critical");
    expect(form).toContain("High");
    expect(form).toContain("Moderate");
    expect(formCode).not.toMatch(/>CRITICAL</);
    expect(form).toContain("Contact name");
    expect(form).toContain("Contact phone");
    expect(form).toContain("Notes");
    expect(form).toContain("Emergency request");
    expect(form).toContain("isEmergency");
  });

  it("submits through the existing create+match action with staged loading copy", () => {
    expect(form).toContain("createBloodRequestAndFindDonorsAction");
    expect(form).toContain("createBloodRequestSchema");
    expect(form).toContain("Find Donors Now");
    expect(form).toContain("Creating your request…");
    expect(form).toContain("Finding compatible donors…");
    expect(form).toContain("disabled={loading}");
    expect(form).toContain("if (loading) return");
    expect(form).toContain("updateBloodRequestAction");
  });

  it("uses FormField a11y wiring and section headings", () => {
    expect(form).toContain("FormField");
    expect(form).toContain("SectionHeader");
    expect(form).toContain("aria-describedby");
    expect(form).toContain("aria-invalid");
    expect(form).toContain('role="switch"');
    expect(form).toContain("aria-checked");
    expect(page).toContain("<PageHeader");
    expect(formCode).not.toContain("max-w-lg");
    expect(readCode(PAGE)).not.toContain("max-w-lg");
  });

  it("applies emergency treatment only when emergency is on", () => {
    expect(form).toContain("border-emergency/30");
    expect(form).toContain('variant={mode === "create" && isEmergency ? "emergency" : "primary"}');
    expect(formCode).not.toContain("animate-");
    expect(formCode).not.toContain("pulse");
    expect(form).toContain('{isEmergency ? "On" : "Off"}');
  });

  it("does not expose UUIDs, coordinates, or invent confirmation friction", () => {
    expect(formCode).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(formCode).not.toContain("toFixed");
    expect(formCode).not.toContain(".latitude");
    expect(formCode).not.toContain("ConfirmDialog");
    expect(formCode).not.toContain("window.confirm");
  });
});

describe("Phase 11E Step 2 — backend and prior UI boundaries", () => {
  it("leaves schema and actions contracts unchanged", () => {
    const schema = read(SCHEMA);
    expect(schema).toContain("createBloodRequestSchema");
    expect(schema).toContain("isEmergency");
    expect(schema).toContain(".min(1).max(20)");
    expect(read(ACTIONS)).toContain("createBloodRequestAndFindDonorsAction");
    expect(read(ACTIONS)).toContain("runMatchingWithNotifications");
  });

  it("leaves requester dashboard, layout, nav, and detail structure intact", () => {
    expect(read(DASHBOARD)).toContain("Your requests");
    expect(read(DASHBOARD)).toContain("Needs attention");
    expect(read(LAYOUT)).toContain("REQUESTER_NAV_SECTIONS");
    expect(read(DETAIL)).toContain("ConfirmDonationButton");
    expect(read(DETAIL)).toContain("BloodRequestForm");
  });

  it("leaves donor portal unchanged", () => {
    expect(read(DONOR_DASHBOARD)).toContain("Your donor dashboard");
    expect(read(DONOR_POPUP)).toContain("DonorMatchPopup");
  });
});
