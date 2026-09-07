import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { BLOOD_GROUPS, type BloodGroup } from "@/lib/constants/bloodGroups";
import { isCompatible, COMPATIBLE_DONORS_BY_RECIPIENT } from "@/lib/matching/compatibility";
import { passesHardMatchingCriteria, isProtectedMatchStatus } from "@/lib/matching/criteria";
import {
  isNightRequiredBy,
  MATCH_MAX_CANDIDATES,
  MATCH_SCORE_WEIGHTS,
  MATCH_SEARCH_RADII_METERS,
  scoreMatchCandidate,
  verificationBoost,
} from "@/lib/matching/scoring";
import {
  canRefreshMatchRow,
  INITIAL_MATCH_STATUS,
  selectRankedCandidates,
} from "@/lib/matching/ranking";
import { assertOwnsRequest, canRunMatching } from "@/lib/requests/statusRules";
import { toDonorPublicSummary } from "@/lib/donors/publicSummary";
import { AppError } from "@/lib/errors/AppError";
import type { BloodRequest, DonorProfile } from "@/types/domain";

const baseRequest: BloodRequest = {
  id: "req-1",
  requesterId: "user-requester",
  bloodGroup: "A_POS",
  quantityUnits: 1,
  urgency: "CRITICAL",
  requiredBy: "2026-09-08T22:00:00.000Z",
  hospitalId: null,
  hospitalNameFreeform: "City Hospital",
  location: { latitude: 23.81, longitude: 90.41 },
  contactName: "Requester",
  contactPhone: "+8801700000000",
  status: "PENDING",
  notes: null,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
  expiresAt: null,
  isEmergency: false,
};

function candidate(overrides: Partial<Parameters<typeof passesHardMatchingCriteria>[0]> = {}) {
  return {
    donorId: "donor-1",
    userId: "user-donor",
    bloodGroup: "O_NEG" as BloodGroup,
    isEligible: true,
    verificationStatus: "UNVERIFIED" as const,
    isAvailable: true,
    isAvailableAtNight: false,
    distanceMeters: 1000,
    locationPresent: true,
    ...overrides,
  };
}

describe("blood compatibility matrix", () => {
  it("accepts every listed compatible pair and rejects all others", () => {
    for (const recipient of BLOOD_GROUPS) {
      const allowed = new Set(COMPATIBLE_DONORS_BY_RECIPIENT[recipient]);
      for (const donor of BLOOD_GROUPS) {
        expect(isCompatible(donor, recipient)).toBe(allowed.has(donor));
      }
    }
  });

  it("matches the product whole-blood rules for key recipients", () => {
    expect(COMPATIBLE_DONORS_BY_RECIPIENT.O_NEG).toEqual(["O_NEG"]);
    expect(COMPATIBLE_DONORS_BY_RECIPIENT.O_POS).toEqual(["O_NEG", "O_POS"]);
    expect(COMPATIBLE_DONORS_BY_RECIPIENT.AB_POS).toEqual([...BLOOD_GROUPS]);
  });
});

describe("hard matching criteria", () => {
  it("requires availability, eligibility, location, compatibility, and non-rejected", () => {
    expect(passesHardMatchingCriteria(candidate(), "A_POS", "user-requester")).toBe(true);
    expect(passesHardMatchingCriteria(candidate({ isAvailable: false }), "A_POS", "user-requester")).toBe(false);
    expect(passesHardMatchingCriteria(candidate({ isEligible: false }), "A_POS", "user-requester")).toBe(false);
    expect(passesHardMatchingCriteria(candidate({ locationPresent: false }), "A_POS", "user-requester")).toBe(false);
    expect(
      passesHardMatchingCriteria(candidate({ verificationStatus: "REJECTED" }), "A_POS", "user-requester")
    ).toBe(false);
    expect(passesHardMatchingCriteria(candidate({ bloodGroup: "B_POS" }), "A_POS", "user-requester")).toBe(false);
  });

  it("allows UNVERIFIED, PENDING, and VERIFIED", () => {
    expect(
      passesHardMatchingCriteria(candidate({ verificationStatus: "UNVERIFIED" }), "A_POS", "user-requester")
    ).toBe(true);
    expect(
      passesHardMatchingCriteria(candidate({ verificationStatus: "PENDING" }), "A_POS", "user-requester")
    ).toBe(true);
    expect(
      passesHardMatchingCriteria(candidate({ verificationStatus: "VERIFIED" }), "A_POS", "user-requester")
    ).toBe(true);
  });

  it("excludes the requester matching themselves", () => {
    expect(
      passesHardMatchingCriteria(candidate({ userId: "user-requester" }), "A_POS", "user-requester")
    ).toBe(false);
  });

  it("does not require night availability", () => {
    expect(
      passesHardMatchingCriteria(candidate({ isAvailableAtNight: false }), "A_POS", "user-requester")
    ).toBe(true);
  });
});

