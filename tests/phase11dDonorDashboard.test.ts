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

const LAYOUT = "src/app/(donor)/layout.tsx";
const DASHBOARD = "src/app/(donor)/donor/page.tsx";
const LOADING = "src/app/(donor)/donor/loading.tsx";
const NAV = "src/components/nav/donorNav.ts";
const HEADER = "src/components/layout/DonorShellHeader.tsx";
const AUTH_NAV = "src/components/ui/AuthNav.tsx";
const OVERLAY = "src/components/forms/DonorPortalMatchOverlay.tsx";

const EXISTING_DONOR_ROUTES = [
  "/donor",
  "/donor/requests",
  "/donor/availability",
  "/donor/history",
  "/donor/profile",
];

function hrefsIn(rel: string): string[] {
  return [...readCode(rel).matchAll(/href[=:]\s*"([^"]+)"/g)].map((m) => m[1]!);
}

describe("Phase 11D — donor navigation", () => {
  it("lists only existing donor routes", () => {
    const items = flattenNavSections(DONOR_NAV_SECTIONS);
    expect(items.map((i) => i.href).sort()).toEqual([...EXISTING_DONOR_ROUTES].sort());
    expect(items.length).toBeLessThanOrEqual(5);
  });

  it("does not invent portal routes for other roles", () => {
    const source = read(NAV);
    for (const forbidden of ["/admin", "/hospital", "/blood-bank", "/requests", "/request-blood"]) {
      expect(source).not.toContain(`"${forbidden}"`);
    }
  });

  it("wires AppShell with DesktopNav, MobileNav and BrandLogo chrome", () => {
    const layout = read(LAYOUT);
    expect(layout).toContain("AppShell");
    expect(layout).toContain("DesktopNav");
    expect(layout).toContain("MobileNav");
    expect(layout).toContain("DONOR_NAV_SECTIONS");
    expect(layout).toContain("flattenNavSections");
    expect(layout).toContain("<DonorShellHeader");
    expect(read(HEADER)).toContain("<BrandLogo");
    expect(read(HEADER)).toContain("logoutAction");
  });

  it("hides AuthNav on all donor paths so branding is not duplicated", () => {
    const nav = read(AUTH_NAV);
    expect(nav).toContain('pathname === "/donor"');
    expect(nav).toContain('pathname.startsWith("/donor/")');
    expect(nav).toContain("ownsOwnChrome");
  });
});

describe("Phase 11D — donor dashboard hierarchy", () => {
  const page = read(DASHBOARD);
  const code = readCode(DASHBOARD);

  it("keeps the donor home route and attention-first heading", () => {
    expect(page).toContain("Your donor dashboard");
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Needs your response");
    // Profile is secondary, not the lead.
    const attentionIdx = page.indexOf("Needs your response");
    const profileIdx = page.indexOf("Manage donor profile");
    expect(attentionIdx).toBeGreaterThan(-1);
    expect(profileIdx).toBeGreaterThan(attentionIdx);
  });

  it("preserves the existing data fetches and match count logic", () => {
    expect(page).toContain("donorService.getOwnProfile");
    expect(page).toContain("matchResponseService.listMatchesForDonor");
    expect(page).toContain("selectActionableDonorMatches");
    expect(page).toContain("requireRole(\"DONOR\")");
    expect(page).toContain("nextEligibleDate");
  });

  it("presents Emergency Response and normal availability as separate concepts", () => {
    expect(page).toContain("Emergency Response");
    expect(page).toContain("Normal availability");
    expect(page).toContain("emergencyResponseEnabled");
    expect(page).toContain("emergencyRadiusKm");
    expect(page).toContain("does not disable");
    expect(page).toContain("even when normal availability is off");
  });

  it("shows eligibility from profile data without recalculating the interval", () => {
    expect(page).toContain("profile.isEligible");
    expect(code).not.toContain("MIN_DAYS_BETWEEN_DONATIONS");
    expect(code).not.toContain("isEligibleFromLastDonation");
  });

  it("does not invent donation rows on the dashboard", () => {
    expect(code).not.toContain("getDonationHistory");
    expect(page).toContain('href="/donor/history"');
  });
});

describe("Phase 11D — match popup boundary", () => {
  it("keeps a single DonorPortalMatchOverlay on the layout", () => {
    const layout = read(LAYOUT);
    expect(layout).toContain("DonorPortalMatchOverlay");
    expect(layout).toContain("<DonorPortalMatchOverlay userId={user.id} />");
    expect(layout.match(/<DonorPortalMatchOverlay/g)?.length).toBe(1);
    expect(read(OVERLAY)).toContain("DonorMatchPopup");
  });

  it("does not mount a second match modal from the dashboard", () => {
    const dash = readCode(DASHBOARD);
    expect(dash).not.toContain("DonorMatchPopup");
    expect(dash).not.toContain("DonorPortalMatchOverlay");
    expect(dash).not.toContain("role=\"dialog\"");
    expect(dash).not.toContain("<Modal");
  });
});

