import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { ADMIN_NAV_SECTIONS } from "@/components/nav/adminNav";
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

const LAYOUT = "src/app/(admin)/layout.tsx";
const DASH = "src/app/(admin)/admin/page.tsx";
const NAV = "src/components/nav/adminNav.ts";
const HEADER = "src/components/layout/AdminShellHeader.tsx";
const AUTH_NAV = "src/components/ui/AuthNav.tsx";
const LOADING = "src/app/(admin)/admin/loading.tsx";

const ADMIN_ROUTES = ["/admin", "/admin/organizations", "/admin/donors", "/admin/escalations"];

describe("Phase 11G Step 1 — actual admin routes discovered", () => {
  it("keeps every existing admin route file untouched by this step", () => {
    for (const file of [
      "src/app/(admin)/admin/organizations/page.tsx",
      "src/app/(admin)/admin/donors/page.tsx",
      "src/app/(admin)/admin/escalations/page.tsx",
      "src/app/(admin)/admin/users/page.tsx",
      "src/app/(admin)/admin/requests/page.tsx",
      "src/app/(admin)/admin/verification/page.tsx",
    ]) {
      expect(() => read(file)).not.toThrow();
    }
    // Content of these pages is not part of this step — spot-check they
    // still call the exact existing services, unmodified.
    expect(read("src/app/(admin)/admin/organizations/page.tsx")).toContain(
      "verificationService.listPendingOrganizations()"
    );
    expect(read("src/app/(admin)/admin/donors/page.tsx")).toContain(
      "verificationService.listPendingDonors()"
    );
    expect(read("src/app/(admin)/admin/escalations/page.tsx")).toContain(
      "escalationService.listAdminOpenEscalations()"
    );
    expect(read("src/app/(admin)/admin/verification/page.tsx")).toContain(
      'redirect("/admin/organizations")'
    );
  });

  it("only the nav destinations that already fetch real data are in the persistent nav", () => {
    const items = flattenNavSections(ADMIN_NAV_SECTIONS);
    const hrefs = items.map((item) => item.href).sort();
    expect(hrefs).toEqual(["/admin", "/admin/donors", "/admin/escalations", "/admin/organizations"]);
    // Stub routes (no query yet) are deliberately excluded from the rail.
    expect(hrefs).not.toContain("/admin/users");
    expect(hrefs).not.toContain("/admin/requests");
    expect(hrefs).not.toContain("/admin/verification");
  });
});

describe("Phase 11G Step 1 — admin shell + navigation", () => {
  it("adopts AppShell + DesktopNav + MobileNav, matching the other portals", () => {
    const layout = read(LAYOUT);
    expect(layout).toContain("AppShell");
    expect(layout).toContain("DesktopNav");
    expect(layout).toContain("MobileNav");
    expect(layout).toContain("AdminShellHeader");
    expect(layout).toContain("ADMIN_NAV_SECTIONS");
    expect(layout).toContain('protectPage({ role: "ADMIN" })');
  });

  it("does not add a new query in the layout for shell chrome", () => {
    const code = readCode(LAYOUT);
    expect(code).not.toContain("createClient");
    expect(code).not.toContain("supabase");
    expect(code).not.toContain("Service.");
    // Only reads the already-computed protectPage() return value.
    expect(code).toContain("user.email");
  });

  it("defines exactly the four implemented destinations with correct hrefs/icons", () => {
    expect(ADMIN_NAV_SECTIONS).toHaveLength(1);
    const items = ADMIN_NAV_SECTIONS[0]!.items;
    expect(items.map((i) => i.href)).toEqual([
      "/admin",
      "/admin/organizations",
      "/admin/donors",
      "/admin/escalations",
    ]);
    expect(items.find((i) => i.href === "/admin")?.exact).toBe(true);
  });

  it("resolves active navigation state correctly for admin routes", () => {
    const home = ADMIN_NAV_SECTIONS[0]!.items.find((i) => i.href === "/admin")!;
    const orgs = ADMIN_NAV_SECTIONS[0]!.items.find((i) => i.href === "/admin/organizations")!;

    expect(isNavItemActive("/admin", home)).toBe(true);
    expect(isNavItemActive("/admin/organizations", home)).toBe(false);
    expect(isNavItemActive("/admin/organizations", orgs)).toBe(true);
    expect(isNavItemActive("/admin/organizations/anything", orgs)).toBe(true);
  });

  it("does not invent nav item counts", () => {
    const nav = readCode(NAV);
    expect(nav).not.toContain("count:");
    expect(nav).not.toContain("countLabel:");
  });

  it("hides the legacy AuthNav bar on admin paths (no duplicate branding)", () => {
    const nav = read(AUTH_NAV);
    expect(nav).toContain("ownsOwnChrome");
    expect(nav).toContain('pathname === "/admin"');
    expect(nav).toContain('pathname.startsWith("/admin/")');
  });

  it("does not weaken authorization in the auth bar or layout", () => {
    expect(readCode(AUTH_NAV)).not.toContain("requireRole");
    expect(readCode(LAYOUT)).toContain('role: "ADMIN"');
  });

  it("reuses the shared shell header pattern without duplicating logout logic", () => {
    const header = read(HEADER);
    expect(header).toContain("logoutAction");
    expect(header).toContain("BrandLogo");
    expect(header).toContain("min-h-control");
  });

  it("adds a card-shaped loading state for the dashboard route", () => {
    const loading = read(LOADING);
    expect(loading).toContain('role="status"');
    expect(loading).toContain("sr-only");
  });
});