describe("scoring and night boost", () => {
  it("uses documented weights and ranks closer donors higher", () => {
    expect(MATCH_SCORE_WEIGHTS.DISTANCE_WEIGHT).toBe(100);
    expect(MATCH_SCORE_WEIGHTS.VERIFICATION_VERIFIED).toBe(15);
    expect(MATCH_SCORE_WEIGHTS.VERIFICATION_PENDING).toBe(8);
    expect(MATCH_SCORE_WEIGHTS.VERIFICATION_UNVERIFIED).toBe(0);
    expect(MATCH_SCORE_WEIGHTS.NIGHT_AVAILABILITY).toBe(10);

    const near = scoreMatchCandidate({
      distanceMeters: 1000,
      verificationStatus: "UNVERIFIED",
      isAvailableAtNight: false,
      requestRequiredBy: "2026-09-08T12:00:00.000Z",
    });
    const far = scoreMatchCandidate({
      distanceMeters: 10000,
      verificationStatus: "UNVERIFIED",
      isAvailableAtNight: false,
      requestRequiredBy: "2026-09-08T12:00:00.000Z",
    });
    expect(near).toBeGreaterThan(far);
  });

  it("boosts VERIFIED over PENDING over UNVERIFIED", () => {
    expect(verificationBoost("VERIFIED")).toBeGreaterThan(verificationBoost("PENDING"));
    expect(verificationBoost("PENDING")).toBeGreaterThan(verificationBoost("UNVERIFIED"));
  });

  it("applies night boost only for night required_by windows", () => {
    expect(isNightRequiredBy("2026-09-08T22:00:00.000Z")).toBe(true);
    expect(isNightRequiredBy("2026-09-08T05:00:00.000Z")).toBe(true);
    expect(isNightRequiredBy("2026-09-08T12:00:00.000Z")).toBe(false);
    expect(isNightRequiredBy(null)).toBe(false);

    const nightScore = scoreMatchCandidate({
      distanceMeters: 1000,
      verificationStatus: "UNVERIFIED",
      isAvailableAtNight: true,
      requestRequiredBy: "2026-09-08T22:00:00.000Z",
    });
    const dayScore = scoreMatchCandidate({
      distanceMeters: 1000,
      verificationStatus: "UNVERIFIED",
      isAvailableAtNight: true,
      requestRequiredBy: "2026-09-08T12:00:00.000Z",
    });
    expect(nightScore - dayScore).toBe(MATCH_SCORE_WEIGHTS.NIGHT_AVAILABILITY);
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      distanceMeters: 2500,
      verificationStatus: "PENDING" as const,
      isAvailableAtNight: true,
      requestRequiredBy: "2026-09-08T21:00:00.000Z",
    };
    expect(scoreMatchCandidate(input)).toBe(scoreMatchCandidate(input));
  });
});

