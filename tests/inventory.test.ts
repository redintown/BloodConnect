import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  adjustInventorySchema,
  INVENTORY_DELTA_ABS_MAX,
} from "@/schemas/inventory.schema";
import { BLOOD_GROUPS } from "@/lib/constants/bloodGroups";

const root = path.resolve(__dirname, "..");

describe("Phase 8B inventory schema", () => {
  it("accepts integer non-zero deltas within bound", () => {
    expect(
      adjustInventorySchema.safeParse({
        bloodGroup: "O_POS",
        delta: 5,
        reason: "Restock",
      }).success
    ).toBe(true);
    expect(
      adjustInventorySchema.safeParse({
        bloodGroup: "A_NEG",
        delta: -2,
      }).success
    ).toBe(true);
  });

  it("rejects zero, non-integer, invalid group, oversized delta, long reason", () => {
    expect(adjustInventorySchema.safeParse({ bloodGroup: "O_POS", delta: 0 }).success).toBe(false);
    expect(adjustInventorySchema.safeParse({ bloodGroup: "O_POS", delta: 1.5 }).success).toBe(
      false
    );
    expect(adjustInventorySchema.safeParse({ bloodGroup: "O+", delta: 1 }).success).toBe(false);
    expect(
      adjustInventorySchema.safeParse({
        bloodGroup: "O_POS",
        delta: INVENTORY_DELTA_ABS_MAX + 1,
      }).success
    ).toBe(false);
    expect(
      adjustInventorySchema.safeParse({
        bloodGroup: "O_POS",
        delta: 1,
        reason: "x".repeat(301),
      }).success
    ).toBe(false);
  });

  it("reuses project blood group constants", () => {
    expect(BLOOD_GROUPS).toHaveLength(8);
    for (const bloodGroup of BLOOD_GROUPS) {
      expect(adjustInventorySchema.safeParse({ bloodGroup, delta: 1 }).success).toBe(true);
    }
  });
});

describe("Phase 8B migration 0011", () => {
  const migration = readFileSync(
    path.join(root, "supabase/migrations/0011_blood_inventory.sql"),
    "utf8"
  );

  it("adds non-negative check and owner SELECT RLS only", () => {
    expect(migration).toContain("blood_inventory_units_non_negative");
    expect(migration).toContain("units_available >= 0");
    expect(migration).toContain("blood_inventory_select_own_hospital");
    expect(migration).toContain("blood_inventory_select_own_blood_bank");
    expect(migration).not.toContain("blood_inventory_insert_own");
    expect(migration).not.toContain("blood_inventory_update_own");
    expect(migration).not.toContain("blood_inventory_select_public");
  });

  it("implements atomic adjust RPC with audit and insufficient-stock reject", () => {
    expect(migration).toContain("adjust_own_inventory");
    expect(migration).toContain("for update");
    expect(migration).toContain("INVENTORY_ADJUSTED");
    expect(migration).toContain("audit_logs");
    expect(migration).toContain("BC_INSUFFICIENT");
    expect(migration).toContain("oldUnits");
    expect(migration).toContain("newUnits");
    expect(migration).toContain("delta");
    expect(migration).toContain("security definer");
    expect(migration).not.toContain("reserved_units");
    expect(migration).not.toContain("expired_units");
  });

  it("does not grant inventory RPC to anon/public", () => {
    expect(migration).toContain("revoke all on function public.adjust_own_inventory");
    expect(migration).toContain("grant execute on function public.adjust_own_inventory");
    expect(migration).toContain("to authenticated");
  });
});

describe("Phase 8B inventoryService + UI surface", () => {
  it("implements session-bound inventoryService without client org ids", () => {
    const source = readFileSync(path.join(root, "src/services/inventoryService.ts"), "utf8");
    expect(source).toContain("getOwnInventory");
    expect(source).toContain("adjustInventory");
    expect(source).toContain("adjust_own_inventory");
    expect(source).toContain("getOwnLinkedOrg");
    expect(source).toContain('requireRole("HOSPITAL")');
    expect(source).toContain('requireRole("BLOOD_BANK")');
    expect(source).toContain("BLOOD_GROUPS.map");
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toMatch(/adjustInventory\([^)]*hospitalId/);
    expect(source).not.toMatch(/adjustInventory\([^)]*bloodBankId/);
  });

  it("keeps Phase 7 escalation free of inventory mutations", () => {
    const escalation = readFileSync(path.join(root, "src/services/escalationService.ts"), "utf8");
    expect(escalation).not.toContain("inventoryService");
    expect(escalation).not.toContain("adjust_own_inventory");
    expect(escalation).not.toContain("units_available");
    expect(escalation).toContain("CAN_SUPPLY");
  });

  it("wires hospital and blood bank inventory pages", () => {
    const hospital = readFileSync(
      path.join(root, "src/app/(hospital)/hospital/inventory/page.tsx"),
      "utf8"
    );
    const bank = readFileSync(
      path.join(root, "src/app/(blood-bank)/blood-bank/inventory/page.tsx"),
      "utf8"
    );
    const panel = readFileSync(
      path.join(root, "src/components/forms/OrganizationInventoryPanel.tsx"),
      "utf8"
    );
    expect(hospital).toContain("OrganizationInventoryPanel");
    expect(bank).toContain("OrganizationInventoryPanel");
    expect(panel).toContain("adjustOwnInventoryAction");
    expect(panel).toContain("Add");
    expect(panel).toContain("Remove");
  });

  it("documents concurrent non-negative intent in RPC (FOR UPDATE + check)", () => {
    const migration = readFileSync(
      path.join(root, "supabase/migrations/0011_blood_inventory.sql"),
      "utf8"
    );
    // Two concurrent -7 from 10: one wins to 3, other raises BC_INSUFFICIENT.
    expect(migration).toMatch(/v_new := v_old \+ p_delta/);
    expect(migration).toMatch(/if v_new < 0 then/);
  });
});

describe("Phase 8B audit security surface", () => {
  it("does not expose client write policies on audit_logs in 0011", () => {
    const migration = readFileSync(
      path.join(root, "supabase/migrations/0011_blood_inventory.sql"),
      "utf8"
    );
    expect(migration).not.toContain("audit_logs for insert");
    expect(migration).not.toContain("audit_logs for update");
    expect(migration).not.toContain("audit_logs for delete");
    expect(migration).toContain("insert into audit_logs");
  });
});