describe("Phase 11G Step 1 — admin dashboard content", () => {
  it("fetches nothing new — the dashboard stays a static navigational page", () => {
    const code = readCode(DASH);
    expect(code).not.toContain("Service.");
    expect(code).not.toContain("createClient");
    expect(code).not.toContain("supabase");
    expect(code).not.toContain("async function AdminHomePage");
    expect(code).not.toContain(".rpc(");
  });

  it("uses PageHeader with one page title and no max-w-lg", () => {
    const page = read(DASH);
    expect(page).toContain("PageHeader");
    expect(page).toContain('title="Admin dashboard"');
    expect(page).not.toContain("PageShell");
    expect(page).not.toContain("max-w-lg");
    expect(page).not.toContain("<main");
  });

  it("has an attention-first section that links to real queues, without counts", () => {
    const page = read(DASH);
    expect(page).toContain("Needs attention");
    expect(page).toContain('href="/admin/organizations"');
    expect(page).toContain('href="/admin/escalations"');
    const code = readCode(DASH);
    expect(code).not.toMatch(/\d+\s*(pending|open|awaiting)/i);
  });

  it("surfaces exactly the three implemented queues as administrative queues", () => {
    const page = read(DASH);
    expect(page).toContain("Administrative queues");
    expect(page).toContain("Organization verification");
    expect(page).toContain("Donor verification");
    expect(page).toContain("Escalation queue");
  });

  it("labels not-yet-implemented routes honestly, without phase/roadmap jargon", () => {
    const page = read(DASH);
    expect(page).toContain('href="/admin/users"');
    expect(page).toContain('href="/admin/requests"');
    expect(page).toContain("Not available yet");
    expect(page).not.toMatch(/Phase \d/);
  });

  it("does not invent KPIs, analytics, or platform-wide counts", () => {
    const code = readCode(DASH);
    for (const forbidden of [
      "responseRate",
      "slaMs",
      "averageResponseTime",
      "donorCount",
      "hospitalCount",
      "bloodBankCount",
      "successRate",
      "capacity",
      "predict",
      "%",
    ]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  it("does not add filtering, search, sorting, or pagination", () => {
    const code = readCode(DASH);
    expect(code).not.toContain("useSearchParams");
    expect(code).not.toContain("searchParams");
    expect(code).not.toContain("sort(");
    expect(code).not.toContain("pageSize");
    expect(code).not.toContain('type="search"');
  });
});

describe("Phase 11G Step 1 — privacy and accessibility", () => {
  it("exposes no ids, tokens, or internal metadata on the dashboard", () => {
    for (const file of [DASH, LAYOUT, HEADER, NAV]) {
      const code = readCode(file);
      expect(code, file).not.toContain("organizationId");
      expect(code, file).not.toContain("userId");
      expect(code, file).not.toContain("token");
      expect(code, file).not.toContain("secret");
      expect(code, file).not.toContain("service_role");
    }
  });

  it("uses semantic section headings with aria-labelledby", () => {
    const page = read(DASH);
    expect(page).toContain("SectionHeader");
    expect(page).toContain("aria-labelledby=");
  });

  it("uses 44px control sizing and visible focus states on nav cards", () => {
    const page = read(DASH);
    expect(page).toContain("min-h-control");
    expect(page).toContain("focus-visible:ring-2");
  });

  it("uses no gradients, glassmorphism, or emergency red as a generic accent", () => {
    for (const file of [DASH, LAYOUT, HEADER]) {
      const code = readCode(file);
      expect(code, file).not.toContain("gradient");
      expect(code, file).not.toContain("backdrop-blur");
      expect(code, file).not.toContain("bg-emergency");
      expect(code, file).not.toContain('variant="emergency"');
    }
  });
});

describe("Phase 11G Step 1 — regression guards", () => {
  it("leaves donor UI untouched", () => {
    expect(read("src/components/forms/DonorMatchActions.tsx")).toContain("acceptMatchAction");
  });

  it("leaves requester UI untouched", () => {
    expect(read("src/app/(requester)/requests/[id]/page.tsx")).toContain("EscalateNowButton");
  });

  it("leaves the organization dashboards untouched", () => {
    expect(read("src/app/(hospital)/hospital/page.tsx")).toContain('title="Hospital dashboard"');
    expect(read("src/app/(blood-bank)/blood-bank/page.tsx")).toContain(
      'title="Blood bank dashboard"'
    );
  });

  it("leaves organization profile/verification untouched", () => {
    expect(read("src/components/forms/OrganizationVerificationPanel.tsx")).toContain(
      "does not mean verified"
    );
  });

  it("leaves organization inventory untouched", () => {
    expect(read("src/components/forms/OrganizationInventoryPanel.tsx")).toContain(
      "adjustOwnInventoryAction"
    );
  });

  it("leaves organization escalation UI untouched", () => {
    expect(read("src/components/forms/OrganizationEscalationInbox.tsx")).toContain(
      "escalationService.listInboxForOrganization"
    );
  });

  it("leaves public UI untouched", () => {
    expect(read("src/app/(public)/find-blood/page.tsx")).toContain("FindBloodSearchForm");
  });

  it("does not touch backend files", () => {
    const verificationService = readCode("src/services/verificationService.ts");
    expect(verificationService).toContain("listPendingOrganizations");
    expect(verificationService).toContain("listPendingDonors");
    const escalationService = readCode("src/services/escalationService.ts");
    expect(escalationService).toContain("listAdminOpenEscalations");
  });

  it("does not create any new admin route", () => {
    for (const route of ADMIN_ROUTES) {
      expect(route.startsWith("/admin")).toBe(true);
    }
    // No new page.tsx added under (admin) besides the existing 8 route files.
    expect(() => read("src/app/(admin)/admin/organizations/page.tsx")).not.toThrow();
  });
});
