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

const PAGE = "src/app/(admin)/admin/organizations/page.tsx";
const CARD = "src/components/forms/AdminOrganizationReviewCard.tsx";
const LOADING = "src/app/(admin)/admin/organizations/loading.tsx";
const SERVICE = "src/services/verificationService.ts";
const ACTIONS = "src/app/(admin)/actions.ts";
const SCHEMA = "src/schemas/hospital.schema.ts";

describe("Phase 11G Step 2 — existing organization verification contract", () => {
  it("keeps the exact existing query, ordered oldest-first, with no new backend logic", () => {
    const service = readCode(SERVICE);
    expect(service).toContain("listPendingOrganizations");
    expect(service).toContain(".order(\"updated_at\", { ascending: true })");
    expect(service).toContain("pending.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))");
  });

  it("preserves the exact DTO fields — no new fields added to PendingOrganization", () => {
    const service = read(SERVICE);
    const dto = service.slice(
      service.indexOf("export interface PendingOrganization"),
      service.indexOf("export interface PendingDonor")
    );
    for (const field of [
      "id:",
      "organizationType:",
      "name:",
      "phone:",
      "address:",
      "has24hEmergency?:",
      "emergencyHours?:",
      "locationSummary:",
      "verificationStatus:",
      "createdAt:",
      "updatedAt:",
    ]) {
      expect(dto).toContain(field);
    }
    // No admin-metadata / reviewer / raw-DB fields were added to the DTO.
    expect(dto).not.toContain("userId");
    expect(dto).not.toContain("reviewedBy");
    expect(dto).not.toContain("verifiedBy");
  });

  it("keeps the exact existing rejection-reason validation (5–500 chars)", () => {
    const schema = read(SCHEMA);
    expect(schema).toContain("reason: z.string().trim().min(5).max(500)");
  });

  it("keeps the exact existing server actions untouched", () => {
    const actions = readCode(ACTIONS);
    expect(actions).toContain("export async function verifyOrganizationAction");
    expect(actions).toContain("export async function rejectOrganizationAction");
    expect(actions).toContain("verificationService.verifyHospital");
    expect(actions).toContain("verificationService.verifyBloodBank");
    expect(actions).toContain("verificationService.rejectHospital");
    expect(actions).toContain("verificationService.rejectBloodBank");
  });
});

