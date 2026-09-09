import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  EMERGENCY_RADIUS_KM_DEFAULT,
  EMERGENCY_RADIUS_KM_MAX,
  EMERGENCY_RADIUS_KM_MIN,
  isValidEmergencyRadiusKm,
  passesEmergencyCandidateCriteria,
  type EmergencyCandidateRow,
} from "@/lib/matching/emergencyCriteria";
import { passesHardMatchingCriteria } from "@/lib/matching/criteria";
import { closingPopupChangesMatchStatus, sortDonorMatchesByPopupPriority } from "@/lib/matches/responseRules";
import { createBloodRequestSchema } from "@/schemas/bloodRequest.schema";
import { emergencySettingsSchema } from "@/schemas/availability.schema";
import { NOTIFICATION_CHANNELS, NOTIFICATION_KINDS } from "@/lib/constants/verification";
import type { BloodGroup } from "@/lib/constants/bloodGroups";
import type { DonorInboxMatch } from "@/types/domain";

const root = path.resolve(__dirname, "..");

function emergencyCandidate(
  overrides: Partial<EmergencyCandidateRow> = {}
): EmergencyCandidateRow {
  return {
    donorId: "donor-1",
    userId: "user-donor",
    bloodGroup: "O_NEG",
    isEligible: true,
    verificationStatus: "UNVERIFIED",
    isAvailable: false,
    emergencyResponseEnabled: true,
    emergencyRadiusKm: 10,
    distanceMeters: 2000,
    ...overrides,
  };
}

function inboxMatch(
  overrides: {
    matchId?: string;
    request?: Partial<DonorInboxMatch["request"]>;
    score?: number | null;
  } = {}
): DonorInboxMatch {
  return {
    matchId: overrides.matchId ?? "match-1",
    bloodRequestId: "req-1",
    donorId: "donor-1",
    matchStatus: "NOTIFIED",
    score: overrides.score ?? 10,
    distanceMeters: 1500,
    respondedAt: null,
    request: {
      bloodGroup: "O_NEG",
      quantityUnits: 2,
      urgency: "HIGH",
      requiredBy: "2026-09-08T12:00:00.000Z",
      hospitalNameFreeform: "City Hospital",
      status: "MATCHING",
      isEmergency: false,
      ...overrides.request,
    },
  };
}

describe("Phase 6 notification constants", () => {
  it("includes IN_APP without overloading delivery status enums", () => {
    expect(NOTIFICATION_KINDS).toContain("MATCH_NOTIFY");
    expect(NOTIFICATION_KINDS).toContain("EMERGENCY_RESPONSE");
    expect(NOTIFICATION_CHANNELS).toContain("IN_APP");
  });

  it("implements notificationService with IN_APP idempotency and read_at", () => {
    const source = readFileSync(path.join(root, "src/services/notificationService.ts"), "utf8");
    expect(source).toContain('channel: "IN_APP"');
    expect(source).toContain("mark_own_notification_read");
    expect(source).toContain("createAdminClient");
    expect(source).toContain("blood_request_id");
    expect(source).toContain("kind");
    expect(source).not.toContain("NotImplementedError");
    expect(source).not.toContain("twilio");
    expect(source).not.toContain("VAPID");
  });

  it("keeps payload safety helpers free of coordinates and private contact", () => {
    const matchNotify = readFileSync(path.join(root, "src/services/matchNotifyService.ts"), "utf8");
    const emergency = readFileSync(
      path.join(root, "src/services/emergencyResponseService.ts"),
      "utf8"
    );

    const matchPayload = matchNotify.slice(
      matchNotify.indexOf("function safeMatchPayload"),
      matchNotify.indexOf("export async function notifyMatchedDonorsForRequest")
    );
    const emergencyPayload = emergency.slice(
      emergency.indexOf("function safeEmergencyPayload"),
      emergency.indexOf("async function findCandidates")
    );

    for (const source of [matchPayload, emergencyPayload]) {
      expect(source).toContain("approximateDistanceKm");
      expect(source).not.toContain("contactPhone");
      expect(source).not.toContain("contact_phone");
      expect(source).not.toContain("latitude");
      expect(source).not.toContain("longitude");
    }
  });
});

