import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { ESCALATION_STATUS_LABELS, ESCALATION_LEVEL_LABELS } from "@/components/ui/StatusChip";
import { ORG_ESCALATION_RESPONSES } from "@/lib/escalation/constants";

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

const H_PAGE = "src/app/(hospital)/hospital/requests/page.tsx";
const BB_PAGE = "src/app/(blood-bank)/blood-bank/requests/page.tsx";
const INBOX = "src/components/forms/OrganizationEscalationInbox.tsx";
const BUTTONS = "src/components/forms/OrgEscalationResponseButtons.tsx";
const H_LOADING = "src/app/(hospital)/hospital/requests/loading.tsx";
const BB_LOADING = "src/app/(blood-bank)/blood-bank/requests/loading.tsx";

const PAGES = [H_PAGE, BB_PAGE];

describe("Phase 11F Step 4 — escalation routes", () => {
  it("keeps the existing escalation routes wired to the same shared inbox", () => {
    const hospital = read(H_PAGE);
    const bank = read(BB_PAGE);
    expect(hospital).toContain("OrganizationEscalationInbox");
    expect(hospital).toContain('organizationType="HOSPITAL"');
    expect(bank).toContain("OrganizationEscalationInbox");
    expect(bank).toContain('organizationType="BLOOD_BANK"');
  });

  it("adds a card-shaped loading state for each escalation route", () => {
    for (const loading of [H_LOADING, BB_LOADING]) {
      const source = read(loading);
      expect(source, loading).toContain('role="status"');
      expect(source, loading).toContain("sr-only");
    }
  });

  it("moves the inbox onto PageHeader without a second main landmark or max-w-lg", () => {
    const inbox = read(INBOX);
    expect(inbox).toContain("PageHeader");
    expect(inbox).not.toContain("PageShell");
    expect(inbox).not.toContain("<main");
    expect(inbox).not.toContain("max-w-lg");
  });
});

describe("Phase 11F Step 4 — unchanged data contract", () => {
  it("still reads through the exact existing services (no new queries)", () => {
    const inbox = readCode(INBOX);
    expect(inbox).toContain("escalationService.listInboxForOrganization");
    expect(inbox).toContain("inventoryService.getOwnUnitsByBloodGroupMap");
    expect(inbox).not.toContain("createClient");
    expect(inbox).not.toContain("supabase");
    expect(inbox).not.toContain(".from(");
    expect(inbox).not.toContain(".rpc(");
  });

  it("keeps the escalation read-only inventory hint untouched", () => {
    const inbox = read(INBOX);
    expect(inbox).toContain("formatOwnInventoryHint");
    expect(inbox).toContain("Your inventory");
    expect(inbox).toContain("Can Supply does not change stock");
    expect(inbox).not.toContain("adjustInventory");
    expect(inbox).not.toContain("adjust_own_inventory");
    expect(inbox).not.toContain('.from("blood_inventory")');
  });

  it("responds through the exact existing action, payload and allowed values", () => {
    const buttons = readCode(BUTTONS);
    expect(buttons).toContain("respondToEscalationAction(targetId, response)");
    expect(buttons).toContain('"ACKNOWLEDGED"');
    expect(buttons).toContain('"CAN_SUPPLY"');
    expect(buttons).toContain('"CANNOT_HELP"');
    expect(ORG_ESCALATION_RESPONSES).toEqual([
      "PENDING",
      "ACKNOWLEDGED",
      "CAN_SUPPLY",
      "CANNOT_HELP",
    ]);
  });

  it("gates response buttons on the exact existing OPEN condition", () => {
    const inbox = readCode(INBOX);
    expect(inbox).toContain('event.status === "OPEN"');
    expect(inbox).toContain("eventOpen ?");
    expect(inbox).toContain("<OrgEscalationResponseButtons");
  });

  it("adds no new escalation actions, statuses, or workflow", () => {
    for (const file of [...PAGES, INBOX, BUTTONS]) {
      const code = readCode(file);
      expect(code, file).not.toContain('"EXPIRED"');
      expect(code, file).not.toContain("SLA");
      expect(code, file).not.toContain("priority");
      expect(code, file).not.toContain("criticality");
      expect(code, file).not.toContain("commitment");
      // "not a reservation" is pre-existing copy (preserved), not a new
      // reservation feature — assert the feature is absent, not the word.
      expect(code, file).not.toContain("reserveUnits");
      expect(code, file).not.toContain("reservedUnits");
    }
  });
});

