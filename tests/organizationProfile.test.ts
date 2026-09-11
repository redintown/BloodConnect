import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { hospitalProfileSchema, orgRejectSchema } from "@/schemas/hospital.schema";
import { bloodBankProfileSchema } from "@/schemas/bloodBank.schema";
import { NOTIFICATION_KINDS, VERIFICATION_STATUSES } from "@/lib/constants/verification";

const root = path.resolve(__dirname, "..");

const validHospital = {
  name: "City General Hospital",
  contactPhone: "+8801700000001",
  address: "123 Medical Road, Dhaka",
  location: { latitude: 23.81, longitude: 90.41 },
  has24hEmergency: true,
};

const validBank = {
  name: "Central Blood Bank",
  contactPhone: "+8801700000002",
  address: "45 Donation Avenue, Dhaka",
  location: { latitude: 23.75, longitude: 90.39 },
  emergencyHours: "24/7",
};

describe("Phase 8A schemas", () => {
  it("requires location for hospital and blood bank profiles", () => {
    expect(hospitalProfileSchema.safeParse(validHospital).success).toBe(true);
    expect(
      hospitalProfileSchema.safeParse({ ...validHospital, location: null }).success
    ).toBe(false);
    expect(bloodBankProfileSchema.safeParse(validBank).success).toBe(true);
    expect(bloodBankProfileSchema.safeParse({ ...validBank, location: undefined }).success).toBe(
      false
    );
  });

  it("requires a rejection reason for admin reject", () => {
    expect(
      orgRejectSchema.safeParse({
        organizationId: "11111111-1111-1111-1111-111111111111",
        reason: "Incomplete documents",
      }).success
    ).toBe(true);
    expect(
      orgRejectSchema.safeParse({
        organizationId: "11111111-1111-1111-1111-111111111111",
        reason: "no",
      }).success
    ).toBe(false);
  });

  it("keeps existing verification status enum values", () => {
    expect(VERIFICATION_STATUSES).toEqual(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]);
  });

  it("adds ORG_VERIFICATION notification kind", () => {
    expect(NOTIFICATION_KINDS).toContain("ORG_VERIFICATION");
  });
});

describe("Phase 8A migration 0010", () => {
  const migration = readFileSync(
    path.join(root, "supabase/migrations/0010_organization_profile_verification.sql"),
    "utf8"
  );

  it("adds ownership uniqueness and location indexes", () => {
    expect(migration).toContain("idx_hospitals_one_per_user");
    expect(migration).toContain("idx_blood_banks_one_per_user");
    expect(migration).toContain("idx_hospitals_location");
    expect(migration).toContain("idx_blood_banks_location");
    expect(migration).toContain("using gist");
  });

  it("adds verification metadata without a second enum", () => {
    expect(migration).toContain("verified_at");
    expect(migration).toContain("verified_by");
    expect(migration).toContain("rejection_reason");
    expect(migration).toContain("verification_notes");
    expect(migration).not.toContain("create type verification_status");
  });

  it("hardens RLS and drops broad public full-row select", () => {
    expect(migration).toContain('drop policy if exists "hospitals_select_public"');
    expect(migration).toContain('drop policy if exists "blood_banks_select_public"');
    expect(migration).toContain("hospitals_select_own");
    expect(migration).toContain("hospitals_insert_own");
    expect(migration).toContain("hospitals_update_own");
    expect(migration).toContain("blood_banks_select_own");
    expect(migration).toContain("blood_banks_insert_own");
    expect(migration).toContain("blood_banks_update_own");
  });

  it("prevents owner self-verify and re-verifies on sensitive edits", () => {
    expect(migration).toContain("Owners cannot set VERIFIED");
    expect(migration).toContain("Owners cannot set REJECTED");
    expect(migration).toContain("user_id is immutable");
    expect(migration).toContain("old.verification_status = 'VERIFIED'");
    expect(migration).toContain("new.name is distinct from old.name");
    expect(migration).toContain("new.phone is distinct from old.phone");
    expect(migration).toContain("new.address is distinct from old.address");
    expect(migration).toContain("new.location is distinct from old.location");
    expect(migration).not.toContain("has_24h_emergency is distinct from");
    expect(migration).not.toContain("emergency_hours is distinct from");
  });

  it("uses extensions.ST_* for org location RPCs", () => {
    expect(migration).toContain("extensions.ST_SetSRID");
    expect(migration).toContain("extensions.ST_MakePoint");
    expect(migration).toContain("create_own_hospital_profile");
    expect(migration).toContain("create_own_blood_bank_profile");
    expect(migration).toContain("submit_own_hospital_verification");
    expect(migration).toContain("submit_own_blood_bank_verification");
    expect(migration).toContain("ORG_VERIFICATION");
  });
});