describe("Phase 6 emergency settings schema", () => {
  it("allows enable/disable with bounded radius", () => {
    expect(
      emergencySettingsSchema.safeParse({
        emergencyResponseEnabled: true,
        emergencyRadiusKm: EMERGENCY_RADIUS_KM_DEFAULT,
      }).success
    ).toBe(true);
    expect(
      emergencySettingsSchema.safeParse({
        emergencyResponseEnabled: false,
        emergencyRadiusKm: 5,
      }).success
    ).toBe(true);
  });

  it("rejects out-of-range radius", () => {
    expect(
      emergencySettingsSchema.safeParse({
        emergencyResponseEnabled: true,
        emergencyRadiusKm: EMERGENCY_RADIUS_KM_MIN - 1,
      }).success
    ).toBe(false);
    expect(
      emergencySettingsSchema.safeParse({
        emergencyResponseEnabled: true,
        emergencyRadiusKm: EMERGENCY_RADIUS_KM_MAX + 1,
      }).success
    ).toBe(false);
    expect(isValidEmergencyRadiusKm(10)).toBe(true);
    expect(isValidEmergencyRadiusKm(4)).toBe(false);
  });

  it("does not couple emergency settings to is_available in donorService", () => {
    const source = readFileSync(path.join(root, "src/services/donorService.ts"), "utf8");
    expect(source).toContain("setEmergencySettings");
    expect(source).toContain("emergency_response_enabled");
    expect(source).toContain("emergency_radius_km");
    const setEmergencyBlock = source.slice(source.indexOf("async setEmergencySettings"));
    const methodBody = setEmergencyBlock.slice(0, setEmergencyBlock.indexOf("async getDonationHistory"));
    expect(methodBody).not.toContain("is_available:");
  });
});

describe("Phase 6 emergency candidate criteria", () => {
  it("includes busy / unavailable opted-in eligible compatible donors", () => {
    expect(passesEmergencyCandidateCriteria(emergencyCandidate(), "A_POS", "user-requester")).toBe(
      true
    );
    expect(
      passesEmergencyCandidateCriteria(emergencyCandidate({ isAvailable: false }), "A_POS", "user-requester")
    ).toBe(true);
  });

  it("excludes opted-out, ineligible, rejected, incompatible, requester, and out-of-radius", () => {
    expect(
      passesEmergencyCandidateCriteria(
        emergencyCandidate({ emergencyResponseEnabled: false }),
        "A_POS",
        "user-requester"
      )
    ).toBe(false);
    expect(
      passesEmergencyCandidateCriteria(emergencyCandidate({ isEligible: false }), "A_POS", "user-requester")
    ).toBe(false);
    expect(
      passesEmergencyCandidateCriteria(
        emergencyCandidate({ verificationStatus: "REJECTED" }),
        "A_POS",
        "user-requester"
      )
    ).toBe(false);
    expect(
      passesEmergencyCandidateCriteria(
        emergencyCandidate({ bloodGroup: "B_POS" as BloodGroup }),
        "A_POS",
        "user-requester"
      )
    ).toBe(false);
    expect(
      passesEmergencyCandidateCriteria(emergencyCandidate({ userId: "user-requester" }), "A_POS", "user-requester")
    ).toBe(false);
    expect(
      passesEmergencyCandidateCriteria(
        emergencyCandidate({ distanceMeters: 20_000, emergencyRadiusKm: 10 }),
        "A_POS",
        "user-requester"
      )
    ).toBe(false);
    expect(
      passesEmergencyCandidateCriteria(
        emergencyCandidate({ distanceMeters: 8_000, emergencyRadiusKm: 10 }),
        "A_POS",
        "user-requester"
      )
    ).toBe(true);
  });

  it("does not weaken Phase 4 hard criteria (still requires availability)", () => {
    expect(
      passesHardMatchingCriteria(
        {
          donorId: "d1",
          bloodGroup: "O_NEG",
          isEligible: true,
          verificationStatus: "UNVERIFIED",
          isAvailable: false,
          isAvailableAtNight: false,
          distanceMeters: 1000,
          locationPresent: true,
        },
        "A_POS",
        "user-requester"
      )
    ).toBe(false);
  });

  it("does not modify Phase 4 matching algorithm files", () => {
    for (const file of ["compatibility.ts", "scoring.ts", "ranking.ts"]) {
      const source = readFileSync(path.join(root, "src/lib/matching", file), "utf8");
      expect(source).not.toContain("emergency_response");
      expect(source).not.toContain("is_emergency");
    }
  });
});

