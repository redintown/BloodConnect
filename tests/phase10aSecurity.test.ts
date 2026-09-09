import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { mapAuthError } from "@/lib/auth/mapAuthError";
import {
  DONOR_DISTANCE_BANDS_KM,
  toCoarseDistanceBandKm,
} from "@/lib/matching/distancePrivacy";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 10A H1 — role self-insert hardening", () => {
  const migration = read("supabase/migrations/0014_phase10a_security_hardening.sql");
  const authService = read("src/services/authService.ts");

  it("drops client user_roles self-insert policy", () => {
    expect(migration).toContain('drop policy if exists "user_roles_insert_own_non_admin"');
    expect(migration).toContain("handle_new_user");
  });

  it("assignInitialRole uses service-role only (no client INSERT reliance)", () => {
    expect(authService).toContain("tryAdminInsertRole");
    expect(authService).toMatch(
      /assignInitialRole[\s\S]*tryAdminInsertRole\(userId, role\)/
    );
    expect(authService).not.toMatch(
      /assignInitialRole[\s\S]*insertRole\(createClient\(\)/
    );
    expect(authService).toContain("session.id !== userId");
  });
});

describe("Phase 10A H2 — org RPC role checks", () => {
  const migration = read("supabase/migrations/0014_phase10a_security_hardening.sql");

  it("requires matching app role on org create/update/submit/location RPCs", () => {
    expect(migration).toContain("require_own_app_role");
    expect(migration).toContain("require_own_app_role('HOSPITAL'");
    expect(migration).toContain("require_own_app_role('BLOOD_BANK'");
    expect(migration).toContain("create_own_hospital_profile");
    expect(migration).toContain("submit_own_hospital_verification");
    expect(migration).toContain("create_own_blood_bank_profile");
    expect(migration).toContain("own_hospital_location");
    expect(migration).toContain("own_blood_bank_location");
  });
});

describe("Phase 10A H3 — coarse donor distance", () => {
  it("maps meters to fixed km bands", () => {
    expect(DONOR_DISTANCE_BANDS_KM).toEqual([1, 2, 5, 10, 15, 30]);
    expect(toCoarseDistanceBandKm(400)).toBe(1);
    expect(toCoarseDistanceBandKm(1500)).toBe(2);
    expect(toCoarseDistanceBandKm(3200)).toBe(5);
    expect(toCoarseDistanceBandKm(12_000)).toBe(15);
    expect(toCoarseDistanceBandKm(40_000)).toBe(30);
  });

  it("client DTOs use coarse bands, not raw meters", () => {
    const domain = read("src/types/domain.ts");
    const matching = read("src/services/matchingService.ts");
    const matchResponse = read("src/services/matchResponseService.ts");
    const popup = read("src/components/forms/DonorMatchPopup.tsx");
    const actions = read("src/components/forms/DonorMatchActions.tsx");

    expect(domain).toContain("distanceBandKm");
    expect(domain).toMatch(/DonorInboxMatch[\s\S]*distanceBandKm/);
    expect(matching).toContain("toCoarseDistanceBandKm");
    expect(matchResponse).toContain("toCoarseDistanceBandKm");
    expect(matchResponse).toContain("distanceBandKm");
    expect(popup).toContain("distanceBandKm");
    expect(actions).toContain("distanceBandKm");
    expect(popup).not.toMatch(/distanceMeters\s*\/\s*1000/);
    expect(actions).not.toMatch(/distanceMeters\s*\/\s*1000/);
  });

  it("keeps exact meters for internal ranking/matching", () => {
    const ranking = read("src/lib/matching/ranking.ts");
    const scoring = read("src/lib/matching/scoring.ts");
    expect(ranking).toContain("distanceMeters");
    expect(scoring).toContain("distanceMeters");
  });
});

describe("Phase 10A H4 — public search EXECUTE + admin client", () => {
  const migration = read("supabase/migrations/0014_phase10a_security_hardening.sql");
  const service = read("src/services/bloodAvailabilityService.ts");
  const actions = read("src/app/(public)/actions.ts");
  const form = read("src/components/forms/FindBloodSearchForm.tsx");

  it("revokes anon/authenticated EXECUTE and grants service_role only", () => {
    expect(migration).toContain("search_public_blood_availability");
    expect(migration).toMatch(/revoke all[\s\S]*from anon/);
    expect(migration).toMatch(/revoke all[\s\S]*from authenticated/);
    expect(migration).toMatch(/grant execute[\s\S]*to service_role/);
    expect(migration).not.toMatch(/grant execute[\s\S]*to anon, authenticated/);
  });

  it("service uses createAdminClient; public UI stays unauthenticated Server Action", () => {
    expect(service).toContain("createAdminClient()");
    expect(service).toContain("publicBloodSearchSchema");
    expect(service).toContain("toSafeResult");
    expect(actions).toContain("searchPublicBloodAvailabilityAction");
    expect(actions).toContain("bloodAvailabilityService.search");
    expect(form).toContain("searchPublicBloodAvailabilityAction");
    expect(form).not.toContain("search_public_blood_availability");
    expect(form).not.toContain(".rpc(");
  });
});

describe("Phase 10A H5 — donation ownership via donor_profiles.user_id", () => {
  it("resolves donor profile user_id before ownership compare", () => {
    const source = read("src/services/donationService.ts");
    expect(source).toContain('.from("donor_profiles")');
    expect(source).toContain("user_id");
    expect(source).toContain("user.id === donorUserId");
    expect(source).not.toMatch(/user\.id === donorId/);
  });
});

describe("Phase 10A H6 — org verification_notes anti-forgery", () => {
  const migration = read("supabase/migrations/0014_phase10a_security_hardening.sql");

  it("locks verification_notes on hospital/blood_bank before-write triggers", () => {
    expect(migration).toContain("hospitals_before_write");
    expect(migration).toContain("blood_banks_before_write");
    expect(migration).toContain("new.verification_notes := null");
    expect(migration).toContain("new.verification_notes := old.verification_notes");
  });
});

describe("Phase 10A H7 — verify/reject requires updated row", () => {
  it("selects updated row before notify/audit for orgs and donors", () => {
    const source = read("src/services/verificationService.ts");
    expect(source).toMatch(
      /\.eq\("verification_status", "PENDING"\)[\s\S]*\.select\("id, user_id"\)[\s\S]*\.maybeSingle\(\)/
    );
    expect(source).toContain('throw AppError.conflict("Only pending organizations can be verified.")');
    expect(source).toContain('throw AppError.conflict("Only pending donors can be verified.")');
    expect(source).toContain('throw AppError.conflict("Only pending donors can be rejected.")');
    // notify/audit after updated row for donors
    expect(source).toMatch(/if \(!updated\)[\s\S]*notifyDonor/);
    expect(source).toMatch(/if \(!updated\)[\s\S]*notifyOwner/);
  });
});

describe("Phase 10A H8 — register-diag removed + rate-limit mapping", () => {
  it("has no register-diag leftovers in auth surfaces", () => {
    expect(read("src/app/(auth)/actions.ts")).not.toContain("register-diag");
    expect(read("src/services/authService.ts")).not.toContain("register-diag");
  });

  it("maps email send rate limit to AppError.rateLimited", () => {
    const err = mapAuthError({
      code: "over_email_send_rate_limit",
      message: "email rate limit exceeded",
      status: 429,
    });
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.status).toBe(429);
    expect(err.userMessage).toContain("Too many attempts");
  });
});