describe("radius expansion and max candidates", () => {
  it("uses 5 → 15 → 30 km and caps at 20", () => {
    expect([...MATCH_SEARCH_RADII_METERS]).toEqual([5000, 15000, 30000]);
    expect(MATCH_MAX_CANDIDATES).toBe(20);
  });

  it("stops early once 20 unique candidates exist and never exceeds 20", () => {
    const byRadius = new Map<number, ReturnType<typeof candidate>[]>();
    byRadius.set(
      5000,
      Array.from({ length: 25 }, (_, i) =>
        candidate({ donorId: `d-${i}`, distanceMeters: 100 + i, bloodGroup: "O_NEG" })
      )
    );
    byRadius.set(15000, [candidate({ donorId: "extra", distanceMeters: 12000 })]);
    byRadius.set(30000, [candidate({ donorId: "far", distanceMeters: 25000 })]);

    const ranked = selectRankedCandidates(baseRequest, byRadius);
    expect(ranked).toHaveLength(20);
    expect(ranked.some((row) => row.donorId === "extra")).toBe(false);
    expect(ranked.some((row) => row.donorId === "far")).toBe(false);
  });

  it("keeps all valid candidates under 20 after 30 km", () => {
    const byRadius = new Map<number, ReturnType<typeof candidate>[]>();
    byRadius.set(5000, [candidate({ donorId: "a", distanceMeters: 1000 })]);
    byRadius.set(15000, [candidate({ donorId: "b", distanceMeters: 8000 })]);
    byRadius.set(30000, [candidate({ donorId: "c", distanceMeters: 20000 })]);
    expect(selectRankedCandidates(baseRequest, byRadius)).toHaveLength(3);
  });
});

describe("match status and re-run protection", () => {
  it("uses MATCHED as the Phase 4 initial status", () => {
    expect(INITIAL_MATCH_STATUS).toBe("MATCHED");
    expect(INITIAL_MATCH_STATUS).not.toBe("NOTIFIED");
  });

  it("does not refresh ACCEPTED or DECLINED rows", () => {
    expect(isProtectedMatchStatus("ACCEPTED")).toBe(true);
    expect(isProtectedMatchStatus("DECLINED")).toBe(true);
    expect(canRefreshMatchRow("ACCEPTED")).toBe(false);
    expect(canRefreshMatchRow("DECLINED")).toBe(false);
    expect(canRefreshMatchRow("MATCHED")).toBe(true);
    expect(canRefreshMatchRow("NOTIFIED")).toBe(true);
  });
});

describe("request status transitions for matching", () => {
  it("allows matching only on PENDING, MATCHING, and NO_MATCH_FOUND", () => {
    expect(canRunMatching("PENDING")).toBe(true);
    expect(canRunMatching("MATCHING")).toBe(true);
    expect(canRunMatching("NO_MATCH_FOUND")).toBe(true);
    expect(canRunMatching("CANCELLED")).toBe(false);
    expect(canRunMatching("EXPIRED")).toBe(false);
    expect(canRunMatching("COMPLETED")).toBe(false);
    expect(canRunMatching("DONOR_ACCEPTED")).toBe(false);
  });

  it("documents PENDING→MATCHING and PENDING/MATCHING→NO_MATCH_FOUND outcomes", () => {
    const withMatches = (count: number) => (count > 0 ? "MATCHING" : "NO_MATCH_FOUND");
    expect(withMatches(3)).toBe("MATCHING");
    expect(withMatches(0)).toBe("NO_MATCH_FOUND");
  });
});

describe("ownership authorization", () => {
  it("rejects non-owners", () => {
    expect(() => assertOwnsRequest("owner", "intruder")).toThrow(AppError);
  });
});

describe("privacy and no notification side effects", () => {
  it("omits exact coordinates from public summaries", () => {
    const profile: DonorProfile = {
      id: "donor-1",
      userId: "u1",
      bloodGroup: "O_NEG",
      lastDonationDate: null,
      isEligible: true,
      verificationStatus: "VERIFIED",
      location: { latitude: 23.8103, longitude: 90.4125 },
      isAvailable: true,
      isAvailableAtNight: true,
      emergencyResponseEnabled: false,
      emergencyRadiusKm: 10,
    };
    const summary = toDonorPublicSummary(profile, 2.4);
    expect(summary).not.toHaveProperty("location");
    expect(JSON.stringify(summary)).not.toContain("23.8103");
    expect(JSON.stringify(summary)).not.toContain("90.4125");
  });

  it("does not import notification or escalation services", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../src/services/matchingService.ts"),
      "utf8"
    );
    expect(source).not.toContain("notificationService");
    expect(source).not.toContain("escalationService");
    expect(source).toContain("INITIAL_MATCH_STATUS");
    expect(source).toContain("notified_at: null");
    expect(source).toContain("responded_at: null");
  });
});