describe("Phase 6 request emergency flag", () => {
  const base = {
    bloodGroup: "A_POS",
    quantityUnits: 2,
    urgency: "CRITICAL" as const,
    hospitalNameFreeform: "City Hospital",
    location: { latitude: 23.81, longitude: 90.41 },
    contactName: "Requester",
    contactPhone: "+8801700000000",
  };

  it("defaults isEmergency to false and never infers from CRITICAL alone", () => {
    const parsed = createBloodRequestSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isEmergency).toBe(false);
    }
  });

  it("accepts explicit isEmergency true", () => {
    const parsed = createBloodRequestSchema.safeParse({ ...base, isEmergency: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isEmergency).toBe(true);
    }
  });
});

describe("Phase 6 emergency response / popup integration", () => {
  it("reuses Phase 5 accept/decline actions for YES/NO", () => {
    const popup = readFileSync(path.join(root, "src/components/forms/DonorMatchPopup.tsx"), "utf8");
    const overlay = readFileSync(
      path.join(root, "src/components/forms/DonorPortalMatchOverlay.tsx"),
      "utf8"
    );
    const layout = readFileSync(path.join(root, "src/app/(donor)/layout.tsx"), "utf8");

    expect(popup).toContain("acceptMatchAction");
    expect(popup).toContain("declineMatchAction");
    expect(popup).toContain("YES, I CAN HELP");
    expect(popup).toContain("NO, I CANNOT");
    expect(popup).toContain('data-popup-mode={mode}');
    expect(popup).toContain("markNotificationReadAction");
    expect(popup).not.toContain("acceptEmergencyMatchAction");
    expect(overlay).toContain("DonorPortalMatchOverlay");
    expect(layout).toContain("DonorPortalMatchOverlay");
    expect(closingPopupChangesMatchStatus()).toBe(false);
  });

  it("prioritizes emergency matches in the global popup queue", () => {
    const sorted = sortDonorMatchesByPopupPriority([
      inboxMatch({ matchId: "normal", request: { urgency: "CRITICAL", isEmergency: false }, score: 99 }),
      inboxMatch({ matchId: "emergency", request: { urgency: "MODERATE", isEmergency: true }, score: 1 }),
    ]);
    expect(sorted[0]?.matchId).toBe("emergency");
  });

  it("wires busy-donor acceptance only in accept RPC for emergency requests", () => {
    const migration = readFileSync(
      path.join(root, "supabase/migrations/0007_notifications_emergency.sql"),
      "utf8"
    );
    expect(migration).toContain("is_emergency");
    expect(migration).toContain("emergency_response_enabled");
    expect(migration).toContain("find_emergency_response_candidates");
    expect(migration).toContain("accept_blood_request_match");
    expect(migration).toContain("v_request.is_emergency");
    expect(migration).toContain("IN_APP");
    expect(migration).toContain("read_at");
    expect(migration).toContain("notification_kind");
    expect(migration).not.toContain("escalationService");
    expect(migration).not.toContain("create table emergency_events");
  });

  it("orchestrates notify after matching without putting notify inside matchingService", () => {
    const orchestrator = readFileSync(
      path.join(root, "src/services/requestMatchOrchestrator.ts"),
      "utf8"
    );
    const matching = readFileSync(path.join(root, "src/services/matchingService.ts"), "utf8");
    const emergency = readFileSync(
      path.join(root, "src/services/emergencyResponseService.ts"),
      "utf8"
    );

    expect(orchestrator).toContain("runMatchingForRequest");
    expect(orchestrator).toContain("notifyMatchedDonorsForRequest");
    expect(orchestrator).toContain("emergencyResponseService.runForRequest");
    expect(matching).not.toContain("notificationService");
    expect(matching).not.toContain("emergencyResponseService");
    expect(emergency).toContain("passesEmergencyCandidateCriteria");
    expect(emergency).toContain("INITIAL_MATCH_STATUS");
    expect(emergency).not.toContain("escalationService");
  });
});

describe("Phase 6 Phase 7 protection", () => {
  it("keeps Phase 7 escalation separate from Phase 6 emergency response", () => {
    const emergency = readFileSync(
      path.join(root, "src/services/emergencyResponseService.ts"),
      "utf8"
    );
    expect(emergency).not.toContain("escalationService");
    expect(emergency).not.toContain("emergency_events");
    expect(emergency).not.toContain("find_nearby_escalation_organizations");
  });
});
