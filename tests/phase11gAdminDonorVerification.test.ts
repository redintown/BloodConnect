import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

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

const PAGE = "src/app/(admin)/admin/donors/page.tsx";
const CARD = "src/components/forms/AdminDonorReviewCard.tsx";
const LOADING = "src/app/(admin)/admin/donors/loading.tsx";
const SERVICE = "src/services/verificationService.ts";
const ACTIONS = "src/app/(admin)/actions.ts";
const SCHEMA = "src/schemas/donorVerification.schema.ts";

describe("Phase 11G Step 3 — existing donor verification contract", () => {
  it("keeps the exact existing query, ordered oldest-first, with no new backend logic", () => {
    const service = readCode(SERVICE);
    expect(service).toContain("listPendingDonors");
    expect(service).toContain(".eq(\"verification_status\", \"PENDING\")");
    expect(service).toContain(".order(\"updated_at\", { ascending: true })");
  });

  it("preserves the exact DTO fields — no new fields added to PendingDonor", () => {
    const service = read(SERVICE);
    const dto = service.slice(
      service.indexOf("export interface PendingDonor"),
      service.indexOf("export interface VerificationService")
    );
    for (const field of [
      "donorId:",
      "donorName:",
      "bloodGroup:",
      "lastDonationDate:",
      "isAvailable:",
      "isAvailableAtNight:",
      "locationSummary:",
      "verificationStatus:",
      "updatedAt:",
    ]) {
      expect(dto).toContain(field);
    }
    expect(dto).not.toContain("phone");
    expect(dto).not.toContain("emergencyRadius");
    expect(dto).not.toContain("userId");
    expect(dto).not.toContain("nextEligible");
    expect(dto).not.toContain("eligibility");
  });

  it("keeps donor location summaries privacy-safe (no coordinate formatting)", () => {
    const service = readCode(SERVICE);
    expect(service).toContain('return location ? "Location on file" : "Location missing"');
  });

  it("keeps the exact existing rejection-reason validation (5–500 chars)", () => {
    const schema = read(SCHEMA);
    expect(schema).toContain("reason: z.string().trim().min(5).max(500)");
  });

  it("keeps the exact existing server actions untouched", () => {
    const actions = readCode(ACTIONS);
    expect(actions).toContain("export async function verifyDonorAction");
    expect(actions).toContain("export async function rejectDonorAction");
    expect(actions).toContain("verificationService.verifyDonor");
    expect(actions).toContain("verificationService.rejectDonor");
  });
});

