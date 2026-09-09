import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { escalationService } from "@/services/escalationService";

/**
 * Cron-ready escalation processor (POST only).
 * Protect with CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret header).
 *
 * Wire later via Supabase cron, Vercel cron, or another trusted scheduler — never from the browser.
 */
function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
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

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