describe("Phase 11F Step 4 — status presentation", () => {
  it("uses the shared StatusChip escalation kind for both target and event status", () => {
    const inbox = read(INBOX);
    expect(inbox).toContain('StatusChip kind="escalation" value={target.status}');
    expect(inbox).toContain('StatusChip kind="escalation" value={event.status}');
  });

  it("never renders a raw status enum to the user", () => {
    const inbox = readCode(INBOX);
    // The previous UI rendered `Event {event.status}` and `Response on file:
    // {target.status}` directly — both must now go through human labels.
    expect(inbox).not.toMatch(/Event \{event\.status\}/);
    expect(inbox).not.toMatch(/Response on file: \{target\.status\}\}/);
    expect(inbox).toContain("ESCALATION_STATUS_LABELS[target.status]");
    expect(inbox).toContain("ESCALATION_LEVEL_LABELS[event.level]");
  });

  it("keeps the exact existing status vocabulary and labels", () => {
    expect(ESCALATION_STATUS_LABELS.OPEN).toBe("Awaiting response");
    expect(ESCALATION_STATUS_LABELS.PENDING).toBe("Awaiting response");
    expect(ESCALATION_STATUS_LABELS.ACKNOWLEDGED).toBe("Acknowledged");
    expect(ESCALATION_STATUS_LABELS.CAN_SUPPLY).toBe("Can supply");
    expect(ESCALATION_STATUS_LABELS.CANNOT_HELP).toBe("Cannot help");
    expect(ESCALATION_STATUS_LABELS.RESOLVED).toBe("Resolved");
    expect(ESCALATION_STATUS_LABELS.CANCELLED).toBe("Cancelled");
    expect(ESCALATION_LEVEL_LABELS.BLOOD_BANKS_HOSPITALS).toBe("Blood banks and hospitals");
  });

  it("does not use emergency red as the default escalation tone", () => {
    const inbox = readCode(INBOX);
    const buttons = readCode(BUTTONS);
    // Emergency tone is reserved for the isEmergency badge only, not for
    // ordinary status chips or action buttons.
    expect(buttons).not.toContain('variant="emergency"');
    expect(inbox).not.toContain("bg-emergency ");
    expect(inbox).not.toContain("animate-pulse");
  });

  it("keeps the isEmergency badge restrained (no animation)", () => {
    const inbox = readCode(INBOX);
    expect(inbox).toContain("request.isEmergency &&");
    expect(inbox).not.toContain("animate-pulse");
    expect(inbox).not.toContain("animate-bounce");
  });
});

describe("Phase 11F Step 4 — blood group presentation", () => {
  it("shows human blood-group labels without the emergency-red badge", () => {
    const inbox = readCode(INBOX);
    expect(inbox).toContain("BLOOD_GROUP_LABELS");
    expect(inbox).not.toContain("BloodGroupBadge");
  });
});

describe("Phase 11F Step 4 — attention-first grouping", () => {
  it("groups by the existing OPEN/PENDING fields only, not a new calculation", () => {
    const inbox = readCode(INBOX);
    expect(inbox).toContain(
      'event.status === "OPEN" && target.status === "PENDING"'
    );
    expect(inbox).toContain(
      'event.status === "OPEN" && target.status !== "PENDING"'
    );
    expect(inbox).toContain('event.status !== "OPEN"');
    expect(inbox).not.toContain("sort(");
    expect(inbox).not.toContain(".score");
  });

  it("renders each group only when it has items", () => {
    const inbox = read(INBOX);
    expect(inbox).toContain("needsAttention.length > 0 &&");
    expect(inbox).toContain("inProgress.length > 0 &&");
    expect(inbox).toContain("resolved.length > 0 &&");
    expect(inbox).toContain("Needs attention");
    expect(inbox).toContain("Active / in progress");
    expect(inbox).toContain("Resolved / past");
  });

  it("does not add filtering, search, or pagination", () => {
    const inbox = readCode(INBOX);
    expect(inbox).not.toContain("useSearchParams");
    expect(inbox).not.toContain("searchParams");
    expect(inbox).not.toContain("page=");
    expect(inbox).not.toContain("pageSize");
    expect(inbox).not.toContain('type="search"');
  });
});

