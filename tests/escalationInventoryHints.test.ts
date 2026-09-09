import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  formatOwnInventoryHint,
  formatRequesterCanSupplyInventoryHint,
  unitsForBloodGroup,
} from "@/lib/inventory/hints";

const root = path.resolve(__dirname, "..");

describe("Phase 8C inventory hints", () => {
  it("maps missing blood groups to zero", () => {
    const map = new Map([["O_POS" as const, 5]]);
    expect(unitsForBloodGroup(map, "O_POS")).toBe(5);
    expect(unitsForBloodGroup(map, "A_NEG")).toBe(0);
  });

  it("formats owner-facing exact inventory without guaranteeing supply", () => {
    expect(formatOwnInventoryHint("A_POS", 5)).toContain("5 unit");
    expect(formatOwnInventoryHint("A_POS", 5)).toMatch(/hint only|not a guarantee/i);
    expect(formatOwnInventoryHint("O_NEG", 0)).toMatch(/no units/i);
  });

  it("formats requester-facing hint without exact counts", () => {
    const hint = formatRequesterCanSupplyInventoryHint();
    expect(hint).toMatch(/may be available/i);
    expect(hint).not.toMatch(/\d+\s*unit/i);
    expect(hint).toMatch(/not reserved|not guaranteed/i);
  });
});

describe("Phase 8C escalation + inventory integration surface", () => {
  it("organization inbox loads inventory once via inventoryService", () => {
    const source = readFileSync(
      path.join(root, "src/components/forms/OrganizationEscalationInbox.tsx"),
      "utf8"
    );
    expect(source).toContain("inventoryService.getOwnUnitsByBloodGroupMap");
    expect(source).toContain("formatOwnInventoryHint");
    expect(source).toContain("Your inventory");
    expect(source).toContain("Can Supply does not change stock");
    expect(source).not.toContain("adjustInventory");
    expect(source).not.toContain("adjust_own_inventory");
    expect(source).not.toContain('.from("blood_inventory")');
  });

  it("requester UI shows safe CAN_SUPPLY hint without exact units", () => {
    const source = readFileSync(
      path.join(root, "src/app/(requester)/requests/[id]/page.tsx"),
      "utf8"
    );
    expect(source).toContain("formatRequesterCanSupplyInventoryHint");
    expect(source).toContain("Response: Can Supply");
    expect(source).not.toContain("unitsAvailable");
    expect(source).not.toContain("getOwnUnitsByBloodGroupMap");
    expect(source).not.toContain("inventoryService");
  });

  it("escalationService still does not mutate inventory on respond", () => {
    const source = readFileSync(path.join(root, "src/services/escalationService.ts"), "utf8");
    expect(source).toContain("respondAsOrganization");
    expect(source).toContain("CAN_SUPPLY");
    expect(source).not.toContain("inventoryService");
    expect(source).not.toContain("adjust_own_inventory");
    expect(source).not.toContain("units_available");
    expect(source).not.toContain("INVENTORY_ADJUSTED");
  });

  it("inventoryService exposes map helper and keeps adjust separate", () => {
    const source = readFileSync(path.join(root, "src/services/inventoryService.ts"), "utf8");
    expect(source).toContain("getOwnUnitsByBloodGroupMap");
    expect(source).toContain("adjustInventory");
    expect(source).toContain("CAN_SUPPLY must never adjust stock");
  });

  it("org response action does not call inventory adjust", () => {
    const source = readFileSync(path.join(root, "src/app/(org)/actions.ts"), "utf8");
    expect(source).toContain("respondAsOrganization");
    expect(source).toContain("CAN_SUPPLY");
    expect(source).not.toContain("inventoryService");
    expect(source).not.toContain("adjustOwnInventoryAction");
  });

  it("does not add a Phase 8C migration (public find-blood is Phase 8D)", () => {
    let has0012Hints = false;
    try {
      readFileSync(path.join(root, "supabase/migrations/0012_escalation_inventory_hints.sql"), "utf8");
      has0012Hints = true;
    } catch {
      has0012Hints = false;
    }
    expect(has0012Hints).toBe(false);

    const findBlood = readFileSync(path.join(root, "src/app/(public)/find-blood/page.tsx"), "utf8");
    expect(findBlood).toContain("FindBloodSearchForm");
    expect(findBlood).toContain("not donor matching");
  });
});
