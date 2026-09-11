import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { adjustInventorySchema, INVENTORY_DELTA_ABS_MAX } from "@/schemas/inventory.schema";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";

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

const H_PAGE = "src/app/(hospital)/hospital/inventory/page.tsx";
const BB_PAGE = "src/app/(blood-bank)/blood-bank/inventory/page.tsx";
const PANEL = "src/components/forms/OrganizationInventoryPanel.tsx";
const H_LOADING = "src/app/(hospital)/hospital/inventory/loading.tsx";
const BB_LOADING = "src/app/(blood-bank)/blood-bank/inventory/loading.tsx";

const PAGES = [H_PAGE, BB_PAGE];

describe("Phase 11F Step 3 — inventory routes", () => {
  it("keeps the existing inventory routes and owner-scoped fetches", () => {
    const hospital = read(H_PAGE);
    expect(hospital).toContain('inventoryService.getOwnInventory("HOSPITAL")');
    expect(hospital).toContain("hospitalService.getOwnLinkedOrg()");
    expect(hospital).toContain("OrganizationInventoryPanel");

    const bank = read(BB_PAGE);
    expect(bank).toContain('inventoryService.getOwnInventory("BLOOD_BANK")');
    expect(bank).toContain("bloodBankService.getOwnLinkedOrg()");
    expect(bank).toContain("OrganizationInventoryPanel");
  });

  it("moves both pages onto PageHeader without a second main landmark or max-w-lg", () => {
    for (const page of PAGES) {
      const source = read(page);
      expect(source, page).toContain("PageHeader");
      expect(source, page).not.toContain("PageShell");
      expect(source, page).not.toContain("<main");
      expect(source, page).not.toContain("max-w-lg");
    }
  });

  it("shows a calm empty state when no organization profile exists yet", () => {
    for (const page of PAGES) {
      const source = read(page);
      expect(source, page).toContain("if (!org)");
      expect(source, page).toContain("EmptyState");
      expect(source, page).toMatch(/No (hospital|blood bank) profile yet/);
    }
  });

  it("adds a card-shaped loading state for each inventory route", () => {
    for (const loading of [H_LOADING, BB_LOADING]) {
      const source = read(loading);
      expect(source, loading).toContain('role="status"');
      expect(source, loading).toContain("sr-only");
    }
  });
});

describe("Phase 11F Step 3 — unchanged contracts", () => {
  it("edits through the existing delta-adjustment action only", () => {
    const panel = read(PANEL);
    expect(panel).toContain("adjustOwnInventoryAction");
    expect(panel).toContain("Add");
    expect(panel).toContain("Remove");
  });

  it("keeps the exact adjustment payload shape (bloodGroup, delta, reason)", () => {
    expect(Object.keys(adjustInventorySchema.shape).sort()).toEqual([
      "bloodGroup",
      "delta",
      "reason",
    ]);
    const panel = readCode(PANEL);
    expect(panel).toContain("bloodGroup,");
    expect(panel).toContain("delta,");
    expect(panel).toContain("reason: reason.trim() || null");
  });

  it("preserves existing delta validation (integer, non-zero, bounded)", () => {
    expect(adjustInventorySchema.safeParse({ bloodGroup: "O_POS", delta: 0 }).success).toBe(false);
    expect(adjustInventorySchema.safeParse({ bloodGroup: "O_POS", delta: 1.5 }).success).toBe(
      false
    );
    expect(
      adjustInventorySchema.safeParse({
        bloodGroup: "O_POS",
        delta: INVENTORY_DELTA_ABS_MAX + 1,
      }).success
    ).toBe(false);
    expect(adjustInventorySchema.safeParse({ bloodGroup: "O_POS", delta: 5 }).success).toBe(true);
  });

  it("adds no new queries, endpoints, actions or stock calculations", () => {
    for (const file of [...PAGES, PANEL]) {
      const code = readCode(file);
      expect(code, file).not.toContain("createClient");
      expect(code, file).not.toContain("supabase");
      expect(code, file).not.toContain("fetch(");
      expect(code, file).not.toContain(".from(");
      expect(code, file).not.toContain(".rpc(");
    }
    const panel = readCode(PANEL);
    // No client-side recomputation of stock — only the server result is trusted.
    expect(panel).not.toMatch(/unitsAvailable\s*[+\-]=/);
    expect(panel).not.toContain("totalUnits");
    expect(panel).not.toContain("lowStock");
  });

  it("reuses one shared panel for both organization types (same data contract)", () => {
    const hospitalUsesShared = read(H_PAGE).includes("OrganizationInventoryPanel");
    const bankUsesShared = read(BB_PAGE).includes("OrganizationInventoryPanel");
    expect(hospitalUsesShared && bankUsesShared).toBe(true);
    expect(read(H_PAGE)).toContain('organizationType="HOSPITAL"');
    expect(read(BB_PAGE)).toContain('organizationType="BLOOD_BANK"');
  });

  it("keeps the one-row-per-blood-group model and touches no inventory fields", () => {
    const panel = readCode(PANEL);
    for (const group of BLOOD_GROUPS) {
      expect(panel).not.toContain(`"${group}_ONLY"`);
    }
    expect(panel).not.toContain("hospital_id");
    expect(panel).not.toContain("blood_bank_id");
  });
});

