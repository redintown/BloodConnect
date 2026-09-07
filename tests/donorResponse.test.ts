import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { AppError } from "@/lib/errors/AppError";
import {
  assertCanDonorRespond,
  canDonorRespond,
  canMarkDonorOnTheWay,
  canRespondToRequestStatus,
  isTerminalMatchStatus,
  mapDonorResponseRpcError,
  RESPONDABLE_MATCH_STATUSES,
} from "@/lib/matches/responseRules";
import {
  canRequesterConfirmDonation,
  canTransitionToCompleted,
  canTransitionToDonorAccepted,
  canTransitionToDonorOnTheWay,
} from "@/lib/requests/statusRules";
import { recordDonationSchema } from "@/schemas/donation.schema";
import type { AcceptedMatchContact } from "@/types/domain";

describe("match response transitions", () => {
  it("allows accept/decline from MATCHED, NOTIFIED, and VIEWED only", () => {
    expect(RESPONDABLE_MATCH_STATUSES).toEqual(["MATCHED", "NOTIFIED", "VIEWED"]);
    expect(canDonorRespond("MATCHED")).toBe(true);
    expect(canDonorRespond("NOTIFIED")).toBe(true);
    expect(canDonorRespond("VIEWED")).toBe(true);
    expect(canDonorRespond("ACCEPTED")).toBe(false);
    expect(canDonorRespond("DECLINED")).toBe(false);
    expect(canDonorRespond("EXPIRED")).toBe(false);
  });

  it("treats ACCEPTED, DECLINED, and EXPIRED as terminal", () => {
    expect(isTerminalMatchStatus("ACCEPTED")).toBe(true);
    expect(isTerminalMatchStatus("DECLINED")).toBe(true);
    expect(isTerminalMatchStatus("EXPIRED")).toBe(true);
    expect(isTerminalMatchStatus("MATCHED")).toBe(false);
  });

  it("only allows responses while the request is MATCHING", () => {
    expect(canRespondToRequestStatus("MATCHING")).toBe(true);
    expect(canRespondToRequestStatus("PENDING")).toBe(false);
    expect(canRespondToRequestStatus("CANCELLED")).toBe(false);
    expect(canRespondToRequestStatus("EXPIRED")).toBe(false);
    expect(canRespondToRequestStatus("COMPLETED")).toBe(false);
    expect(canRespondToRequestStatus("DONOR_ACCEPTED")).toBe(false);
  });

  it("blocks respond helpers for terminal matches and non-matching requests", () => {
    expect(() => assertCanDonorRespond("MATCHED", "MATCHING")).not.toThrow();
    expect(() => assertCanDonorRespond("ACCEPTED", "MATCHING")).toThrow(AppError);
    expect(() => assertCanDonorRespond("MATCHED", "CANCELLED")).toThrow(AppError);
    expect(() => assertCanDonorRespond("MATCHED", "PENDING")).toThrow(AppError);
    expect(() => assertCanDonorRespond("MATCHED", "COMPLETED")).toThrow(AppError);
    expect(() => assertCanDonorRespond("MATCHED", "EXPIRED")).toThrow(AppError);
  });
});

describe("Phase 5 request status transitions", () => {
  it("follows MATCHING → DONOR_ACCEPTED → DONOR_ON_THE_WAY → COMPLETED", () => {
    expect(canTransitionToDonorAccepted("MATCHING")).toBe(true);
    expect(canTransitionToDonorAccepted("PENDING")).toBe(false);
    expect(canTransitionToDonorOnTheWay("DONOR_ACCEPTED")).toBe(true);
    expect(canTransitionToDonorOnTheWay("MATCHING")).toBe(false);
    expect(canTransitionToCompleted("DONOR_ON_THE_WAY")).toBe(true);
    expect(canTransitionToCompleted("DONOR_ACCEPTED")).toBe(false);
  });

  it("only the requester confirm path uses DONOR_ON_THE_WAY", () => {
    expect(canRequesterConfirmDonation("DONOR_ON_THE_WAY")).toBe(true);
    expect(canRequesterConfirmDonation("DONOR_ACCEPTED")).toBe(false);
    expect(canRequesterConfirmDonation("COMPLETED")).toBe(false);
  });

  it("on-the-way requires accepted match + DONOR_ACCEPTED request", () => {
    expect(canMarkDonorOnTheWay("DONOR_ACCEPTED", "ACCEPTED")).toBe(true);
    expect(canMarkDonorOnTheWay("DONOR_ACCEPTED", "MATCHED")).toBe(false);
    expect(canMarkDonorOnTheWay("MATCHING", "ACCEPTED")).toBe(false);
    expect(canMarkDonorOnTheWay("DONOR_ON_THE_WAY", "ACCEPTED")).toBe(false);
  });
});

describe("RPC error mapping", () => {
  it("maps authorization, conflict, and duplicate donation codes", () => {
    expect(mapDonorResponseRpcError({ message: "BC_UNAUTHORIZED" }).code).toBe(
      "AUTHORIZATION_ERROR"
    );
    expect(mapDonorResponseRpcError({ message: "BC_NOT_FOUND" }).code).toBe("NOT_FOUND");
    expect(mapDonorResponseRpcError({ message: "BC_INELIGIBLE" }).code).toBe("CONFLICT");
    expect(mapDonorResponseRpcError({ message: "BC_UNAVAILABLE" }).code).toBe("CONFLICT");
    expect(mapDonorResponseRpcError({ message: "BC_MATCH_TERMINAL" }).code).toBe("CONFLICT");
    expect(mapDonorResponseRpcError({ message: "BC_REQUEST_NOT_MATCHING" }).code).toBe("CONFLICT");
    expect(mapDonorResponseRpcError({ message: "BC_DUPLICATE_DONATION" }).code).toBe("CONFLICT");
  });
});

