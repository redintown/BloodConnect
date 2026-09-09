import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { getSiteUrl } from "@/config/site";
import { isCompatible } from "@/lib/matching/compatibility";
import { mapDonorResponseRpcError } from "@/lib/matches/responseRules";
import {
  canPersistMatchesForRequestStatus,
  canRefreshMatchRow,
} from "@/lib/matching/ranking";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 10B P10B-01 accept-time compatibility", () => {
  const migration = read("supabase/migrations/0015_phase10b_database_hardening.sql");

  it("defines is_whole_blood_compatible matching app matrix semantics", () => {
    expect(migration).toContain("is_whole_blood_compatible");
    expect(migration).toContain("BC_INCOMPATIBLE");
    expect(migration).toContain("accept_blood_request_match");
    // Spot-check matrix branches exist in SQL
    expect(migration).toContain("when 'O_NEG'");
    expect(migration).toContain("when 'AB_POS'");
    expect(isCompatible("O_NEG", "AB_POS")).toBe(true);
    expect(isCompatible("A_POS", "O_NEG")).toBe(false);
  });

  it("maps BC_INCOMPATIBLE for donors and preserves emergency accept path in RPC body", () => {
    expect(mapDonorResponseRpcError({ message: "BC_INCOMPATIBLE" }).userMessage).toContain(
      "not compatible"
    );
    expect(migration).toContain("emergency_response_enabled");
    expect(migration).toContain("is_emergency");
  });
});

describe("Phase 10B P10B-02 / P10B-03 matching persistence", () => {
  it("does not revive EXPIRED and skips terminal request statuses", () => {
    expect(canRefreshMatchRow("EXPIRED")).toBe(false);
    expect(canPersistMatchesForRequestStatus("DONOR_ACCEPTED")).toBe(false);
    expect(canPersistMatchesForRequestStatus("MATCHING")).toBe(true);
  });

  it("matchingService handles 23505 and terminal guard", () => {
    const source = read("src/services/matchingService.ts");
    expect(source).toContain("isUniqueViolation");
    expect(source).toContain("canPersistMatchesForRequestStatus");
    expect(source).toContain("BC_REQUEST_TERMINAL");
    expect(source).toContain('in("status", ["MATCHED", "NOTIFIED", "VIEWED"])');
  });

  it("migration trigger blocks open matches on terminal requests", () => {
    const migration = read("supabase/migrations/0015_phase10b_database_hardening.sql");
    expect(migration).toContain("blood_request_matches_guard_open_on_terminal");
    expect(migration).toContain("BC_REQUEST_TERMINAL");
  });
});

describe("Phase 10B P10B-04 one ACCEPTED", () => {
  it("creates partial unique index with precondition failure (no silent data fix)", () => {
    const migration = read("supabase/migrations/0015_phase10b_database_hardening.sql");
    expect(migration).toContain("idx_blood_request_matches_one_accepted");
    expect(migration).toContain("P10B-04 precondition failed");
    expect(migration).not.toMatch(/delete from blood_request_matches/i);
  });
});

describe("Phase 10B P10B-05 donor_public_view", () => {
  it("sets security_invoker and revokes public/anon/authenticated", () => {
    const migration = read("supabase/migrations/0015_phase10b_database_hardening.sql");
    expect(migration).toContain("security_invoker = true");
    expect(migration).toContain("revoke all on public.donor_public_view from anon");
    expect(migration).toContain("revoke all on public.donor_public_view from authenticated");
  });
});

describe("Phase 10B P10B-09 / P10B-10 indexes", () => {
  it("adds expires_at expirable partial index and documents donations index deferral", () => {
    const migration = read("supabase/migrations/0015_phase10b_database_hardening.sql");
    expect(migration).toContain("idx_blood_requests_expires_at_expirable");
    expect(migration).toContain("P10B-10");
    expect(migration).toContain("DEFERRED");
    expect(migration).not.toContain("idx_donations_blood_request_id");
  });
});

describe("Phase 10B P10B-11 / P10B-12 / P10B-13 production config", () => {
  it("wires vercel cron every 5 minutes", () => {
    const vercel = read("vercel.json");
    expect(vercel).toContain("/api/cron/escalate");
    expect(vercel).toContain("*/5 * * * *");
  });

  it("isolates per-request cron failures and sets maxDuration", () => {
    const escalation = read("src/services/escalationService.ts");
    const route = read("src/app/api/cron/escalate/route.ts");
    expect(escalation).toContain("failed += 1");
    expect(escalation).toContain("processDueEscalations item failed");
    expect(route).toContain("maxDuration");
    expect(route).toContain("handleEscalationCron");
  });

  it("rejects localhost SITE_URL when production env flags are set", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevVercel = process.env.VERCEL_ENV;
    const prevBc = process.env.BLOODCONNECT_ENV;
    try {
      process.env.VERCEL_ENV = "production";
      delete process.env.BLOODCONNECT_ENV;
      process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
      expect(() => getSiteUrl()).toThrow(/must not be localhost/i);

      process.env.NEXT_PUBLIC_SITE_URL = "https://bloodconnect.example";
      expect(getSiteUrl()).toBe("https://bloodconnect.example");
    } finally {
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
      if (prevVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercel;
      if (prevBc === undefined) delete process.env.BLOODCONNECT_ENV;
      else process.env.BLOODCONNECT_ENV = prevBc;
    }
  });

  it("allows localhost default outside production enforcement", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevVercel = process.env.VERCEL_ENV;
    const prevBc = process.env.BLOODCONNECT_ENV;
    try {
      delete process.env.VERCEL_ENV;
      delete process.env.BLOODCONNECT_ENV;
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(getSiteUrl()).toBe("http://localhost:3000");
    } finally {
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
      if (prevVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercel;
      if (prevBc === undefined) delete process.env.BLOODCONNECT_ENV;
      else process.env.BLOODCONNECT_ENV = prevBc;
    }
  });
});
