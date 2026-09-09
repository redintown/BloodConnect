import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { escalationService } from "@/services/escalationService";

/**
 * Cron-ready escalation processor.
 * Auth: Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 *
 * Vercel Cron invokes this path on a schedule (see vercel.json) via GET with
 * Authorization: Bearer $CRON_SECRET when CRON_SECRET is configured.
 * External schedulers should prefer POST. Unauthenticated calls are rejected.
 */

/** Vercel / Next.js route segment config — ignored on platforms that don't support it. */
export const maxDuration = 60;

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function handleEscalationCron(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const provided = bearer || headerSecret;

  if (!provided || !secretsEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await escalationService.processDueEscalations();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/escalate]", error);
    return NextResponse.json({ error: "Escalation processing failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleEscalationCron(request);
}

/** Authenticated GET for Vercel Cron; same authorization as POST. */
export async function GET(request: NextRequest) {
  return handleEscalationCron(request);
}
