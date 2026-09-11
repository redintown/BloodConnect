import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { hospitalProfileSchema } from "@/schemas/hospital.schema";
import { bloodBankProfileSchema } from "@/schemas/bloodBank.schema";
import { VERIFICATION_STATUSES } from "@/lib/constants/verification";
import { VERIFICATION_STATUS_LABELS } from "@/components/ui/StatusChip";

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

const H_PAGE = "src/app/(hospital)/hospital/profile/page.tsx";
const BB_PAGE = "src/app/(blood-bank)/blood-bank/profile/page.tsx";
const H_FORM = "src/components/forms/HospitalProfileForm.tsx";
const BB_FORM = "src/components/forms/BloodBankProfileForm.tsx";
const PANEL = "src/components/forms/OrganizationVerificationPanel.tsx";
const H_LOADING = "src/app/(hospital)/hospital/profile/loading.tsx";
const BB_LOADING = "src/app/(blood-bank)/blood-bank/profile/loading.tsx";

const FORMS = [H_FORM, BB_FORM];
const PAGES = [H_PAGE, BB_PAGE];

describe("Phase 11F Step 2 — organization profile routes", () => {
  it("keeps the existing profile routes and owner-scoped fetches", () => {
    const hospital = read(H_PAGE);
    expect(hospital).toContain("hospitalService.getOwnProfile()");
    expect(hospital).toContain("HospitalProfileForm");

    const bank = read(BB_PAGE);
    expect(bank).toContain("bloodBankService.getOwnProfile()");
    expect(bank).toContain("BloodBankProfileForm");
  });

  it("moves both pages onto PageHeader without a second main landmark", () => {
    for (const page of PAGES) {
      const source = read(page);
      expect(source, page).toContain("PageHeader");
      expect(source, page).toContain("max-w-form");
      expect(source, page).not.toContain("PageShell");
      expect(source, page).not.toContain("<main");
      expect(source, page).not.toContain("max-w-lg");
    }
  });

  it("shows verification status beside the title only when a profile exists", () => {
    for (const page of PAGES) {
      const source = read(page);
      expect(source, page).toContain('StatusChip kind="verification"');
      expect(source, page).toContain("profile ?");
    }
  });

  it("adds a form-shaped loading state for each profile route", () => {
    for (const loading of [H_LOADING, BB_LOADING]) {
      const source = read(loading);
      expect(source, loading).toContain('role="status"');
      expect(source, loading).toContain("sr-only");
      expect(source, loading).toContain("max-w-form");
    }
  });
});

describe("Phase 11F Step 2 — unchanged contracts", () => {
  it("submits through the existing schemas and server actions only", () => {
    const hospital = read(H_FORM);
    expect(hospital).toContain("hospitalProfileSchema.safeParse");
    expect(hospital).toContain("saveHospitalProfileAction(parsed.data)");
    expect(hospital).toContain("submitHospitalVerificationAction()");

    const bank = read(BB_FORM);
    expect(bank).toContain("bloodBankProfileSchema.safeParse");
    expect(bank).toContain("saveBloodBankProfileAction(parsed.data)");
    expect(bank).toContain("submitBloodBankVerificationAction()");
  });

  it("keeps the exact payload shape each schema already accepts", () => {
    expect(Object.keys(hospitalProfileSchema.shape).sort()).toEqual([
      "address",
      "contactPhone",
      "has24hEmergency",
      "location",
      "name",
    ]);
    expect(Object.keys(bloodBankProfileSchema.shape).sort()).toEqual([
      "address",
      "contactPhone",
      "emergencyHours",
      "location",
      "name",
    ]);

    const hospital = readCode(H_FORM);
    expect(hospital).toContain("has24hEmergency");
    expect(hospital).not.toContain("emergencyHours");

    const bank = readCode(BB_FORM);
    expect(bank).toContain("emergencyHours: emergencyHours || null");
    expect(bank).not.toContain("has24hEmergency");
  });

  it("adds no new queries, endpoints or actions from the profile UI", () => {
    for (const file of [...FORMS, ...PAGES, PANEL]) {
      const code = readCode(file);
      expect(code, file).not.toContain("createClient");
      expect(code, file).not.toContain("supabase");
      expect(code, file).not.toContain("fetch(");
      expect(code, file).not.toContain("from(");
      expect(code, file).not.toContain("rpc(");
    }
  });

  it("keeps the shared LocationPicker and adds no map or geocoding", () => {
    for (const file of FORMS) {
      const code = readCode(file);
      expect(code, file).toContain("LocationPicker");
      expect(code, file).not.toContain("google");
      expect(code, file).not.toContain("mapbox");
      expect(code, file).not.toContain("geocod");
    }
  });

  it("never renders raw latitude or longitude to the organization owner", () => {
    for (const file of [...FORMS, ...PAGES]) {
      const code = readCode(file);
      expect(code, file).not.toContain("toFixed");
      expect(code, file).not.toMatch(/\{\s*location\.latitude\s*\}/);
      expect(code, file).not.toMatch(/\{\s*location\.longitude\s*\}/);
    }
  });

  it("does not expose identifiers or admin metadata", () => {
    for (const file of [...FORMS, ...PAGES, PANEL]) {
      const code = readCode(file);
      expect(code, file).not.toContain("profile.id");
      expect(code, file).not.toContain("verifiedBy");
      expect(code, file).not.toContain("verified_by");
      expect(code, file).not.toContain("verificationNotes");
      expect(code, file).not.toContain("reviewer");
      expect(code, file).not.toContain("userId");
    }
  });
});