describe("Phase 8A services and authorization surface", () => {
  it("implements session-bound hospitalService without client userId auth", () => {
    const source = readFileSync(path.join(root, "src/services/hospitalService.ts"), "utf8");
    expect(source).toContain("createOwnProfile");
    expect(source).toContain("updateOwnProfile");
    expect(source).toContain("submitVerification");
    expect(source).toContain('requireRole("HOSPITAL")');
    expect(source).toContain("create_own_hospital_profile");
    expect(source).not.toContain("NotImplementedError");
    expect(source).not.toMatch(/createOwnProfile\([^)]*userId/);
  });

  it("implements session-bound bloodBankService without client userId auth", () => {
    const source = readFileSync(path.join(root, "src/services/bloodBankService.ts"), "utf8");
    expect(source).toContain("createOwnProfile");
    expect(source).toContain("updateOwnProfile");
    expect(source).toContain("submitVerification");
    expect(source).toContain('requireRole("BLOOD_BANK")');
    expect(source).toContain("create_own_blood_bank_profile");
    expect(source).not.toContain("NotImplementedError");
  });

  it("implements ADMIN-only verificationService org operations", () => {
    const source = readFileSync(path.join(root, "src/services/verificationService.ts"), "utf8");
    expect(source).toContain("listPendingOrganizations");
    expect(source).toContain("verifyHospital");
    expect(source).toContain("rejectHospital");
    expect(source).toContain("verifyBloodBank");
    expect(source).toContain("rejectBloodBank");
    expect(source).toContain('requireRole("ADMIN")');
    expect(source).toContain("ORG_VERIFICATION");
    expect(source).toContain("rejection_reason");
  });

  it("verificationService sets verified_by on verify but does not put it in notification data", () => {
    const source = readFileSync(path.join(root, "src/services/verificationService.ts"), "utf8");
    expect(source).toContain("verified_by: adminUser.id");
    expect(source).toContain('kind: "ORG_VERIFICATION"');
    const notifyFn = source.slice(source.indexOf("async function notifyOwner"), source.indexOf("export const verificationService"));
    expect(notifyFn).not.toContain("verified_by");
    expect(notifyFn).not.toContain("verifiedBy");
  });

  it("does not implement Phase 8C escalation inventory wiring in Phase 8A services", () => {
    const escalation = readFileSync(path.join(root, "src/services/escalationService.ts"), "utf8");
    expect(escalation).not.toContain("inventoryService");
    expect(escalation).not.toContain("units_available");
  });
});

describe("Phase 8A UI wiring", () => {
  it("adds hospital and blood bank profile pages", () => {
    const hospital = readFileSync(
      path.join(root, "src/app/(hospital)/hospital/profile/page.tsx"),
      "utf8"
    );
    const bank = readFileSync(
      path.join(root, "src/app/(blood-bank)/blood-bank/profile/page.tsx"),
      "utf8"
    );
    expect(hospital).toContain("HospitalProfileForm");
    expect(bank).toContain("BloodBankProfileForm");
  });

  it("adds admin organization verification page, distinct from the donor verification queue", () => {
    const orgs = readFileSync(
      path.join(root, "src/app/(admin)/admin/organizations/page.tsx"),
      "utf8"
    );
    const adminHome = readFileSync(path.join(root, "src/app/(admin)/admin/page.tsx"), "utf8");
    expect(orgs).toContain("listPendingOrganizations");
    // Donor verification (Phase 9) shipped as its own queue at /admin/donors —
    // this assertion no longer claims it "remains Phase 9" (Phase 11G Step 2).
    expect(orgs).not.toContain("Donor verification remains Phase 9");
    expect(adminHome).toContain("/admin/organizations");
  });

  it("preserves Phase 7 escalation inbox routes", () => {
    const hospitalRequests = readFileSync(
      path.join(root, "src/app/(hospital)/hospital/requests/page.tsx"),
      "utf8"
    );
    const bankRequests = readFileSync(
      path.join(root, "src/app/(blood-bank)/blood-bank/requests/page.tsx"),
      "utf8"
    );
    expect(hospitalRequests).toContain("OrganizationEscalationInbox");
    expect(bankRequests).toContain("OrganizationEscalationInbox");
  });
});

describe("Phase 8A docs", () => {
  it("documents organization verification as Phase 8A and donor verification as Phase 9", () => {
    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    expect(readme).toContain("8A");
    expect(readme).toMatch(/donor verification/i);
    expect(readme).toContain("Phase 9");
  });
});