describe("Phase 11G Step 3 — page structure", () => {
  it("fetches only the existing query, no new data loading", () => {
    const code = readCode(PAGE);
    expect(code).toContain("verificationService.listPendingDonors()");
    expect(code).not.toContain("listPendingOrganizations");
    expect(code).not.toContain("listAdminOpenEscalations");
    expect(code).not.toContain("createClient");
    expect(code).not.toContain(".rpc(");
  });

  it("uses PageHeader and SectionHeader, no max-w-lg, no invented metrics", () => {
    const page = read(PAGE);
    expect(page).toContain("PageHeader");
    expect(page).toContain('title="Donor verification"');
    expect(page).toContain("SectionHeader");
    expect(page).not.toContain("PageShell");
    expect(page).not.toContain("max-w-lg");
    const code = readCode(PAGE);
    expect(code).not.toContain("count=");
    for (const forbidden of ["%", "responseRate", "score", "predict"]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  it("does not add client-side sorting, filtering, search, or pagination", () => {
    const code = readCode(PAGE);
    expect(code).not.toContain(".sort(");
    expect(code).not.toContain("useSearchParams");
    expect(code).not.toContain("searchParams");
    expect(code).not.toContain('type="search"');
    expect(code).not.toContain("pageSize");
    expect(code).not.toContain(".filter(");
  });

  it("states that the existing oldest-first service order is preserved", () => {
    expect(read(PAGE)).toContain("Oldest submissions first.");
  });

  it("renders an EmptyState that does not overclaim platform-wide verification", () => {
    const page = read(PAGE);
    expect(page).toContain("EmptyState");
    expect(page).toContain("No pending donors");
    expect(page).not.toMatch(/all donors are verified/i);
    expect(page).not.toMatch(/donor network is complete/i);
    expect(page).not.toMatch(/no unverified donors/i);
  });

  it("has a card-shaped loading state", () => {
    const loading = read(LOADING);
    expect(loading).toContain('role="status"');
    expect(loading).toContain("sr-only");
  });
});

describe("Phase 11G Step 3 — donor review card presentation", () => {
  it("uses only existing DTO fields, human blood-group labels, and StatusChip", () => {
    const card = read(CARD);
    expect(card).toContain("donor.donorName");
    expect(card).toContain("BLOOD_GROUP_LABELS");
    expect(card).toContain("donor.isAvailable");
    expect(card).toContain("donor.isAvailableAtNight");
    expect(card).toContain("donor.lastDonationDate");
    expect(card).toContain("donor.locationSummary");
    expect(card).toContain("donor.updatedAt");
    expect(card).toContain('StatusChip kind="verification"');
    expect(card).not.toContain("BloodGroupBadge");
    expect(card).not.toContain("donor.verificationStatus}</span");
  });

  it("displays availability from the DTO and does not calculate eligibility", () => {
    const card = readCode(CARD);
    expect(card).toContain("Availability:");
    expect(card).not.toContain("Eligibility");
    expect(card).not.toContain("56");
    expect(card).not.toContain("nextEligible");
    expect(card).not.toContain("Date.now()");
    expect(card).not.toContain("daysSince");
  });

  it("does not expose ids, phone, coordinates, or internal metadata", () => {
    const card = readCode(CARD);
    expect(card).not.toMatch(/>{?\s*donor\.donorId\s*}?</);
    expect(card).not.toContain("`donor-${donor.donorId}");
    expect(card).toContain("useId()");
    expect(card).not.toContain("phone");
    expect(card).not.toContain("toFixed");
    expect(card).not.toContain("latitude");
    expect(card).not.toContain("longitude");
    expect(card).not.toContain("emergencyRadius");
    expect(card).not.toContain("user_id");
    expect(card).not.toContain("reviewedBy");
  });

  it("preserves the exact existing verify/reject action calls and payloads", () => {
    const card = readCode(CARD);
    expect(card).toContain("verifyDonorAction(donor.donorId)");
    expect(card).toContain("rejectDonorAction(donor.donorId, reason)");
    expect(card).toContain("Verify");
    expect(card).toContain("Reject");
    expect(card).not.toContain("Approve");
  });

  it("preserves the exact existing rejection-reason requirement (>= 5 chars)", () => {
    const card = read(CARD);
    expect(card).toContain("reason.trim().length < 5");
  });

  it("does not add a ConfirmDialog step that the existing reject flow never had", () => {
    const card = readCode(CARD);
    expect(card).not.toContain("ConfirmDialog");
  });

  it("provides duplicate-submit protection independently for verify and reject", () => {
    const card = read(CARD);
    expect(card).toContain("if (busy) return;");
    expect(card).toContain("disabled={busy}");
    expect(card).toContain("loading={verifying}");
    expect(card).toContain("loading={rejecting}");
  });

  it("uses Alert for error/success feedback instead of raw text", () => {
    const card = read(CARD);
    expect(card).toContain('<Alert variant="danger"');
    expect(card).toContain('<Alert variant="success"');
  });

  it("has explicit accessible labels for verify/reject actions", () => {
    const card = read(CARD);
    expect(card).toMatch(/aria-label=\{`Verify \$\{donor\.donorName\}`\}/);
    expect(card).toMatch(/aria-label=\{`Reject \$\{donor\.donorName\}`\}/);
  });

  it("wires the rejection textarea through FormField accessibility plumbing", () => {
    const card = read(CARD);
    expect(card).toContain("aria-describedby={describedBy}");
    expect(card).toContain("aria-invalid={invalid}");
    expect(card).toContain("maxLength={500}");
  });

  it("does not use emergency red for ordinary verify/reject or blood group", () => {
    const card = readCode(CARD);
    expect(card).not.toContain('variant="emergency"');
    expect(card).not.toContain("bg-emergency");
  });
});

describe("Phase 11G Step 3 — responsive and layout rules", () => {
  it("uses a responsive grid, not a fixed-width table", () => {
    const page = read(PAGE);
    expect(page).toContain("grid gap-3 lg:grid-cols-2");
    expect(page).not.toContain("<table");
    expect(page).not.toContain("overflow-x-auto");
  });
});

describe("Phase 11G Step 3 — regression guards", () => {
  it("leaves the admin dashboard unchanged", () => {
    const dash = read("src/app/(admin)/admin/page.tsx");
    expect(dash).toContain('title="Admin dashboard"');
    expect(dash).toContain("Administrative queues");
  });

  it("leaves the organization verification queue unchanged", () => {
    const orgs = read("src/app/(admin)/admin/organizations/page.tsx");
    expect(orgs).toContain("verificationService.listPendingOrganizations()");
    expect(orgs).toContain("AdminOrganizationReviewCard");
  });

  it("leaves the admin escalation queue unchanged", () => {
    expect(read("src/app/(admin)/admin/escalations/page.tsx")).toContain(
      "escalationService.listAdminOpenEscalations()"
    );
  });

  it("leaves the admin users/requests stubs unchanged", () => {
    expect(read("src/app/(admin)/admin/users/page.tsx")).toContain("No users loaded");
    expect(read("src/app/(admin)/admin/requests/page.tsx")).toContain("No requests to moderate");
  });

  it("leaves donor, requester, organization, and public UI unchanged", () => {
    expect(read("src/components/forms/DonorMatchActions.tsx")).toContain("acceptMatchAction");
    expect(read("src/app/(requester)/requests/[id]/page.tsx")).toContain("EscalateNowButton");
    expect(read("src/components/forms/OrganizationInventoryPanel.tsx")).toContain(
      "adjustOwnInventoryAction"
    );
    expect(read("src/components/forms/OrganizationEscalationInbox.tsx")).toContain(
      "escalationService.listInboxForOrganization"
    );
    expect(read("src/app/(public)/find-blood/page.tsx")).toContain("FindBloodSearchForm");
  });

  it("does not touch backend/service/schema/action files", () => {
    const service = readCode(SERVICE);
    expect(service).toContain("verifyDonor");
    expect(service).toContain("rejectDonor");
    expect(service).toContain("listPendingDonors");
    const schema = read(SCHEMA);
    expect(schema).toContain("donorId: z.string().uuid()");
  });
});
