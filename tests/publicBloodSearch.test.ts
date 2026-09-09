import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  PUBLIC_SEARCH_ORG_TYPES,
  PUBLIC_SEARCH_RADIUS_KM,
  publicBloodSearchSchema,
} from "@/schemas/publicBloodSearch.schema";
import {
  formatCoarseDistance,
  formatRelativeInventoryFreshness,
} from "@/lib/inventory/publicSearch";

const root = path.resolve(__dirname, "..");

const validSearch = {
  bloodGroup: "A_POS" as const,
  latitude: 23.81,
  longitude: 90.41,
  radiusKm: 10 as const,
  organizationType: "ALL" as const,
};

describe("Phase 8D public search schema", () => {
  it("accepts valid public search input with defaults shape", () => {
    expect(publicBloodSearchSchema.safeParse(validSearch).success).toBe(true);
    expect(PUBLIC_SEARCH_RADIUS_KM).toEqual([5, 10, 25, 50]);
    expect(PUBLIC_SEARCH_ORG_TYPES).toEqual(["ALL", "HOSPITAL", "BLOOD_BANK"]);
  });

  it("rejects invalid location, radius, and blood group", () => {
    expect(
      publicBloodSearchSchema.safeParse({ ...validSearch, latitude: 100 }).success
    ).toBe(false);
    expect(
      publicBloodSearchSchema.safeParse({ ...validSearch, longitude: -200 }).success
    ).toBe(false);
    expect(
      publicBloodSearchSchema.safeParse({ ...validSearch, radiusKm: 15 }).success
    ).toBe(false);
    expect(
      publicBloodSearchSchema.safeParse({ ...validSearch, radiusKm: 100 }).success
    ).toBe(false);
    expect(
      publicBloodSearchSchema.safeParse({ ...validSearch, bloodGroup: "A+" }).success
    ).toBe(false);
  });
});

describe("Phase 8D formatting helpers", () => {
  it("formats coarse distance without meter precision", () => {
    expect(formatCoarseDistance(1)).toBe("1 km away");
    expect(formatCoarseDistance(4.2)).toBe("5 km away");
  });

  it("formats relative freshness without unit counts", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    expect(
      formatRelativeInventoryFreshness("2026-09-09T11:59:30.000Z", now)
    ).toBe("Stock updated just now");
    expect(
      formatRelativeInventoryFreshness("2026-09-09T11:45:00.000Z", now)
    ).toBe("Stock updated 15 minutes ago");
    expect(
      formatRelativeInventoryFreshness("2026-09-09T10:00:00.000Z", now)
    ).toBe("Stock updated 2 hours ago");
    expect(formatRelativeInventoryFreshness(null, now)).toBeNull();
  });
});

describe("Phase 8D migration 0012", () => {
  const migration = readFileSync(
    path.join(root, "supabase/migrations/0012_public_blood_search.sql"),
    "utf8"
  );

  it("creates safe DEFINER search RPC with clamps and limits", () => {
    expect(migration).toContain("search_public_blood_availability");
    expect(migration).toContain("security definer");
    expect(migration).toContain("least(greatest");
    expect(migration).toContain("limit 25");
    expect(migration).toContain("units_available > 0");
    expect(migration).toContain("'VERIFIED'");
    expect(migration).toContain("extensions.ST_DWithin");
    expect(migration).toContain("extensions.ST_Distance");
    expect(migration).toContain("'POSSIBLE'");
  });

  it("does not restore public SELECT or return private fields", () => {
    expect(migration).not.toContain("hospitals_select_public");
    expect(migration).not.toContain("blood_banks_select_public");
    expect(migration).not.toContain("blood_inventory_select_public");
    expect(migration).not.toContain("units_available as");
    expect(migration).not.toMatch(/select[\s\S]*\blatitude\b/i);
    expect(migration).not.toMatch(/select[\s\S]*\blongitude\b/i);
    expect(migration).not.toContain("user_id");
    expect(migration).not.toContain("verified_by");
    expect(migration).not.toContain("rejection_reason");
    expect(migration).not.toContain("verification_notes");
  });

  it("grants execute to anon and authenticated for server public search", () => {
    expect(migration).toContain("to anon, authenticated");
  });
});

describe("Phase 8D service and UI privacy surface", () => {
  it("bloodAvailabilityService whitelists DTO fields and rejects private columns", () => {
    const source = readFileSync(
      path.join(root, "src/services/bloodAvailabilityService.ts"),
      "utf8"
    );
    expect(source).toContain("search_public_blood_availability");
    expect(source).toContain("createAdminClient");
    expect(source).toContain("toSafeResult");
    expect(source).toContain("units_available");
    expect(source).toContain("return null");
    expect(source).toContain('availability: "POSSIBLE"');
    expect(source).toContain("slice(0, 25)");
    expect(source).not.toContain("COMPATIBLE_DONORS");
    expect(source).not.toContain("scoreMatchCandidate");
  });

  it("public Server Action is the browser entrypoint", () => {
    const actions = readFileSync(path.join(root, "src/app/(public)/actions.ts"), "utf8");
    const form = readFileSync(
      path.join(root, "src/components/forms/FindBloodSearchForm.tsx"),
      "utf8"
    );
    expect(actions).toContain("searchPublicBloodAvailabilityAction");
    expect(actions).toContain("bloodAvailabilityService.search");
    expect(form).toContain("searchPublicBloodAvailabilityAction");
    expect(form).toContain("Show contact");
    expect(form).toContain("Possible availability");
    expect(form).toContain("does not reserve or guarantee");
    expect(form).not.toContain("createClient");
    expect(form).not.toContain("units_available");
    expect(form).not.toContain("unitsAvailable");
  });

  it("find-blood page no longer claims Phase 4 donor search", () => {
    const page = readFileSync(path.join(root, "src/app/(public)/find-blood/page.tsx"), "utf8");
    expect(page).toContain("FindBloodSearchForm");
    expect(page).toContain("not donor matching");
    expect(page).not.toContain("Phase 4");
  });

  it("does not change Phase 7/8B/8C inventory mutation or CAN_SUPPLY paths", () => {
    const escalation = readFileSync(path.join(root, "src/services/escalationService.ts"), "utf8");
    const inventory = readFileSync(path.join(root, "src/services/inventoryService.ts"), "utf8");
    const orgActions = readFileSync(path.join(root, "src/app/(org)/actions.ts"), "utf8");
    expect(escalation).not.toContain("bloodAvailabilityService");
    expect(escalation).not.toContain("search_public_blood_availability");
    expect(inventory).toContain("adjust_own_inventory");
    expect(orgActions).toContain("CAN_SUPPLY");
    expect(orgActions).not.toContain("bloodAvailabilityService");
  });
});