describe("donation schema", () => {
  it("requires donor, request, and match ids", () => {
    expect(
      recordDonationSchema.safeParse({
        donorId: "11111111-1111-4111-8111-111111111111",
        bloodRequestId: "22222222-2222-4222-8222-222222222222",
        bloodRequestMatchId: "33333333-3333-4333-8333-333333333333",
        quantityMl: 450,
      }).success
    ).toBe(true);

    expect(
      recordDonationSchema.safeParse({
        donorId: "not-a-uuid",
        bloodRequestId: "22222222-2222-4222-8222-222222222222",
        bloodRequestMatchId: "33333333-3333-4333-8333-333333333333",
      }).success
    ).toBe(false);
  });
});

describe("contact privacy contract", () => {
  it("AcceptedMatchContact never includes donor coordinates", () => {
    const contact: AcceptedMatchContact = {
      matchId: "m1",
      bloodRequestId: "r1",
      requestStatus: "DONOR_ACCEPTED",
      matchStatus: "ACCEPTED",
      donor: {
        name: "Donor",
        phone: "+8801700000000",
        bloodGroup: "O_NEG",
        distanceKm: 1.2,
      },
      request: {
        contactName: "Requester",
        contactPhone: "+8801711111111",
        hospitalNameFreeform: "City Hospital",
        bloodGroup: "A_POS",
        quantityUnits: 2,
        urgency: "HIGH",
        requiredBy: null,
        notes: null,
      },
    };

    expect(contact.donor).not.toHaveProperty("latitude");
    expect(contact.donor).not.toHaveProperty("longitude");
    expect(contact.donor).not.toHaveProperty("location");
    expect(JSON.stringify(contact)).not.toMatch(/latitude|longitude/);
  });
});

describe("Phase 5 source guards", () => {
  const root = path.join(__dirname, "..");

  it("does not import notificationService from Phase 5 response paths", () => {
    const files = [
      "src/services/matchResponseService.ts",
      "src/services/donationService.ts",
      "src/services/bloodRequestService.ts",
      "src/app/(donor)/actions.ts",
      "src/app/(requester)/actions.ts",
      "src/app/(donor)/donor/requests/page.tsx",
    ];
    for (const relative of files) {
      const source = readFileSync(path.join(root, relative), "utf8");
      expect(source).not.toContain("notificationService");
      expect(source).not.toContain("notifyBatch");
    }
  });

  it("keeps Phase 4 matching algorithm files free of response RPCs", () => {
    const scoring = readFileSync(path.join(root, "src/lib/matching/scoring.ts"), "utf8");
    const compatibility = readFileSync(
      path.join(root, "src/lib/matching/compatibility.ts"),
      "utf8"
    );
    expect(scoring).not.toContain("accept_blood_request_match");
    expect(compatibility).not.toContain("accept_blood_request_match");
  });

  it("migration defines single-acceptor accept RPC and donation uniqueness", () => {
    const migration = readFileSync(
      path.join(root, "supabase/migrations/0006_donor_response.sql"),
      "utf8"
    );
    expect(migration).toContain("accept_blood_request_match");
    expect(migration).toContain("decline_blood_request_match");
    expect(migration).toContain("mark_donor_on_the_way");
    expect(migration).toContain("confirm_donation_received");
    expect(migration).toContain("blood_request_match_id");
    expect(migration).toContain("idx_donations_donor_request_unique");
    expect(migration).toContain("for update");
    expect(migration).toContain("DONOR_ACCEPTED");
    expect(migration).not.toContain("notified_at");
    expect(migration).not.toMatch(/status\s*=\s*'NOTIFIED'/);
    expect(migration).not.toContain("notifyBatch");
    expect(migration).not.toContain("insert into notifications");
  });

  it("accept RPC expires competing open matches and locks request", () => {
    const migration = readFileSync(
      path.join(root, "supabase/migrations/0006_donor_response.sql"),
      "utf8"
    );
    expect(migration).toContain("'EXPIRED'::donor_response_status");
    expect(migration).toContain("'ACCEPTED'::donor_response_status");
    expect(migration).toContain("status = 'MATCHING'::blood_request_status");
    expect(migration).toContain("is_eligible");
    expect(migration).toContain("is_available");
  });

  it("confirm RPC updates last_donation_date and does not set is_eligible directly", () => {
    const migration = readFileSync(
      path.join(root, "supabase/migrations/0006_donor_response.sql"),
      "utf8"
    );
    expect(migration).toContain("last_donation_date");
    expect(migration).toContain("insert into donations");
    expect(migration).not.toMatch(/is_eligible\s*=/);
  });

  it("donationService owns donation inserts via service role patterns", () => {
    const source = readFileSync(path.join(root, "src/services/donationService.ts"), "utf8");
    expect(source).toContain("createAdminClient");
    expect(source).toContain("recordDonation");
    expect(source).toContain("server-only");
  });
});
