import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { HOSPITAL_NAV_SECTIONS } from "@/components/nav/hospitalNav";
import { BLOOD_BANK_NAV_SECTIONS } from "@/components/nav/bloodBankNav";
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

const H_LAYOUT = "src/app/(hospital)/layout.tsx";
const BB_LAYOUT = "src/app/(blood-bank)/layout.tsx";
const H_DASH = "src/app/(hospital)/hospital/page.tsx";
const BB_DASH = "src/app/(blood-bank)/blood-bank/page.tsx";
const H_NAV = "src/components/nav/hospitalNav.ts";
const BB_NAV = "src/components/nav/bloodBankNav.ts";
const HEADER = "src/components/layout/OrganizationShellHeader.tsx";
const AUTH_NAV = "src/components/ui/AuthNav.tsx";
const H_LOADING = "src/app/(hospital)/hospital/loading.tsx";
const BB_LOADING = "src/app/(blood-bank)/blood-bank/loading.tsx";

const HOSPITAL_ROUTES = [
  "/hospital",
  "/hospital/requests",
  "/hospital/inventory",
  "/hospital/profile",
];

const BLOOD_BANK_ROUTES = [
  "/blood-bank",
  "/blood-bank/requests",
  "/blood-bank/inventory",
  "/blood-bank/profile",
];

describe("Phase 11F Step 1 — organization navigation", () => {
  it("hospital nav lists only existing hospital routes", () => {
    const items = flattenNavSections(HOSPITAL_NAV_SECTIONS);
    expect(items.map((i) => i.href).sort()).toEqual([...HOSPITAL_ROUTES].sort());
    expect(items.length).toBeLessThanOrEqual(5);
    expect(read(H_NAV)).not.toContain('"/donor"');
    expect(read(H_NAV)).not.toContain('"/requests"');
    expect(read(H_NAV)).not.toContain('"/admin"');
  });

  it("blood bank nav lists only existing blood-bank routes", () => {
    const items = flattenNavSections(BLOOD_BANK_NAV_SECTIONS);
    expect(items.map((i) => i.href).sort()).toEqual([...BLOOD_BANK_ROUTES].sort());
    expect(items.length).toBeLessThanOrEqual(5);
    expect(read(BB_NAV)).not.toContain('"/hospital"');
    expect(read(BB_NAV)).not.toContain('"/donor"');
  });

  it("wires AppShell + DesktopNav + MobileNav + BrandLogo chrome for both portals", () => {
    for (const layout of [H_LAYOUT, BB_LAYOUT]) {
      const source = read(layout);
      expect(source).toContain("AppShell");
      expect(source).toContain("DesktopNav");
      expect(source).toContain("MobileNav");
      expect(source).toContain("flattenNavSections");
      expect(source).toContain("OrganizationShellHeader");
    }
    expect(read(H_LAYOUT)).toContain("HOSPITAL_NAV_SECTIONS");
    expect(read(BB_LAYOUT)).toContain("BLOOD_BANK_NAV_SECTIONS");
    expect(read(HEADER)).toContain("BrandLogo");
    expect(read(HEADER)).toContain("logoutAction");
  });

  it("marks Home exact and Escalations prefix for hospital", () => {
    const home = flattenNavSections(HOSPITAL_NAV_SECTIONS).find((i) => i.href === "/hospital")!;
    const escalations = flattenNavSections(HOSPITAL_NAV_SECTIONS).find(
      (i) => i.href === "/hospital/requests"
    )!;
    expect(isNavItemActive("/hospital", home)).toBe(true);
    expect(isNavItemActive("/hospital/profile", home)).toBe(false);
    expect(isNavItemActive("/hospital/requests", escalations)).toBe(true);
  });

  it("hides AuthNav on hospital and blood-bank paths", () => {
    const nav = read(AUTH_NAV);
    expect(nav).toContain('pathname === "/hospital"');
    expect(nav).toContain('pathname.startsWith("/hospital/")');
    expect(nav).toContain('pathname === "/blood-bank"');
    expect(nav).toContain('pathname.startsWith("/blood-bank/")');
  });
});

