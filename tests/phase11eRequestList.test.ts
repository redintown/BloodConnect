import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { REQUESTER_NAV_SECTIONS } from "@/components/nav/requesterNav";
import { flattenNavSections } from "@/components/nav/navConfig";

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

const DASHBOARD = "src/app/(requester)/requests/page.tsx";
const LIST_CARD = "src/components/cards/RequesterRequestListCard.tsx";
const CREATE = "src/app/(requester)/request-blood/page.tsx";
const DETAIL = "src/app/(requester)/requests/[id]/page.tsx";
const NAV = "src/components/nav/requesterNav.ts";
const DONOR_DASHBOARD = "src/app/(donor)/donor/page.tsx";
const DONOR_POPUP = "src/components/forms/DonorMatchPopup.tsx";

describe("Phase 11E Step 4 — request list lives on /requests", () => {
  const page = read(DASHBOARD);
  const code = readCode(DASHBOARD);
  const card = read(LIST_CARD);
  const cardCode = readCode(LIST_CARD);

  it("does not invent a separate history route", () => {
    expect(existsSync(path.join(root, "src/app/(requester)/history"))).toBe(false);
    expect(existsSync(path.join(root, "src/app/(requester)/requests/history"))).toBe(false);
    expect(read(NAV)).not.toContain("/history");
    expect(flattenNavSections(REQUESTER_NAV_SECTIONS).map((i) => i.href)).toEqual([
      "/requests",
      "/request-blood",
    ]);
  });

  it("preserves attention-first hierarchy before the complete list", () => {
    expect(page).toContain("Needs attention");
    expect(page).toContain("My requests");
    expect(page).toContain("listForRequester");
    const attentionIdx = page.indexOf("Needs attention");
    const listIdx = page.indexOf('title="My requests"');
    expect(attentionIdx).toBeGreaterThan(-1);
    expect(listIdx).toBeGreaterThan(attentionIdx);
  });

  it("shows the complete list from existing data without a second query", () => {
    expect(page).toContain("RequesterRequestListCard");
    expect(page).toContain("groupRequests");
    expect(code).not.toContain(".slice(0");
    expect(code).not.toContain("listMatchesForRequester");
    expect(code).not.toContain("getEscalationSummary");
    expect(code).not.toContain("useState");
    expect(code).not.toContain("filter=");
  });

  it("groups by existing statuses only: Active, Completed, Past", () => {
    expect(page).toContain("Active");
    expect(page).toContain("Completed");
    expect(page).toContain("Past");
    expect(page).toContain('status === "COMPLETED"');
    expect(page).toContain('status === "CANCELLED"');
    expect(page).toContain('status === "EXPIRED"');
    expect(page).toContain("OPEN_STATUSES");
  });

  it("list cards use human labels and link to detail", () => {
    expect(card).toContain("BLOOD_GROUP_LABELS");
    expect(card).toContain("StatusChip");
    expect(card).toContain("Emergency request");
    expect(card).toContain("`/requests/${request.id}`");
    expect(card).toContain("View request");
    expect(cardCode).not.toContain("toFixed");
    expect(cardCode).not.toContain("latitude");
    expect(cardCode).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(cardCode).not.toContain("window.confirm");
    expect(cardCode).not.toContain("cancelBloodRequestAction");
  });

  it("does not invent pagination, search, or backend filters", () => {
    expect(code).not.toContain("pageSize");
    expect(code).not.toContain("pagination");
    expect(code).not.toContain("searchQuery");
    expect(code).not.toContain("useSearchParams");
    expect(cardCode).not.toContain("max-w-lg");
    expect(code).not.toContain("max-w-lg");
  });

  it("keeps empty attention CTA to create request", () => {
    expect(page).toContain("No active blood request");
    expect(page).toContain('href="/request-blood"');
  });
});

describe("Phase 11E Step 4 — regression", () => {
  it("leaves create and detail routes intact", () => {
    expect(read(CREATE)).toContain("BloodRequestForm");
    expect(read(CREATE)).toContain("Request blood");
    expect(read("src/components/forms/BloodRequestForm.tsx")).toContain("Find Donors Now");
    expect(read(DETAIL)).toContain("ConfirmDonationButton");
    expect(read(DETAIL)).toContain("EscalateNowButton");
    expect(read(DETAIL)).toContain("getAcceptedMatchContact");
  });

  it("leaves donor UI and requester actions untouched", () => {
    expect(read(DONOR_DASHBOARD)).toContain("Your donor dashboard");
    expect(read(DONOR_POPUP)).toContain("DonorMatchPopup");
    expect(read("src/app/(requester)/actions.ts")).toContain("createBloodRequestAndFindDonorsAction");
  });
});
