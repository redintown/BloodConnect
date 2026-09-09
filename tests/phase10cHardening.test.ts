import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Phase 10C minimal hardening", () => {
  it("adds server-only to supabase server module", () => {
    expect(read("src/lib/supabase/server.ts")).toMatch(/^import "server-only";/m);
  });

  it("makes mark_own_notification_read SECURITY DEFINER (0016)", () => {
    const migration = read("supabase/migrations/0016_phase10c_final_hardening.sql");
    expect(migration).toContain("mark_own_notification_read");
    expect(migration).toContain("security definer");
    expect(migration).toContain("recipient_id = auth.uid()");
    expect(migration).not.toContain("security invoker");
  });

  it("wires expireOverdue into escalation cron batch", () => {
    const source = read("src/services/escalationService.ts");
    expect(source).toContain("expireOverdue");
    expect(source).toContain("processDueEscalations");
  });

  it("does not over-fetch contact phone for donor inbox", () => {
    const source = read("src/services/matchResponseService.ts");
    const start = source.indexOf("async listMatchesForDonor");
    const end = source.indexOf("async acceptMatch", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const inbox = source.slice(start, end);
    expect(inbox).not.toContain("contact_phone");
    expect(inbox).not.toContain("contact_name");
  });

  it("coarsens org escalation distances for client payloads", () => {
    const source = read("src/services/escalationService.ts");
    expect(source).toContain("toCoarseDistanceBandKm");
    expect(source).not.toContain("Math.round((distanceMeters / 1000) * 10) / 10");
  });

  it("anti-enumerates register duplicates via confirmation UX", () => {
    const auth = read("src/services/authService.ts");
    const actions = read("src/app/(auth)/actions.ts");
    expect(auth).toContain("isObfuscatedDuplicateSignUp");
    expect(auth).toContain("session: null");
    expect(actions).toContain('error.code === "CONFLICT"');
  });
});
