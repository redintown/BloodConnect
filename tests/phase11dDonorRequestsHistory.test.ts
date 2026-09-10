import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { DONOR_NAV_SECTIONS } from "@/components/nav/donorNav";
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

const REQUESTS = "src/app/(donor)/donor/requests/page.tsx";
const REQUESTS_LOADING = "src/app/(donor)/donor/requests/loading.tsx";
const HISTORY = "src/app/(donor)/donor/history/page.tsx";
const HISTORY_LOADING = "src/app/(donor)/donor/history/loading.tsx";
const ACTIONS_UI = "src/components/forms/DonorMatchActions.tsx";
const DASHBOARD = "src/app/(donor)/donor/page.tsx";
const PROFILE = "src/app/(donor)/donor/profile/page.tsx";
const AVAIL = "src/app/(donor)/donor/availability/page.tsx";
const PROFILE_FORM = "src/components/forms/DonorProfileForm.tsx";
const AVAIL_FORM = "src/components/forms/AvailabilitySelector.tsx";
const POPUP = "src/components/forms/DonorMatchPopup.tsx";
const OVERLAY = "src/components/forms/DonorPortalMatchOverlay.tsx";
const DONOR_ACTIONS = "src/app/(donor)/actions.ts";

describe("Phase 11D Step 4 — requests route", () => {
  const page = read(REQUESTS);
  const pageCode = readCode(REQUESTS);
  const card = read(ACTIONS_UI);
  const cardCode = readCode(ACTIONS_UI);

  it("renders Requests with PageHeader and existing inbox wiring", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Requests");
    expect(page).toContain("DonorMatchActions");
    expect(page).toContain("listMatchesForDonor");
    expect(page).toContain('requireRole("DONOR")');
    expect(page).toContain("getAcceptedMatchContact");
  });

  it("marks Requests as an existing nav destination", () => {
    const items = flattenNavSections(DONOR_NAV_SECTIONS);
    expect(items.some((i) => i.href === "/donor/requests")).toBe(true);
  });

  it("prioritizes actionable matches ahead of in-progress and past", () => {
    expect(page).toContain("selectActionableDonorMatches");
    expect(page).toContain("Needs your response");
    expect(page).toContain("Accepted / in progress");
    expect(page).toContain("Past");
    const actionableIdx = page.indexOf("Needs your response");
    const activeIdx = page.indexOf("Accepted / in progress");
    const pastIdx = page.indexOf('title="Past"');
    expect(actionableIdx).toBeGreaterThan(-1);
    expect(activeIdx).toBeGreaterThan(actionableIdx);
    expect(pastIdx).toBeGreaterThan(activeIdx);
  });

  it("uses human-readable status language without raw match enums in the card UI", () => {
    expect(card).toContain("Needs response");
    expect(card).toContain("On the way");
    expect(card).toContain("MATCH_STATUS_LABELS");
    expect(card).toContain("StatusChip");
    expect(cardCode).not.toContain("Match: {item.matchStatus}");
    expect(cardCode).not.toContain("Match: ");
  });

  it("marks emergency requests distinctly without painting every card emergency", () => {
    expect(card).toContain("isEmergency");
    expect(card).toContain("Emergency");
    expect(card).toContain("border-emergency/30");
    expect(card).toContain('variant={isEmergency ? "emergency" : "primary"}');
  });

  it("preserves existing actions and duplicate-submit guards", () => {
    expect(card).toContain("acceptMatchAction");
    expect(card).toContain("declineMatchAction");
    expect(card).toContain("markOnTheWayAction");
    expect(card).toContain("if (loading !== null) return");
    expect(card).toContain("loading={loading === \"accept\"}");
    expect(card).toContain("Could not update");
  });

  it("reveals contact only from authorized AcceptedMatchContact payload", () => {
    expect(page).toContain('m.matchStatus === "ACCEPTED"');
    expect(card).toContain("contact?.request");
    expect(card).toContain("Requester contact");
    expect(pageCode).not.toContain("listBloodRequests");
    expect(card).toContain("requestContact.contactPhone");
    expect(card).not.toContain("getAcceptedMatchContact");
  });

  it("does not expose UUIDs, exact coordinates, or invented routes", () => {
    expect(pageCode).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(cardCode).not.toContain("toFixed");
    expect(cardCode).not.toContain("latitude");
    expect(card).toContain("distanceBandKm");
    expect(pageCode).not.toContain("/donor/requests/[");
    expect(pageCode).not.toContain("href={`/donor/requests/");
  });

  it("provides empty and loading states", () => {
    expect(page).toContain("EmptyState");
    expect(page).toContain("No matched requests yet");
    expect(read(REQUESTS_LOADING)).toContain("Loading matched requests");
    expect(read(REQUESTS_LOADING)).toContain('role="status"');
  });

  it("avoids max-w-lg and uses shared Button for 44px controls", () => {
    expect(pageCode).not.toContain("max-w-lg");
    expect(card).toContain("Button");
    expect(read("src/components/ui/Button.tsx")).toContain("min-h-control");
  });
});

