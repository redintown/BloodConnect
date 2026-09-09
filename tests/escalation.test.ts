import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  canRequesterEscalateNow,
  deriveEscalationReason,
  hasAcceptedDonorMatch,
  isAdminFollowupDue,
  isDonorEscalationDue,
  isRequestOpenForEscalation,
  isRequestTerminalForEscalation,
} from "@/lib/escalation/rules";
import {
  ESCALATION_DONOR_RESPONSE_WINDOW_MS,
  ESCALATION_ORG_SEARCH_RADIUS_METERS,
} from "@/lib/escalation/constants";
import { NOTIFICATION_KINDS } from "@/lib/constants/verification";

const root = path.resolve(__dirname, "..");

describe("Phase 7 escalation trigger rules", () => {
  it("only allows open MATCHING / NO_MATCH_FOUND statuses", () => {
    expect(isRequestOpenForEscalation("MATCHING")).toBe(true);
    expect(isRequestOpenForEscalation("NO_MATCH_FOUND")).toBe(true);
    expect(isRequestOpenForEscalation("PENDING")).toBe(false);
    expect(isRequestOpenForEscalation("DONOR_ACCEPTED")).toBe(false);
    expect(isRequestTerminalForEscalation("COMPLETED")).toBe(true);
    expect(isRequestTerminalForEscalation("CANCELLED")).toBe(true);
    expect(isRequestTerminalForEscalation("EXPIRED")).toBe(true);
  });

  it("detects accepted donor matches", () => {
    expect(hasAcceptedDonorMatch(["NOTIFIED", "DECLINED"])).toBe(false);
    expect(hasAcceptedDonorMatch(["NOTIFIED", "ACCEPTED"])).toBe(true);
  });

  it("derives structured reasons", () => {
    expect(deriveEscalationReason({ matchCount: 0, matchStatuses: [], manual: false })).toBe(
      "NO_MATCH"
    );
    expect(
      deriveEscalationReason({
        matchCount: 2,
        matchStatuses: ["DECLINED", "EXPIRED"],
        manual: false,
      })
    ).toBe("ALL_DECLINED");
    expect(
      deriveEscalationReason({
        matchCount: 1,
        matchStatuses: ["NOTIFIED"],
        manual: false,
      })
    ).toBe("NO_RESPONSE");
    expect(deriveEscalationReason({ matchCount: 1, matchStatuses: ["NOTIFIED"], manual: true })).toBe(
      "MANUAL"
    );
  });

  it("applies urgency windows and caps", () => {
    const start = new Date("2026-09-07T12:00:00.000Z");
    expect(
      isDonorEscalationDue({
        urgency: "CRITICAL",
        outreachStartedAt: start,
        requiredBy: null,
        expiresAt: null,
        now: new Date(start.getTime() + ESCALATION_DONOR_RESPONSE_WINDOW_MS.CRITICAL! - 1000),
      })
    ).toBe(false);
    expect(
      isDonorEscalationDue({
        urgency: "CRITICAL",
        outreachStartedAt: start,
        requiredBy: null,
        expiresAt: null,
        now: new Date(start.getTime() + ESCALATION_DONOR_RESPONSE_WINDOW_MS.CRITICAL! + 1000),
      })
    ).toBe(true);
    expect(
      isDonorEscalationDue({
        urgency: "MODERATE",
        outreachStartedAt: start,
        requiredBy: null,
        expiresAt: null,
        now: new Date("2030-01-01T00:00:00.000Z"),
      })
    ).toBe(false);

    expect(
      isAdminFollowupDue({
        urgency: "HIGH",
        orgEscalationTriggeredAt: start,
        requiredBy: null,
        expiresAt: null,
        now: new Date(start.getTime() + 3 * 60 * 60 * 1000),
      })
    ).toBe(true);
  });

  it("gates Escalate Now correctly", () => {
    expect(
      canRequesterEscalateNow({
        isEmergency: true,
        status: "MATCHING",
        hasAcceptedDonor: false,
        hasActiveEscalation: false,
      })
    ).toBe(true);
    expect(
      canRequesterEscalateNow({
        isEmergency: false,
        status: "MATCHING",
        hasAcceptedDonor: false,
        hasActiveEscalation: false,
      })
    ).toBe(false);
    expect(
      canRequesterEscalateNow({
        isEmergency: true,
        status: "DONOR_ACCEPTED",
        hasAcceptedDonor: true,
        hasActiveEscalation: false,
      })
    ).toBe(false);
    expect(
      canRequesterEscalateNow({
        isEmergency: true,
        status: "MATCHING",
        hasAcceptedDonor: false,
        hasActiveEscalation: true,
      })
    ).toBe(false);
  });
});