describe("Phase 11F Step 1 — hospital dashboard", () => {
  const page = read(H_DASH);
  const code = readCode(H_DASH);

  it("renders attention-first hospital home with existing profile query only", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Hospital dashboard");
    expect(page).toContain("Needs attention");
    expect(page).toContain("hospitalService.getOwnProfile");
    expect(code).not.toContain("listInboxForOrganization");
    expect(code).not.toContain("getOwnInventory");
    expect(code).not.toContain("escalationService");
  });

  it("shows verification with StatusChip and no raw enums as primary labels", () => {
    expect(page).toContain("StatusChip");
    expect(page).toContain('kind="verification"');
    expect(page).toContain("verificationStatus");
    expect(code).not.toContain("Verification: {");
  });

  it("links to existing escalations/inventory/profile without invented metrics", () => {
    expect(page).toContain('href="/hospital/requests"');
    expect(page).toContain('href="/hospital/inventory"');
    expect(page).toContain('href="/hospital/profile"');
    expect(code).not.toContain("unitsAvailable");
    expect(code).not.toContain("low stock");
    expect(code).not.toContain("orgContactedCount");
  });

  it("does not expose UUIDs, coordinates, or private donor/requester data", () => {
    expect(code).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(code).not.toContain("toFixed");
    expect(code).not.toContain("latitude");
    expect(code).not.toContain("contactPhone");
    expect(code).not.toContain("max-w-lg");
  });

  it("provides loading UI", () => {
    expect(read(H_LOADING)).toContain("Loading hospital dashboard");
    expect(read(H_LOADING)).toContain('role="status"');
  });
});

describe("Phase 11F Step 1 — blood bank dashboard", () => {
  const page = read(BB_DASH);
  const code = readCode(BB_DASH);

  it("renders attention-first blood bank home with existing profile query only", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Blood bank dashboard");
    expect(page).toContain("Needs attention");
    expect(page).toContain("bloodBankService.getOwnProfile");
    expect(code).not.toContain("listInboxForOrganization");
    expect(code).not.toContain("getOwnInventory");
    expect(code).not.toContain("inventoryService");
  });

  it("emphasizes inventory via link without inventing stock counts", () => {
    expect(page).toContain("Inventory readiness");
    expect(page).toContain('href="/blood-bank/inventory"');
    expect(page).toContain("does not invent stock counts");
    expect(code).not.toContain("unitsAvailable");
    expect(code).not.toContain("BloodInventoryItem");
  });

  it("shows verification and emergency hours only from profile DTO", () => {
    expect(page).toContain("StatusChip");
    expect(page).toContain("emergencyHours");
    expect(page).toContain('href="/blood-bank/requests"');
    expect(page).toContain('href="/blood-bank/profile"');
  });

  it("provides loading UI and avoids max-w-lg", () => {
    expect(read(BB_LOADING)).toContain("Loading blood bank dashboard");
    expect(code).not.toContain("max-w-lg");
  });
});

describe("Phase 11F Step 1 — regression", () => {
  it("leaves donor and requester portals intact", () => {
    expect(read("src/app/(donor)/donor/page.tsx")).toContain("Your donor dashboard");
    expect(read("src/app/(requester)/requests/page.tsx")).toContain("Needs attention");
    expect(read("src/components/forms/DonorMatchPopup.tsx")).toContain("DonorMatchPopup");
  });

  it("does not modify org escalation or inventory services from the dashboard redesign", () => {
    expect(read("src/components/forms/OrganizationEscalationInbox.tsx")).toContain(
      "listInboxForOrganization"
    );
    expect(read("src/services/inventoryService.ts")).toContain("getOwnInventory");
  });
});
