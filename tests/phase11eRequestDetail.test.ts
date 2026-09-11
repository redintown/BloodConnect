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

const DETAIL = "src/app/(requester)/requests/[id]/page.tsx";
const LOADING = "src/app/(requester)/requests/[id]/loading.tsx";
const DONOR_CARD = "src/components/cards/DonorCard.tsx";
const CANCEL = "src/components/forms/CancelRequestButton.tsx";
const CONFIRM = "src/components/forms/ConfirmDonationButton.tsx";
const ESCALATE = "src/components/forms/EscalateNowButton.tsx";
const FIND = "src/components/forms/FindMatchingDonorsButton.tsx";

const DASHBOARD = "src/app/(requester)/requests/page.tsx";
const CREATE = "src/app/(requester)/request-blood/page.tsx";
const CREATE_FORM = "src/components/forms/BloodRequestForm.tsx";
const DONOR_DASHBOARD = "src/app/(donor)/donor/page.tsx";
const DONOR_POPUP = "src/components/forms/DonorMatchPopup.tsx";

describe("Phase 11E Step 3 — request detail page", () => {
  const page = read(DETAIL);
  const code = readCode(DETAIL);

  it("renders attention-first request detail with existing data fetches", () => {
    expect(page).toContain("<PageHeader");
    expect(page).toContain("Request");
    expect(page).toContain("bloodRequestService.getById");
    expect(page).toContain("matchingService.listMatchesForRequester");
    expect(page).toContain("getAcceptedMatchContact");
    expect(page).toContain("escalationService.getEscalationSummary");
    expect(page).toContain("notFound()");
  });

  it("uses human-readable status and blood-group labels", () => {
    expect(page).toContain("STATUS_LABELS");
    expect(page).toContain("BLOOD_GROUP_LABELS");
    expect(page).toContain("StatusChip");
    expect(page).toContain("URGENCY_LABELS");
    expect(code).not.toContain("EMERGENCY RESPONSE");
    expect(code).not.toContain("Match status: {");
  });

  it("presents emergency distinctly with text, not color alone", () => {
    expect(page).toContain("isEmergency");
    expect(page).toContain("Emergency request");
    expect(page).toContain("border-l-emergency");
    expect(code).not.toContain("animate-");
    expect(code).not.toContain("pulse");
  });

  it("does not expose UUIDs or exact coordinates", () => {
    expect(code).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(code).not.toContain("toFixed");
    expect(code).not.toContain(".latitude");
    expect(code).not.toContain(".longitude");
    expect(page).toContain("Set for matching");
  });

  it("reveals donor contact only from accepted contact payload", () => {
    expect(page).toContain("acceptedContact?.donor");
    expect(page).toContain("Accepted donor contact");
    expect(code).not.toContain("listMatchesForDonor");
    expect(page).toContain("Exact donor location is never shared");
  });

  it("gates actions with existing status rules", () => {
    expect(page).toContain("canRequesterEdit");
    expect(page).toContain("canRequesterCancel");
    expect(page).toContain("canRequesterConfirmDonation");
    expect(page).toContain("canRunMatching");
    expect(page).toContain("ConfirmDonationButton");
    expect(page).toContain("CancelRequestButton");
    expect(page).toContain("EscalateNowButton");
    expect(page).toContain("FindMatchingDonorsButton");
    expect(page).toContain("BloodRequestForm");
    expect(page).toContain('mode="edit"');
    expect(page).toContain("hasExistingMatches");
    expect(page).toContain("justMatchedCount");
    expect(page).toContain("No matching donors found nearby");
  });

  it("preserves escalation inventory hint contract", () => {
    expect(page).toContain("formatRequesterCanSupplyInventoryHint");
    expect(page).toContain("Response: Can Supply");
    expect(code).not.toContain("unitsAvailable");
    expect(code).not.toContain("inventoryService");
  });

  it("provides loading UI and avoids max-w-lg shell", () => {
    expect(read(LOADING)).toContain("Loading request details");
    expect(read(LOADING)).toContain('role="status"');
    expect(code).not.toContain("max-w-lg");
  });
});

describe("Phase 11E Step 3 — action presentation", () => {
  it("replaces window.confirm with ConfirmDialog for cancel and confirm", () => {
    expect(read(CANCEL)).toContain("ConfirmDialog");
    expect(read(CANCEL)).toContain("cancelBloodRequestAction");
    expect(readCode(CANCEL)).not.toContain("window.confirm");
    expect(read(CONFIRM)).toContain("ConfirmDialog");
    expect(read(CONFIRM)).toContain("confirmDonationReceivedAction");
    expect(readCode(CONFIRM)).not.toContain("window.confirm");
  });

  it("keeps escalate and find-donors on existing actions with loading guards", () => {
    expect(read(ESCALATE)).toContain("escalateBloodRequestAction");
    expect(read(ESCALATE)).toContain("Escalate Now");
    expect(read(ESCALATE)).toContain("ConfirmDialog");
    expect(read(FIND)).toContain("findMatchingDonorsAction");
    expect(read(FIND)).toContain("Find Again");
    expect(read(FIND)).toContain("if (loading) return");
  });

  it("presents donor cards with human match status and no private fields", () => {
    const card = read(DONOR_CARD);
    expect(card).toContain("DonorPublicSummary");
    expect(card).toContain("StatusChip");
    expect(card).toContain("kind=\"match\"");
    expect(card).toContain("distanceKm");
    expect(readCode(DONOR_CARD)).not.toContain("phone");
    expect(readCode(DONOR_CARD)).not.toContain("latitude");
  });
});

describe("Phase 11E Step 3 — regression boundaries", () => {
  it("leaves dashboard and create-request routes intact", () => {
    expect(read(DASHBOARD)).toContain("Your requests");
    expect(read(DASHBOARD)).toContain("Needs attention");
    expect(read(CREATE)).toContain("Request blood");
    expect(read(CREATE_FORM)).toContain("Find Donors Now");
    expect(read(CREATE_FORM)).toContain("createBloodRequestAndFindDonorsAction");
  });

  it("leaves donor portal and requester actions contracts intact", () => {
    expect(read(DONOR_DASHBOARD)).toContain("Your donor dashboard");
    expect(read(DONOR_POPUP)).toContain("DonorMatchPopup");
    const actions = read("src/app/(requester)/actions.ts");
    expect(actions).toContain("confirmDonationReceivedAction");
    expect(actions).toContain("escalateBloodRequestAction");
    expect(actions).toContain("cancelBloodRequestAction");
    expect(actions).toContain("findMatchingDonorsAction");
  });
});