describe("Phase 11F Step 3 — blood group and quantity presentation", () => {
  it("shows human blood-group labels, never raw enum values", () => {
    const panel = read(PANEL);
    expect(panel).toContain("BLOOD_GROUP_LABELS");
    for (const group of BLOOD_GROUPS) {
      expect(panel).not.toMatch(new RegExp(`>${group}<`));
    }
    expect(BLOOD_GROUP_LABELS.O_NEG).toBe("O−");
    expect(BLOOD_GROUP_LABELS.A_POS).toBe("A+");
  });

  it("does not style ordinary blood groups with emergency red", () => {
    const panel = readCode(PANEL);
    expect(panel).not.toContain("BloodGroupBadge");
    expect(panel).not.toContain("text-emergency");
    expect(panel).not.toContain("bg-emergency");
  });

  it("shows quantity as units available, with no invented totals or percentages", () => {
    const panel = read(PANEL);
    expect(panel).toContain("unitsAvailable");
    expect(panel).toContain("units available");
    const code = readCode(PANEL);
    expect(code).not.toMatch(/%/);
    expect(code).not.toContain("trend");
    expect(code).not.toContain("capacity");
    expect(code).not.toContain("predict");
  });

  it("does not invent a low-stock or availability label from quantity", () => {
    const code = readCode(PANEL);
    expect(code).not.toMatch(/low.?stock/i);
    expect(code).not.toMatch(/out of stock/i);
    expect(code).not.toMatch(/\bcritical\b/i);
    expect(code).not.toContain('"Available"');
    expect(code).not.toContain('"Unavailable"');
  });
});

describe("Phase 11F Step 3 — freshness", () => {
  it("presents the existing updatedAt without inventing a freshness threshold", () => {
    const panel = read(PANEL);
    expect(panel).toContain("updatedAt");
    expect(panel).toContain("formatUpdated");
    const code = readCode(PANEL);
    expect(code).not.toMatch(/\bstale\b/i);
    expect(code).not.toMatch(/\boutdated\b/i);
    expect(code).not.toMatch(/\bfresh\b/i);
  });

  it("reads the service's own never-recorded sentinel instead of showing an epoch date", () => {
    const panel = read(PANEL);
    expect(panel).toContain("new Date(0).toISOString()");
    expect(panel).toContain("Not yet recorded");
    // Matches inventoryService's fallback exactly, so this is not a new calculation.
    const service = read("src/services/inventoryService.ts");
    expect(service).toContain("new Date(0).toISOString()");
  });
});

describe("Phase 11F Step 3 — editing UX", () => {
  it("guards against duplicate submits while an adjustment is in flight", () => {
    const panel = readCode(PANEL);
    expect(panel).toContain("if (busyGroup) return;");
    expect(panel).toContain("busyGroup !== null");
    expect(panel).toContain('loadingLabel="Adding…"');
    expect(panel).toContain('loadingLabel="Removing…"');
  });

  it("shows validation errors inline on the field that failed", () => {
    const panel = read(PANEL);
    expect(panel).toContain("Enter a positive whole number of units.");
    expect(panel).toContain("aria-invalid={invalid || undefined}");
    expect(panel).toContain("aria-describedby={invalid ? errorId : undefined}");
  });

  it("maps server errors to human-readable inline feedback", () => {
    const panel = read(PANEL);
    expect(panel).toContain('if ("error" in result)');
    expect(panel).toContain("setRowError({ group: bloodGroup, message: result.error })");
  });

  it("shows success feedback with the same before/after/delta template", () => {
    const panel = read(PANEL);
    expect(panel).toContain("updated:");
    expect(panel).toContain("result.oldUnits");
    expect(panel).toContain("result.newUnits");
    expect(panel).toContain("result.delta");
  });

  it("keeps explicit Save-style actions, no autosave on every keystroke", () => {
    const panel = readCode(PANEL);
    expect(panel).not.toContain("useEffect");
    expect(panel).not.toContain("debounce");
    expect(panel).toContain("onClick={() => void adjust(item.bloodGroup, 1)}");
    expect(panel).toContain("onClick={() => void adjust(item.bloodGroup, -1)}");
  });

  it("adds no add/delete record controls, since none exist in the backend", () => {
    const panel = readCode(PANEL);
    expect(panel).not.toContain("ConfirmDialog");
    expect(panel).not.toContain("window.confirm");
    expect(panel).not.toContain("delete");
    expect(panel).not.toContain("New record");
  });
});

