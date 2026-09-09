import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { NOTIFICATION_KINDS } from "@/lib/constants/verification";

const root = path.resolve(__dirname, "..");

describe("Pre-Phase-8 hardening", () => {
  it("freezes blood_requests content after PENDING (0009)", () => {
    const migration = readFileSync(
      path.join(root, "supabase/migrations/0009_hardening.sql"),
      "utf8"
    );
    expect(migration).toContain("Request content is frozen after PENDING");
    expect(migration).toContain("blood_requests_update_own");
    expect(migration).toMatch(/status in\s*\(\s*'PENDING'::blood_request_status/);
    expect(migration).toContain("CANCELLED");
    expect(migration).toContain("ESCALATION_REQUESTER_ORG_RESPONSE");
    expect(migration).toContain("ESCALATION_REQUESTER_ADMIN");
  });

  it("splits requester escalation notification kinds for multi-step alerts", () => {
    expect(NOTIFICATION_KINDS).toContain("ESCALATION_REQUESTER");
    expect(NOTIFICATION_KINDS).toContain("ESCALATION_REQUESTER_ORG_RESPONSE");
    expect(NOTIFICATION_KINDS).toContain("ESCALATION_REQUESTER_ADMIN");

    const source = readFileSync(path.join(root, "src/services/escalationService.ts"), "utf8");
    expect(source).toContain("ESCALATION_REQUESTER_ORG_RESPONSE");
    expect(source).toContain("ESCALATION_REQUESTER_ADMIN");
    expect(source).toMatch(/notifyRequester\([\s\S]*ESCALATION_REQUESTER_ORG_RESPONSE/);
    expect(source).toMatch(/notifyRequester\([\s\S]*ESCALATION_REQUESTER_ADMIN/);
  });

  it("auth-guards privileged escalation methods and binds org inbox to session", () => {
    const source = readFileSync(path.join(root, "src/services/escalationService.ts"), "utf8");
    expect(source).toContain("assertCanCloseEscalation");
    expect(source).toContain('await requireRole("ADMIN")');
    expect(source).toContain("options?.manual");
    expect(source).toContain("request.requester_id !== user.id");
    expect(source).toContain("listInboxForOrganization(organizationType)");
    expect(source).not.toContain("listInboxForOrganization(userId, organizationType)");
    expect(source).toContain("getOwnLinkedOrg()");
    expect(source).toContain("respondAsOrganization(targetId, response, notes)");
    expect(source).not.toContain("respondAsOrganization(targetId, userId, response, notes)");
  });

  it("hardens donationService.recordDonation with session ownership", () => {
    const source = readFileSync(path.join(root, "src/services/donationService.ts"), "utf8");
    expect(source).toContain("requireAuth");
    expect(source).toContain("isDonor");
    expect(source).toContain("isRequester");
    expect(source).toContain('throw AppError.unauthorized("Unauthorized")');
  });

  it("reconciles terminal escalations instead of silently leaving OPEN", () => {
    const escalation = readFileSync(path.join(root, "src/services/escalationService.ts"), "utf8");
    expect(escalation).toContain("reconcileTerminalEscalations");
    expect(escalation).toContain("reconciled");

    const matchResponse = readFileSync(
      path.join(root, "src/services/matchResponseService.ts"),
      "utf8"
    );
    expect(matchResponse).toContain("reconcileTerminalEscalations");

    const bloodRequest = readFileSync(
      path.join(root, "src/services/bloodRequestService.ts"),
      "utf8"
    );
    expect(bloodRequest).toContain("reconcileTerminalEscalations");
  });

  it("hardens cron CRON_SECRET with timing-safe compare and POST-only", () => {
    const route = readFileSync(path.join(root, "src/app/api/cron/escalate/route.ts"), "utf8");
    expect(route).toContain("timingSafeEqual");
    expect(route).toContain("CRON_SECRET");
    expect(route).toContain("Method Not Allowed");
    expect(route).toContain("405");
    expect(route).not.toContain("return POST(request)");

    const envExample = readFileSync(path.join(root, ".env.example"), "utf8");
    expect(envExample).toContain("CRON_SECRET=");
  });

  it("routes org name/own-org reads through hospital/bloodBank services", () => {
    const escalation = readFileSync(path.join(root, "src/services/escalationService.ts"), "utf8");
    expect(escalation).toContain('from "@/services/hospitalService"');
    expect(escalation).toContain('from "@/services/bloodBankService"');
    expect(escalation).toContain("hospitalService.getNamesByIds");
    expect(escalation).toContain("bloodBankService.getNamesByIds");
    expect(escalation).not.toContain('.from("hospitals")');
    expect(escalation).not.toContain('.from("blood_banks")');

    const hospital = readFileSync(path.join(root, "src/services/hospitalService.ts"), "utf8");
    const bloodBank = readFileSync(path.join(root, "src/services/bloodBankService.ts"), "utf8");
    expect(hospital).toContain("getOwnLinkedOrg");
    expect(hospital).toContain("getNamesByIds");
    expect(bloodBank).toContain("getOwnLinkedOrg");
    expect(bloodBank).toContain("getNamesByIds");
  });

  it("binds assignInitialRole admin fallback to the session user", () => {
    const source = readFileSync(path.join(root, "src/services/authService.ts"), "utf8");
    expect(source).toContain("session.id !== userId");
    expect(source).toContain("tryAdminInsertRole");
  });
});