describe("Phase 11D — privacy and status language", () => {
  const code = readCode(DASHBOARD);

  it("never renders UUIDs, coordinates or private phones", () => {
    // Identifiers may be passed to services; they must not appear as JSX text.
    expect(code).not.toContain("{user.id}");
    expect(code).not.toContain("{profile.id}");
    expect(code).not.toContain("{matchId}");
    expect(code).not.toContain("latitude");
    expect(code).not.toContain("longitude");
    expect(code).not.toContain("toFixed");
    expect(code).not.toContain(".phone");
    // Location is presence-only.
    expect(read(DASHBOARD)).toContain('profile.location ? "Set" : "Not set"');
  });

  it("does not render raw match or request enum tokens as UI copy", () => {
    // Filter logic may still reference enums; rendered strings must be human.
    expect(code).not.toContain(">MATCHED<");
    expect(code).not.toContain(">NOTIFIED<");
    expect(code).not.toContain(">VIEWED<");
    expect(code).not.toContain(">DONOR_ACCEPTED<");
    expect(code).not.toContain(">PENDING<");
    expect(read(DASHBOARD)).toContain("Response needed");
    expect(read(DASHBOARD)).toContain("Eligible to donate");
    expect(read(DASHBOARD)).toContain("Not currently eligible");
  });

  it("uses emergency styling only for actionable emergency meaning", () => {
    expect(read(DASHBOARD)).toContain("hasEmergencyActionable");
    expect(read(DASHBOARD)).toContain('variant: hasEmergencyActionable ? "emergency"');
    // Normal availability / profile complete must not use emergency red.
    expect(code).not.toContain("border-emergency/40");
    expect(code).not.toContain("Complete your donor profile to start matching");
  });

  it("links only to existing donor routes", () => {
    for (const href of hrefsIn(DASHBOARD)) {
      expect(EXISTING_DONOR_ROUTES, `unknown href ${href}`).toContain(href);
    }
    for (const href of hrefsIn(NAV)) {
      expect(EXISTING_DONOR_ROUTES).toContain(href);
    }
  });
});

describe("Phase 11D — states and design system", () => {
  it("provides empty and loading surfaces", () => {
    expect(read(DASHBOARD)).toContain("<EmptyState");
    expect(read(DASHBOARD)).toContain("No responses needed right now");
    expect(read(LOADING)).toContain("Skeleton");
    expect(read(LOADING)).toContain('role="status"');
  });

  it("uses Phase 11B primitives and shell width, not max-w-lg", () => {
    const page = read(DASHBOARD);
    expect(page).toContain("PageHeader");
    expect(page).toContain("SectionHeader");
    expect(page).toContain("StatusChip");
    expect(page).toContain("buttonClassName");
    expect(readCode(DASHBOARD)).not.toContain("max-w-lg");
    expect(readCode(LAYOUT)).not.toContain("max-w-lg");
    expect(read("src/components/layout/AppShell.tsx")).toContain("max-w-shell");
  });

  it("avoids gradients, glass, decorative shadows and emoji", () => {
    for (const file of [DASHBOARD, LAYOUT, HEADER, NAV]) {
      const code = readCode(file);
      expect(code, `${file} gradient`).not.toContain("gradient");
      expect(code, `${file} glass`).not.toContain("backdrop-blur");
      expect(code, `${file} shadow`).not.toContain("shadow-");
      expect(read(file), `${file} emoji`).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
  });

  it("keeps 44px touch targets on shell controls", () => {
    expect(read(HEADER)).toContain("min-h-control");
    expect(read("src/components/nav/MobileNav.tsx")).toContain("min-h-nav");
  });
});

describe("Phase 11D — no backend changes in this step", () => {
  it("does not rewrite DonorMatchPopup or overlay behaviour", () => {
    expect(read(OVERLAY)).toContain("selectActionableDonorMatches");
    expect(read(OVERLAY)).toContain("shouldShowDonorMatchPopup");
    expect(read("src/components/forms/DonorMatchPopup.tsx")).toContain("acceptMatchAction");
  });

  it("leaves donor actions and services out of the presentation diff surface", () => {
    expect(readCode(DASHBOARD)).not.toContain('"use server"');
    expect(readCode(LAYOUT)).not.toContain("matchResponseService");
    expect(readCode(LAYOUT)).not.toContain("donorService");
  });
});