describe("Phase 11F Step 4 — editing UX", () => {
  it("guards against duplicate submits while a response is in flight", () => {
    const buttons = readCode(BUTTONS);
    expect(buttons).toContain("if (loading) return;");
    expect(buttons).toContain("disabled={disabled}");
    expect(buttons).toContain('loadingLabel="Saving…"');
  });

  it("maps server errors to human-readable inline feedback", () => {
    const buttons = read(BUTTONS);
    expect(buttons).toContain('if ("error" in result)');
    expect(buttons).toContain('<Alert variant="danger"');
  });

  it("does not add a confirmation dialog the existing flow never had", () => {
    const buttons = readCode(BUTTONS);
    expect(buttons).not.toContain("ConfirmDialog");
    expect(buttons).not.toContain("window.confirm");
  });
});

describe("Phase 11F Step 4 — empty state", () => {
  it("uses a calm empty state that does not claim global emergency coverage", () => {
    const inbox = read(INBOX);
    expect(inbox).toContain('title="No escalated requests"');
    expect(inbox).toContain("does not mean no emergencies exist elsewhere");
  });
});

describe("Phase 11F Step 4 — privacy", () => {
  it("never renders internal ids or donor/requester private data", () => {
    for (const file of [...PAGES, INBOX, BUTTONS]) {
      const code = readCode(file);
      expect(code, file).not.toContain("target.organizationId");
      expect(code, file).not.toContain("target.emergencyEventId");
      expect(code, file).not.toContain("donorPhone");
      expect(code, file).not.toContain("contactPhone");
      expect(code, file).not.toContain("requesterId");
      expect(code, file).not.toContain("request.requesterId");
    }
  });

  it("never renders raw coordinates — distance stays a coarse band", () => {
    const inbox = readCode(INBOX);
    expect(inbox).toContain("DistanceBadge");
    expect(inbox).not.toContain("latitude");
    expect(inbox).not.toContain("longitude");
    expect(inbox).not.toMatch(/distanceMeters\s*\}/);
  });

  it("does not expose admin identity or reviewer metadata", () => {
    for (const file of [INBOX, BUTTONS]) {
      const code = readCode(file);
      expect(code, file).not.toContain("verifiedBy");
      expect(code, file).not.toContain("reviewer");
      expect(code, file).not.toContain("adminUser");
    }
  });
});

describe("Phase 11F Step 4 — accessibility and visual system", () => {
  it("uses one visible page title and semantic section headings", () => {
    const inbox = read(INBOX);
    expect(inbox).toContain('title="Escalated requests"');
    expect(inbox).toContain("SectionHeader");
    expect(inbox).toContain("aria-labelledby=");
  });

  it("uses the shared Button primitive with 44px control sizing", () => {
    const buttons = read(BUTTONS);
    expect(buttons).toContain('import { Button } from "@/components/ui/Button"');
    expect(read("src/components/ui/Button.tsx")).toContain("min-h-control");
  });

  it("uses no gradients, glassmorphism, or fixed-width overflowing tables", () => {
    for (const file of [INBOX, BUTTONS]) {
      const code = readCode(file);
      expect(code, file).not.toContain("gradient");
      expect(code, file).not.toContain("backdrop-blur");
      expect(code, file).not.toContain("<table");
      expect(code, file).not.toContain("overflow-x-auto");
    }
  });
});

describe("Phase 11F Step 4 — regression guards", () => {
  it("leaves the organization dashboards untouched", () => {
    const hospitalDash = read("src/app/(hospital)/hospital/page.tsx");
    const bankDash = read("src/app/(blood-bank)/blood-bank/page.tsx");
    expect(hospitalDash).toContain('title="Hospital dashboard"');
    expect(bankDash).toContain('title="Blood bank dashboard"');
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

  it("leaves organization inventory untouched", () => {
    expect(read("src/components/forms/OrganizationInventoryPanel.tsx")).toContain(
      "adjustOwnInventoryAction"
    );
    expect(read("src/app/(hospital)/hospital/inventory/page.tsx")).toContain(
      "OrganizationInventoryPanel"
    );
  });

  it("leaves donor and requester UI untouched", () => {
    expect(read("src/components/forms/DonorMatchActions.tsx")).toContain("acceptMatchAction");
    expect(read("src/app/(requester)/requests/[id]/page.tsx")).toContain("EscalateNowButton");
  });

  it("does not touch backend files", () => {
    const service = readCode("src/services/escalationService.ts");
    expect(service).toContain("respond_to_escalation_target");
    expect(service).toContain("listInboxForOrganization");
    const actions = readCode("src/app/(org)/actions.ts");
    expect(actions).toContain("respondToEscalationAction");
    expect(actions).not.toContain("adjustOwnInventoryAction");
  });
});