describe("Phase 11F Step 2 — verification presentation", () => {
  it("uses only the four existing verification states", () => {
    const panel = readCode(PANEL);
    for (const status of VERIFICATION_STATUSES) {
      expect(panel, status).toContain(`"${status}"`);
    }
    expect(panel).not.toContain("SUSPENDED");
    expect(panel).not.toContain("Approved");
    expect(panel).not.toContain("Suspended");
  });

  it("renders human labels via the shared verification chip", () => {
    expect(VERIFICATION_STATUS_LABELS.UNVERIFIED).toBe("Not submitted");
    expect(VERIFICATION_STATUS_LABELS.PENDING).toBe("Under review");
    expect(VERIFICATION_STATUS_LABELS.VERIFIED).toBe("Verified");
    expect(VERIFICATION_STATUS_LABELS.REJECTED).toBe("Needs changes");

    const panel = read(PANEL);
    expect(panel).toContain('StatusChip kind="verification"');
    expect(panel).toContain("No profile yet");
  });

  it("keeps the role-is-not-verification warning on both organizations", () => {
    const panel = read(PANEL);
    expect(panel).toContain("does not mean verified");
    expect(panel).toContain("receive escalations");
    expect(read(H_FORM)).toContain('roleLabel="HOSPITAL"');
    expect(read(BB_FORM)).toContain('roleLabel="BLOOD_BANK"');
  });

  it("shows the owner-visible rejection reason only when rejected", () => {
    const panel = read(PANEL);
    expect(panel).toContain('status === "REJECTED"');
    expect(panel).toContain("rejectionReason");
    expect(panel).toContain("Update your profile and resubmit");
  });

  it("offers submission only in the states the backend allows", () => {
    for (const file of FORMS) {
      const code = readCode(file);
      expect(code, file).toContain(
        'const canResubmit = status === "REJECTED" || status === "UNVERIFIED"'
      );
      expect(code, file).toContain("canSubmit={canResubmit}");
    }
    const panel = readCode(PANEL);
    expect(panel).toContain("canSubmit &&");
  });

  it("promises no review timeline and fakes no progress", () => {
    for (const file of [...FORMS, ...PAGES, PANEL]) {
      const code = readCode(file);
      expect(code, file).not.toMatch(/will be verified/i);
      expect(code, file).not.toMatch(/within \d+ (hour|business|day)/i);
      expect(code, file).not.toMatch(/\d+ business days/i);
      expect(code, file).not.toMatch(/estimated (review|approval)/i);
      expect(code, file).not.toContain("progress");
    }
  });

  it("keeps the re-verification warning for sensitive edits", () => {
    const panel = read(PANEL);
    expect(panel).toContain("requires re-verification");
    for (const file of FORMS) {
      expect(read(file), file).toContain(
        "Sensitive changes require re-verification"
      );
      expect(read(file), file).toContain("reVerificationRequired");
    }
  });
});

describe("Phase 11F Step 2 — form quality", () => {
  it("builds fields on the shared accessible primitives", () => {
    for (const file of FORMS) {
      const source = read(file);
      expect(source, file).toContain("FormField");
      expect(source, file).toContain("SectionHeader");
      expect(source, file).toContain("aria-describedby={describedBy}");
      expect(source, file).toContain("aria-invalid={invalid}");
      expect(source, file).toContain("noValidate");
      expect(source, file).not.toContain("inputClassName");
    }
    expect(read("src/components/ui/Button.tsx")).toContain("min-h-control");
  });

  it("marks required fields and keeps optional fields optional", () => {
    const hospital = read(H_FORM);
    expect(hospital).toContain('label="Hospital name" error={fieldErrors.name || null} required');
    expect(hospital).toContain('label="Address" error={fieldErrors.address || null} required');

    const bank = read(BB_FORM);
    expect(bank).toContain('label="Blood bank name" error={fieldErrors.name || null} required');
    // Emergency hours is nullable in the schema, so it must not be required.
    const emergencyStart = bank.indexOf('label="Emergency hours"');
    const emergencyField = bank.slice(
      emergencyStart,
      bank.indexOf("</FormField>", emergencyStart)
    );
    expect(emergencyField).toContain("Optional");
    expect(emergencyField).not.toContain("required");
  });

  it("guards against duplicate submits and surfaces save feedback", () => {
    for (const file of FORMS) {
      const code = readCode(file);
      expect(code, file).toContain("if (loading) return;");
      expect(code, file).toContain('loadingLabel="Saving…"');
      expect(code, file).toContain('<Alert variant="danger"');
      expect(code, file).toContain('<Alert variant="success"');
    }
  });

  it("warns about unsaved changes without blocking navigation", () => {
    for (const file of FORMS) {
      const code = readCode(file);
      expect(code, file).toContain("const dirty =");
      expect(code, file).toContain("UnsavedChangesNote");
      expect(code, file).not.toContain("beforeunload");
      expect(code, file).not.toContain("window.confirm");
    }
    expect(read(PANEL)).toContain("You have unsaved changes");
  });

  it("uses no gradients, glassmorphism or emergency red for ordinary saves", () => {
    for (const file of [...FORMS, ...PAGES, PANEL]) {
      const code = readCode(file);
      expect(code, file).not.toContain("gradient");
      expect(code, file).not.toContain("backdrop-blur");
      expect(code, file).not.toContain("bg-emergency");
      expect(code, file).not.toContain('variant="emergency"');
      expect(code, file).not.toContain("animate-pulse");
    }
  });
});