describe("Phase 11F Step 3 — privacy", () => {
  it("never renders internal ids or ownership identifiers", () => {
    for (const file of [...PAGES, PANEL]) {
      const code = readCode(file);
      expect(code, file).not.toContain("item.id");
      expect(code, file).not.toContain("ownerId");
      expect(code, file).not.toContain("organizationId");
      expect(code, file).not.toMatch(/\{\s*org\.id\s*\}/);
    }
  });

  it("does not expose admin, donor, or requester data on the inventory route", () => {
    for (const file of [...PAGES, PANEL]) {
      const code = readCode(file);
      expect(code, file).not.toContain("donor");
      expect(code, file).not.toContain("requester");
      expect(code, file).not.toContain("admin");
    }
  });

  it("does not extend public inventory exposure", () => {
    for (const file of [...PAGES, PANEL]) {
      const code = readCode(file);
      expect(code, file).not.toContain("find-blood");
      expect(code, file).not.toContain("public");
    }
  });
});

describe("Phase 11F Step 3 — accessibility and visual system", () => {
  it("uses one visible page title and grouped, labelled controls per record", () => {
    for (const page of PAGES) {
      const source = read(page);
      expect(source, page).toContain('title="Blood inventory"');
    }
    const panel = read(PANEL);
    expect(panel).toContain('role="group"');
    expect(panel).toContain("aria-labelledby={headingId}");
    expect(panel).toContain('htmlFor={amountId}');
  });

  it("uses the shared field control classes for 44px targets and focus states", () => {
    const panel = read(PANEL);
    expect(panel).toContain("fieldControlClassName");
    expect(read("src/components/ui/FormField.tsx")).toContain("min-h-control");
    expect(read("src/components/ui/Button.tsx")).toContain("min-h-control");
  });

  it("uses no gradients, glassmorphism, or emergency red for ordinary saves", () => {
    for (const file of [...PAGES, PANEL]) {
      const code = readCode(file);
      expect(code, file).not.toContain("gradient");
      expect(code, file).not.toContain("backdrop-blur");
      expect(code, file).not.toContain('variant="emergency"');
      expect(code, file).not.toContain("animate-pulse");
    }
  });

  it("has no horizontally-overflowing fixed-width table", () => {
    const panel = readCode(PANEL);
    expect(panel).not.toContain("<table");
    expect(panel).not.toContain("overflow-x-auto");
    expect(panel).not.toContain("min-w-full");
  });
});

describe("Phase 11F Step 3 — regression guards", () => {
  it("leaves the organization dashboards untouched", () => {
    const hospitalDash = read("src/app/(hospital)/hospital/page.tsx");
    const bankDash = read("src/app/(blood-bank)/blood-bank/page.tsx");
    expect(hospitalDash).toContain('title="Hospital dashboard"');
    expect(hospitalDash).toContain("hospitalService.getOwnProfile()");
    expect(bankDash).toContain('title="Blood bank dashboard"');
    expect(bankDash).toContain("bloodBankService.getOwnProfile()");
  });

  it("leaves profile and verification presentation untouched", () => {
    expect(read("src/app/(hospital)/hospital/profile/page.tsx")).toContain("HospitalProfileForm");
    expect(read("src/app/(blood-bank)/blood-bank/profile/page.tsx")).toContain(
      "BloodBankProfileForm"
    );
    expect(read("src/components/forms/OrganizationVerificationPanel.tsx")).toContain(
      "does not mean verified"
    );
  });

  it("leaves the escalation inbox untouched", () => {
    const hospitalRequests = read("src/app/(hospital)/hospital/requests/page.tsx");
    const bankRequests = read("src/app/(blood-bank)/blood-bank/requests/page.tsx");
    expect(hospitalRequests).toContain("OrganizationEscalationInbox");
    expect(bankRequests).toContain("OrganizationEscalationInbox");
  });

  it("leaves escalation's read-only inventory hint untouched", () => {
    const inbox = read("src/components/forms/OrganizationEscalationInbox.tsx");
    expect(inbox).toContain("inventoryService.getOwnUnitsByBloodGroupMap");
    expect(inbox).toContain("Can Supply does not change stock");
    expect(inbox).not.toContain("adjustInventory");
  });

  it("does not touch backend files", () => {
    const service = read("src/services/inventoryService.ts");
    expect(service).toContain("adjust_own_inventory");
    expect(service).toContain('requireRole("HOSPITAL")');
    expect(service).toContain('requireRole("BLOOD_BANK")');
    const schema = read("src/schemas/inventory.schema.ts");
    expect(Object.keys(adjustInventorySchema.shape)).toContain("bloodGroup");
    expect(schema).toContain("INVENTORY_DELTA_ABS_MAX");
  });
});