describe("Phase 11D Step 4 — donation history route", () => {
  const page = read(HISTORY);
  const pageCode = readCode(HISTORY);

  it("renders Donation history with existing getDonationHistory query", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Donation history");
    expect(page).toContain("getDonationHistory");
    expect(page).toContain('requireRole("DONOR")');
  });

  it("marks History as an existing nav destination", () => {
    const items = flattenNavSections(DONOR_NAV_SECTIONS);
    expect(items.some((i) => i.href === "/donor/history")).toBe(true);
  });

  it("displays only existing donation fields", () => {
    expect(page).toContain("donatedAt");
    expect(page).toContain("quantityMl");
    expect(page).toContain("notes");
    expect(pageCode).not.toContain("livesSaved");
    expect(pageCode).not.toContain("impact");
    expect(pageCode).not.toContain("getDonationStats");
  });

  it("uses list length for count only when records already exist", () => {
    expect(page).toContain("count={donations.length}");
    expect(page).toContain("Recorded donations");
  });

  it("provides calm empty and loading states", () => {
    expect(page).toContain("No completed donations recorded yet");
    expect(page).toContain("EmptyState");
    expect(read(HISTORY_LOADING)).toContain("Loading donation history");
  });

  it("does not expose UUIDs, coordinates, or private requester data", () => {
    expect(pageCode).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(pageCode).not.toContain("toFixed");
    expect(pageCode).not.toContain("latitude");
    expect(pageCode).not.toContain("contactPhone");
    expect(pageCode).not.toContain("requester");
  });

  it("uses cards without a wide scrolling table", () => {
    expect(page).toContain("<article");
    expect(pageCode).not.toContain("<table");
    expect(pageCode).not.toContain("overflow-x");
    expect(pageCode).not.toContain("max-w-lg");
  });
});

describe("Phase 11D Step 4 — boundary: prior steps and backend untouched", () => {
  it("does not invent donor action implementations", () => {
    const actions = read(DONOR_ACTIONS);
    expect(actions).toContain("acceptMatchAction");
    expect(actions).toContain("declineMatchAction");
    expect(actions).toContain("markOnTheWayAction");
  });

  it("leaves dashboard, popup, overlay, profile, and availability intact", () => {
    expect(read(DASHBOARD)).toContain("Your donor dashboard");
    expect(read(POPUP)).toContain("DonorMatchPopup");
    expect(read(OVERLAY)).toContain("DonorPortalMatchOverlay");
    expect(read(PROFILE)).toContain("DonorProfileForm");
    expect(read(AVAIL)).toContain("AvailabilitySelector");
    expect(read(PROFILE_FORM)).toContain("saveDonorProfileAction");
    expect(read(AVAIL_FORM)).toContain("saveDonorAvailabilityAction");
  });

  it("does not modify services or schemas from the requests/history redesign", () => {
    // Guard: Step 4 files must not import notificationService (Phase 5 rule).
    expect(read(REQUESTS)).not.toContain("notificationService");
    expect(read(HISTORY)).not.toContain("notificationService");
    expect(read(ACTIONS_UI)).not.toContain("notificationService");
  });
});
