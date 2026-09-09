import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { AppError } from "@/lib/errors/AppError";
import {
  assertCanDonorRespond,
  canDonorRespond,
  canMarkDonorOnTheWay,
  canRespondToRequestStatus,
  closingPopupChangesMatchStatus,
  isActionableDonorMatch,
  isTerminalMatchStatus,
  mapDonorResponseRpcError,
  RESPONDABLE_MATCH_STATUSES,
  selectActionableDonorMatches,
  shouldShowDonorMatchPopup,
  sortDonorMatchesByPopupPriority,
} from "@/lib/matches/responseRules";
import {
  canRequesterConfirmDonation,
  canTransitionToCompleted,
  canTransitionToDonorAccepted,
  canTransitionToDonorOnTheWay,
} from "@/lib/requests/statusRules";
import { recordDonationSchema } from "@/schemas/donation.schema";
import type { AcceptedMatchContact, DonorInboxMatch } from "@/types/domain";

function inboxMatch(
  overrides: {
    matchId?: string;
    bloodRequestId?: string;
    donorId?: string;
    matchStatus?: DonorInboxMatch["matchStatus"];
    score?: number | null;
    distanceMeters?: number | null;
    respondedAt?: string | null;
    request?: Partial<DonorInboxMatch["request"]>;
  } = {}
): DonorInboxMatch {
  return {
    matchId: overrides.matchId ?? "match-1",
    bloodRequestId: overrides.bloodRequestId ?? "req-1",
    donorId: overrides.donorId ?? "donor-1",
    matchStatus: overrides.matchStatus ?? "MATCHED",
    score: overrides.score ?? 10,
    distanceMeters: overrides.distanceMeters ?? 1500,
    respondedAt: overrides.respondedAt ?? null,
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

describe("donor portal match popup visibility", () => {
  it("shows no popup when there are no actionable matches", () => {
    expect(shouldShowDonorMatchPopup([])).toBe(false);
    expect(
      shouldShowDonorMatchPopup([
        inboxMatch({ matchStatus: "ACCEPTED", request: { status: "DONOR_ACCEPTED" } }),
      ])
    ).toBe(false);
  });

  it("shows popup for MATCHED, NOTIFIED, and VIEWED while request is MATCHING", () => {
    expect(isActionableDonorMatch(inboxMatch({ matchStatus: "MATCHED" }))).toBe(true);
    expect(isActionableDonorMatch(inboxMatch({ matchStatus: "NOTIFIED" }))).toBe(true);
    expect(isActionableDonorMatch(inboxMatch({ matchStatus: "VIEWED" }))).toBe(true);
    expect(shouldShowDonorMatchPopup([inboxMatch({ matchStatus: "MATCHED" })])).toBe(true);
    expect(shouldShowDonorMatchPopup([inboxMatch({ matchStatus: "NOTIFIED" })])).toBe(true);
    expect(shouldShowDonorMatchPopup([inboxMatch({ matchStatus: "VIEWED" })])).toBe(true);
  });

  it("hides popup for ACCEPTED, DECLINED, and EXPIRED matches", () => {
    expect(isActionableDonorMatch(inboxMatch({ matchStatus: "ACCEPTED" }))).toBe(false);
    expect(isActionableDonorMatch(inboxMatch({ matchStatus: "DECLINED" }))).toBe(false);
    expect(isActionableDonorMatch(inboxMatch({ matchStatus: "EXPIRED" }))).toBe(false);
  });

  it("closing the popup does not change match status", () => {
    expect(closingPopupChangesMatchStatus()).toBe(false);
  });

  it("does not treat MATCHED + CANCELLED/COMPLETED as actionable", () => {
    expect(
      isActionableDonorMatch(
        inboxMatch({ matchStatus: "MATCHED", request: { status: "CANCELLED" } })
      )
    ).toBe(false);
    expect(
      isActionableDonorMatch(
        inboxMatch({ matchStatus: "MATCHED", request: { status: "COMPLETED" } })
      )
    ).toBe(false);
    expect(
      isActionableDonorMatch(
        inboxMatch({ matchStatus: "MATCHED", request: { status: "PENDING" } })
      )
    ).toBe(false);
  });

  it("selects a single prioritized queue instead of multiple simultaneous modals", () => {
    const selected = selectActionableDonorMatches([
      inboxMatch({
        matchId: "m-mod",
        matchStatus: "MATCHED",
        request: { urgency: "MODERATE", requiredBy: "2026-09-10T00:00:00.000Z" },
      }),
      inboxMatch({
        matchId: "m-crit",
        matchStatus: "NOTIFIED",
        request: { urgency: "CRITICAL", requiredBy: "2026-09-09T00:00:00.000Z" },
      }),
      inboxMatch({ matchId: "m-done", matchStatus: "DECLINED" }),
    ]);
    const ranked = sortDonorMatchesByPopupPriority(selected);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.matchId).toBe("m-crit");
    expect(ranked.map((m) => m.matchId)).not.toContain("m-done");
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
      "src/app/(donor)/donor/page.tsx",
      "src/components/forms/DonorMatchPopup.tsx",
    ];
    for (const relative of files) {
      const source = readFileSync(path.join(root, relative), "utf8");
      expect(source).not.toContain("notificationService");
      expect(source).not.toContain("notifyBatch");
    }
  });

  it("popup reuses existing Phase 5 accept/decline actions and a single dialog", () => {
    const popup = readFileSync(
      path.join(root, "src/components/forms/DonorMatchPopup.tsx"),
      "utf8"
    );
    const overlay = readFileSync(
      path.join(root, "src/components/forms/DonorPortalMatchOverlay.tsx"),
      "utf8"
    );
    const layout = readFileSync(path.join(root, "src/app/(donor)/layout.tsx"), "utf8");
    const dashboard = readFileSync(path.join(root, "src/app/(donor)/donor/page.tsx"), "utf8");
    const home = readFileSync(path.join(root, "src/app/page.tsx"), "utf8");

    expect(popup).toContain("acceptMatchAction");
    expect(popup).toContain("declineMatchAction");
    expect(popup).toContain("markOnTheWayAction");
    expect(popup).toContain('role="dialog"');
    expect(popup).toContain("Maybe later");
    expect(popup).not.toContain("accept_blood_request_match");

    // Global portal mount — not only the dashboard / "I want to donate" entry.
    expect(layout).toContain("DonorPortalMatchOverlay");
    expect(overlay).toContain("listMatchesForDonor");
    expect(overlay).toContain("selectActionableDonorMatches");
    expect(overlay).toContain("DonorMatchPopup");
    expect(dashboard).not.toContain("DonorMatchPopup");
    expect(dashboard).not.toContain("DonorPortalMatchOverlay");

    // Landing CTA is only a link into the portal; it must not gate the popup.
    expect(home).toContain("I want to donate");
    expect(home).toContain('href="/donor"');
    expect(home).not.toContain("DonorMatchPopup");
  });

  it("keeps /donor/requests inbox wired to DonorMatchActions", () => {
    const inbox = readFileSync(
      path.join(root, "src/app/(donor)/donor/requests/page.tsx"),
      "utf8"
    );
    expect(inbox).toContain("DonorMatchActions");
    expect(inbox).toContain("listMatchesForDonor");
  });

  it("mounts exactly one portal overlay from the donor layout shell", () => {
    const layout = readFileSync(path.join(root, "src/app/(donor)/layout.tsx"), "utf8");
    expect(layout).toContain('import { DonorPortalMatchOverlay }');
    expect(layout).toContain("<DonorPortalMatchOverlay userId={user.id} />");
    expect(layout.match(/<DonorPortalMatchOverlay/g)?.length).toBe(1);
    expect(layout).toContain('protectPage({ role: "DONOR" })');
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
    expect(source).toContain("requireAuth");
  });
});
