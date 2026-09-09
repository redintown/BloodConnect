import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { NOTIFICATION_KINDS } from "@/lib/constants/verification";

const root = path.resolve(__dirname, "..");

describe("Phase 9 donor verification notification kind", () => {
  it("adds DONOR_VERIFICATION to notification kinds", () => {
    expect(NOTIFICATION_KINDS).toContain("DONOR_VERIFICATION");
  });
});

describe("Phase 9 migration 0013", () => {
  const migration = readFileSync(
    path.join(root, "supabase/migrations/0013_donor_verification.sql"),
    "utf8"
  );

  it("adds verification metadata columns without creating a new enum", () => {
    expect(migration).toContain("verified_at");
    expect(migration).toContain("verified_by");
    expect(migration).toContain("rejection_reason");
    expect(migration).toContain("verification_notes");
    expect(migration).not.toContain("create type verification_status");
  });

  it("keeps existing donors safe by resetting non-VERIFIED to UNVERIFIED", () => {
    expect(migration).toContain("update donor_profiles");
    expect(migration).toContain("verification_status = 'UNVERIFIED'::verification_status");
    expect(migration).toContain("verification_status <> 'VERIFIED'::verification_status");
  });

  it("implements a donor submit RPC that only moves to PENDING", () => {
    expect(migration).toContain("submit_own_donor_verification");
    expect(migration).toContain("verification_status = 'PENDING'::verification_status");
    expect(migration).toContain(
      "where user_id = auth.uid()"
    );
    expect(migration).toContain("rejection_reason = null");
    expect(migration).toContain("verification_notes = null");
    expect(migration).toContain("'REJECTED'::verification_status");
    expect(migration).toContain("'UNVERIFIED'::verification_status");
  });

  it("hardens donor_profiles_before_write against self-verification + metadata forgery", () => {
    expect(migration).toContain("donor_profiles_before_write");
    expect(migration).toContain("Owners cannot set VERIFIED");
    expect(migration).toContain("Owners cannot set REJECTED");
    expect(migration).toContain("Invalid verification status transition");
    expect(migration).toContain("user_id is immutable");

    // Sensitive edit re-verification triggers
    expect(migration).toContain("old.verification_status = 'VERIFIED'");
    expect(migration).toContain("new.blood_group is distinct from old.blood_group");
    expect(migration).toContain("new.location is distinct from old.location");
    expect(migration).toContain("new.verification_status := 'PENDING'::verification_status");
    expect(migration).toContain("new.verified_at := null");
    expect(migration).toContain("new.verified_by := null");
  });
});

describe("Phase 9 verificationService donor surface", () => {
  it("implements session-bound donor operations and notifications", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/services/verificationService.ts"),
      "utf8"
    );

    expect(source).toContain("submitDonorVerification");
    expect(source).toContain("listPendingDonors");
    expect(source).toContain("verifyDonor");
    expect(source).toContain("rejectDonor");

    expect(source).toContain('requireRole("DONOR")');
    expect(source).toContain('requireRole("ADMIN")');

    expect(source).toContain('kind: "DONOR_VERIFICATION"');
    expect(source).toContain("DONOR_VERIFICATION_SUBMITTED");
    expect(source).toContain("DONOR_VERIFICATION_VERIFIED");
    expect(source).toContain("DONOR_VERIFICATION_REJECTED");
  });

  it("verifies and rejects donors via donor_profiles verification_status updates", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/services/verificationService.ts"),
      "utf8"
    );

    expect(source).toContain("verification_status: \"VERIFIED\"");
    expect(source).toContain("verification_status: \"REJECTED\"");
    expect(source).toContain("verified_by: adminUser.id");
    expect(source).toContain("rejection_reason: parsed.data.reason");
  });
});

describe("Phase 9 UI wiring", () => {
  it("donor profile UI exposes required verification wording + resubmit", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/components/forms/DonorProfileForm.tsx"),
      "utf8"
    );
    expect(source).toContain("Donor account is not automatically verified.");
    expect(source).toContain("Please update your profile and resubmit for verification.");
    expect(source).toContain("Resubmit for verification");
  });
});

describe("Phase 9 matching + emergency regression checks", () => {
  it("keeps REJECTED donors excluded from match candidates RPC", () => {
    const matchingRpc = readFileSync(
      path.join(root, "supabase/migrations/0005_matching.sql"),
      "utf8"
    );
    expect(matchingRpc).toContain("dp.verification_status <> 'REJECTED'::verification_status");
  });

  it("keeps REJECTED donors excluded from emergency candidates RPC", () => {
    const emergencyRpc = readFileSync(
      path.join(root, "supabase/migrations/0007_notifications_emergency.sql"),
      "utf8"
    );
    expect(emergencyRpc).toContain("dp.verification_status <> 'REJECTED'::verification_status");
  });
});

