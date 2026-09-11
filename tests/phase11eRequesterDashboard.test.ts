import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { REQUESTER_NAV_SECTIONS } from "@/components/nav/requesterNav";
import { flattenNavSections, isNavItemActive } from "@/components/nav/navConfig";

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

const LAYOUT = "src/app/(requester)/layout.tsx";
const DASHBOARD = "src/app/(requester)/requests/page.tsx";
const LOADING = "src/app/(requester)/requests/loading.tsx";
const NAV = "src/components/nav/requesterNav.ts";
const HEADER = "src/components/layout/RequesterShellHeader.tsx";
const AUTH_NAV = "src/components/ui/AuthNav.tsx";
const CREATE = "src/app/(requester)/request-blood/page.tsx";
const DETAIL = "src/app/(requester)/requests/[id]/page.tsx";

const DONOR_DASHBOARD = "src/app/(donor)/donor/page.tsx";
const DONOR_POPUP = "src/components/forms/DonorMatchPopup.tsx";
const DONOR_PROFILE = "src/components/forms/DonorProfileForm.tsx";
const DONOR_AVAIL = "src/components/forms/AvailabilitySelector.tsx";
const DONOR_REQUESTS = "src/app/(donor)/donor/requests/page.tsx";
const DONOR_HISTORY = "src/app/(donor)/donor/history/page.tsx";

/** Actual existing requester destinations — there is no /requester path. */
const EXISTING_REQUESTER_NAV_ROUTES = ["/requests", "/request-blood"];

describe("Phase 11E Step 1 — requester navigation", () => {
  it("lists only existing requester destinations (no invented /requester home)", () => {
    const items = flattenNavSections(REQUESTER_NAV_SECTIONS);
    expect(items.map((i) => i.href).sort()).toEqual([...EXISTING_REQUESTER_NAV_ROUTES].sort());
    expect(items.length).toBeLessThanOrEqual(5);
    expect(read(NAV)).not.toContain('"/requester"');
  });

  it("does not invent portal routes for other roles", () => {
    const source = read(NAV);
    for (const forbidden of ["/admin", "/hospital", "/blood-bank", "/donor"]) {
      expect(source).not.toContain(`"${forbidden}"`);
    }
  });

  it("wires AppShell with DesktopNav, MobileNav and BrandLogo chrome", () => {
    const layout = read(LAYOUT);
    expect(layout).toContain("AppShell");
    expect(layout).toContain("DesktopNav");
    expect(layout).toContain("MobileNav");
    expect(layout).toContain("REQUESTER_NAV_SECTIONS");
    expect(layout).toContain("flattenNavSections");
    expect(layout).toContain("<RequesterShellHeader");
    expect(read(HEADER)).toContain("<BrandLogo");
    expect(read(HEADER)).toContain("logoutAction");
  });

  it("marks Home active for list and detail paths", () => {
    const home = flattenNavSections(REQUESTER_NAV_SECTIONS).find((i) => i.href === "/requests")!;
    expect(isNavItemActive("/requests", home)).toBe(true);
    expect(isNavItemActive("/requests/abc", home)).toBe(true);
    expect(isNavItemActive("/request-blood", home)).toBe(false);
  });

  it("hides AuthNav on requester paths so branding is not duplicated", () => {
    const nav = read(AUTH_NAV);
    expect(nav).toContain('pathname === "/request-blood"');
    expect(nav).toContain('pathname === "/requests"');
    expect(nav).toContain('pathname.startsWith("/requests/")');
    expect(nav).toContain("ownsOwnChrome");
  });
});

describe("Phase 11E Step 1 — requester dashboard (/requests)", () => {
  const page = read(DASHBOARD);
  const code = readCode(DASHBOARD);

  it("renders attention-first home on the existing /requests route", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Your requests");
    expect(page).toContain("Needs attention");
    expect(page).toContain("listForRequester");
    expect(page).toContain("requireAuth");
  });

  it("does not invent a /requester route or new list query", () => {
    expect(code).not.toContain('"/requester"');
    expect(code).not.toContain("listMatchesForRequester");
    expect(code).not.toContain("getEscalationSummary");
    expect(code).not.toContain("getAcceptedMatchContact");
    expect(code).not.toContain("matchingService");
  });

  it("prioritizes attention over the request list", () => {
    const attentionIdx = page.indexOf("Needs attention");
    const listIdx = page.indexOf("My requests");
    expect(attentionIdx).toBeGreaterThan(-1);
    expect(listIdx).toBeGreaterThan(attentionIdx);
  });

  it("presents emergency and status with human-readable labels", () => {
    expect(page).toContain("isEmergency");
    expect(page).toContain("Emergency request");
    expect(page).toContain("STATUS_LABELS");
    expect(page).toContain("StatusChip");
    expect(page).toContain("BLOOD_GROUP_LABELS");
    expect(code).not.toContain("EMERGENCY RESPONSE");
  });

  it("does not expose UUIDs, exact coordinates, or unauthorized donor contact", () => {
    expect(code).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(code).not.toContain("toFixed");
    expect(code).not.toContain(".latitude");
    expect(code).not.toContain(".longitude");
    expect(code).not.toContain("contactPhone");
    expect(code).not.toContain("donor.phone");
  });

  it("links next actions only to existing routes", () => {
    expect(page).toContain('href="/request-blood"');
    expect(page).toContain("`/requests/${attention.id}`");
    expect(page).toContain("canRequesterConfirmDonation");
    expect(page).toContain("canRunMatching");
    expect(code).not.toContain("confirmDonationAction");
    expect(code).not.toContain("escalateNowAction");
  });

  it("provides empty and loading states", () => {
    expect(page).toContain("EmptyState");
    expect(page).toContain("No active blood request");
    expect(read(LOADING)).toContain("Loading your requests");
    expect(read(LOADING)).toContain('role="status"');
  });

  it("avoids max-w-lg and uses shared Button sizing", () => {
    expect(code).not.toContain("max-w-lg");
    expect(page).toContain("buttonClassName");
    expect(read("src/components/ui/Button.tsx")).toContain("min-h-control");
  });
});

describe("Phase 11E Step 1 — sibling requester pages stay unreworked", () => {
  it("keeps create form and detail action wiring", () => {
    expect(read(CREATE)).toContain("BloodRequestForm");
    expect(read(CREATE)).toContain("Request blood");
    expect(read(DETAIL)).toContain("ConfirmDonationButton");
    expect(read(DETAIL)).toContain("EscalateNowButton");
    expect(read(DETAIL)).toContain("PageHeader");
  });
});

describe("Phase 11E Step 1 — donor portal regression", () => {
  it("leaves donor dashboard, popup, profile, availability, requests, history intact", () => {
    expect(read(DONOR_DASHBOARD)).toContain("Your donor dashboard");
    expect(read(DONOR_POPUP)).toContain("DonorMatchPopup");
    expect(read(DONOR_PROFILE)).toContain("saveDonorProfileAction");
    expect(read(DONOR_AVAIL)).toContain("saveDonorAvailabilityAction");
    expect(read(DONOR_REQUESTS)).toContain("DonorMatchActions");
    expect(read(DONOR_HISTORY)).toContain("getDonationHistory");
  });

  it("does not modify requester actions from the dashboard redesign", () => {
    expect(read("src/app/(requester)/actions.ts")).toContain("createBloodRequestAction");
  });
});
