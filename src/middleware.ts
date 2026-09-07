import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route protection is enforced server-side inside each route's own code
 * (authService.requireRole), not by pattern-matching paths here — that
 * would silently drift out of sync as routes are added. This middleware's
 * only job is keeping the Supabase session cookie fresh.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