describe("Phase 11G Step 2 — page structure", () => {
  it("fetches only the existing query, no new data loading", () => {
    const code = readCode(PAGE);
    expect(code).toContain("verificationService.listPendingOrganizations()");
    expect(code).not.toContain("listPendingDonors");
    expect(code).not.toContain("listAdminOpenEscalations");
    expect(code).not.toContain("createClient");
    expect(code).not.toContain(".rpc(");
  });

  it("uses PageHeader and SectionHeader, no max-w-lg, no invented metrics", () => {
    const page = read(PAGE);
    expect(page).toContain("PageHeader");
    expect(page).toContain("SectionHeader");
    expect(page).not.toContain("PageShell");
    expect(page).not.toContain("max-w-lg");
    const code = readCode(PAGE);
    for (const forbidden of ["%", "responseRate", "averageResponseTime", "score", "predict"]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });

  it("does not invent a queue-size metric — original UI had no count", () => {
    const code = readCode(PAGE);
    expect(code).not.toContain("count=");
    expect(code).not.toContain("listPendingDonors");
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
    expect(page).toContain("No pending organizations");
    expect(page).not.toMatch(/fully verified/i);
    expect(page).not.toMatch(/all organizations are verified/i);
    expect(page).not.toMatch(/no organizations need verification/i);
  });

  it("has a card-shaped loading state", () => {
    const loading = read(LOADING);
    expect(loading).toContain('role="status"');
    expect(loading).toContain("sr-only");
  });
});

describe("Phase 11G Step 2 — verification card presentation", () => {
  it("uses only existing DTO fields, human-readable organization type, and StatusChip", () => {
    const card = read(CARD);
    expect(card).toContain("org.name");
    expect(card).toContain("org.phone");
    expect(card).toContain("org.address");
    expect(card).toContain("org.locationSummary");
    expect(card).toContain("org.has24hEmergency");
    expect(card).toContain("org.emergencyHours");
    expect(card).toContain("org.updatedAt");
    expect(card).toContain("ROLE_LABELS[org.organizationType]");
    expect(card).toContain('StatusChip kind="verification"');
    expect(card).not.toContain("org.verificationStatus}</span"); // no raw enum rendered as text
  });

  it("does not expose ids, user ids, or internal metadata as visible text", () => {
    const card = readCode(CARD);
    expect(card).not.toMatch(/>{?\s*org\.id\s*}?</);
    expect(card).not.toContain("`org-${org.id}");
    expect(card).not.toContain("org.userId");
    expect(card).not.toContain("user_id");
    expect(card).not.toContain("reviewedBy");
    expect(card).toContain("useId()");
  });

  it("preserves the exact existing verify/reject action calls and payloads", () => {
    const card = readCode(CARD);
    expect(card).toContain("verifyOrganizationAction(org.organizationType, org.id)");
    expect(card).toContain("rejectOrganizationAction(org.organizationType, org.id, reason)");
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
    expect(card).toMatch(/aria-label=\{`Verify \$\{org\.name\}`\}/);
    expect(card).toMatch(/aria-label=\{`Reject \$\{org\.name\}`\}/);
  });

  it("wires the rejection textarea through FormField accessibility plumbing", () => {
    const card = read(CARD);
    expect(card).toContain("aria-describedby={describedBy}");
    expect(card).toContain("aria-invalid={invalid}");
    expect(card).toContain('maxLength={500}');
  });

  it("does not use emergency red for ordinary verify/reject actions", () => {
    const card = readCode(CARD);
    expect(card).not.toContain('variant="emergency"');
    expect(card).not.toContain("bg-emergency");
  });
});

describe("Phase 11G Step 2 — responsive and layout rules", () => {
  it("uses a responsive grid, not a fixed-width table", () => {
    const page = read(PAGE);
    expect(page).toContain("grid gap-3 lg:grid-cols-2");
    expect(page).not.toContain("<table");
    expect(page).not.toContain("overflow-x-auto");
  });
});

describe("Phase 11G Step 2 — regression guards", () => {
  it("leaves the donor verification queue untouched", () => {
    const donors = read("src/app/(admin)/admin/donors/page.tsx");
    expect(donors).toContain("verificationService.listPendingDonors()");
    expect(donors).toContain("AdminDonorReviewCard");
  });

  it("leaves the admin escalation queue untouched", () => {
    const escalations = read("src/app/(admin)/admin/escalations/page.tsx");
    expect(escalations).toContain("escalationService.listAdminOpenEscalations()");
  });

  it("leaves the admin users/requests stubs untouched", () => {
    expect(read("src/app/(admin)/admin/users/page.tsx")).toContain("No users loaded");
    expect(read("src/app/(admin)/admin/requests/page.tsx")).toContain("No requests to moderate");
  });

  it("leaves the admin dashboard and nav untouched", () => {
    const dash = read("src/app/(admin)/admin/page.tsx");
    expect(dash).toContain('title="Admin dashboard"');
    expect(dash).toContain("Administrative queues");
  });

  it("leaves donor, requester, organization, and public UI untouched", () => {
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

  it("does not touch backend/service/schema/action files beyond presentation-safe reads", () => {
    const service = readCode(SERVICE);
    expect(service).toContain("verifyHospital");
    expect(service).toContain("rejectHospital");
    expect(service).toContain("verifyBloodBank");
    expect(service).toContain("rejectBloodBank");
    const schema = read(SCHEMA);
    expect(schema).toContain("organizationId: z.string().uuid()");
  });
});