describe("Phase 7 source architecture", () => {
  it("implements escalationService without donor matching internals", () => {
    const source = readFileSync(path.join(root, "src/services/escalationService.ts"), "utf8");
    expect(source).not.toContain("NotImplementedError");
    expect(source).toContain("processDueEscalations");
    expect(source).toContain("BLOOD_BANKS_HOSPITALS");
    expect(source).toContain("ADMIN_INTERVENTION");
    expect(source).toContain("find_nearby_escalation_organizations");
    expect(source).toContain("ESCALATION_ORG");
    expect(source).not.toContain("COMPATIBLE_DONORS_BY_RECIPIENT");
    expect(source).not.toContain("scoreMatchCandidate");
    expect(source).not.toContain("find_nearby_match_candidates");
    expect(source).not.toContain("find_emergency_response_candidates");
    expect(source).not.toContain("accept_blood_request_match");
  });

  it("does not modify Phase 4 matching algorithm files", () => {
    for (const file of ["compatibility.ts", "scoring.ts", "ranking.ts"]) {
      const source = readFileSync(path.join(root, "src/lib/matching", file), "utf8");
      expect(source).not.toContain("escalation");
      expect(source).not.toContain("emergency_events");
    }
  });

  it("adds escalation notification kinds and keeps IN_APP channel", () => {
    expect(NOTIFICATION_KINDS).toContain("ESCALATION_ORG");
    expect(NOTIFICATION_KINDS).toContain("ESCALATION_ADMIN");
    expect(NOTIFICATION_KINDS).toContain("ESCALATION_REQUESTER");
    expect(NOTIFICATION_KINDS).toContain("ESCALATION_REQUESTER_ORG_RESPONSE");
    expect(NOTIFICATION_KINDS).toContain("ESCALATION_REQUESTER_ADMIN");
  });

  it("provides cron-ready escalate route with secret gate", () => {
    const source = readFileSync(path.join(root, "src/app/api/cron/escalate/route.ts"), "utf8");
    expect(source).toContain("CRON_SECRET");
    expect(source).toContain("processDueEscalations");
    expect(source).toContain("Unauthorized");
    expect(source).toContain("timingSafeEqual");
    expect(source).toContain("405");
  });

  it("extends emergency_events in 0008 without touching 0001–0007", () => {
    const migration = readFileSync(
      path.join(root, "supabase/migrations/0008_escalation.sql"),
      "utf8"
    );
    expect(migration).toContain("emergency_event_targets");
    expect(migration).toContain("idx_emergency_events_one_open_active");
    expect(migration).toContain("respond_to_escalation_target");
    expect(migration).toContain("ESCALATION_ORG");
    expect(migration).toContain("find_nearby_escalation_organizations");
    expect(migration).not.toContain("create table emergency_events (");
    expect(ESCALATION_ORG_SEARCH_RADIUS_METERS).toBe(50_000);
  });

  it("wires org inbox and Escalate Now UI", () => {
    const hospital = readFileSync(
      path.join(root, "src/app/(hospital)/hospital/requests/page.tsx"),
      "utf8"
    );
    const bank = readFileSync(
      path.join(root, "src/app/(blood-bank)/blood-bank/requests/page.tsx"),
      "utf8"
    );
    const detail = readFileSync(
      path.join(root, "src/app/(requester)/requests/[id]/page.tsx"),
      "utf8"
    );
    const popup = readFileSync(path.join(root, "src/components/forms/DonorMatchPopup.tsx"), "utf8");
    const inbox = readFileSync(
      path.join(root, "src/components/forms/OrganizationEscalationInbox.tsx"),
      "utf8"
    );

    expect(hospital).toContain("OrganizationEscalationInbox");
    expect(bank).toContain("OrganizationEscalationInbox");
    expect(detail).toContain("EscalateNowButton");
    expect(detail).toContain("escalationService.getEscalationSummary");
    expect(detail).toContain("formatRequesterCanSupplyInventoryHint");
    expect(inbox).toContain("inventoryService.getOwnUnitsByBloodGroupMap");
    expect(popup).not.toContain("ESCALATION_ORG");
    expect(popup).not.toContain("OrganizationEscalationInbox");
  });

  it("keeps org response separate from donor accept RPC", () => {
    const actions = readFileSync(path.join(root, "src/app/(org)/actions.ts"), "utf8");
    expect(actions).toContain("respondToEscalationAction");
    expect(actions).not.toContain("acceptMatchAction");
    expect(actions).not.toContain("accept_blood_request_match");
  });
});
