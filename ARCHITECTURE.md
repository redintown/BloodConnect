# Architecture

## System overview

BloodConnect is a Next.js App Router application backed by Supabase
(Postgres + Auth + RLS). There is no separate backend service in the
MVP — Server Components, Server Actions, and Route Handlers *are* the
backend, calling into a `services/` layer that owns all data access.

```
Browser (React, PWA)
   │  Server Actions / fetch
   ▼
Next.js Server (Server Components, Route Handlers)
   │  calls
   ▼
services/*  ──────────────►  Supabase (Postgres + RLS, Auth)
   (business logic,             (source of truth,
    authorization,                enforces RLS as a
    validation)                   second line of defense)
```

## Main data flow: an emergency request

1. Requester submits the request-blood form → `bloodRequestService.create`
   (optional explicit `is_emergency`).
2. **Phase 4** — `matchingService.runMatchingForRequest` ranks compatible,
   eligible, *available* donors (expanding radii). Persists `MATCHED` rows.
3. **Phase 6** — `matchNotifyService` + optional `emergencyResponseService`
   create IN_APP notifications. Emergency Response may reach busy opted-in
   donors; it does **not** change Phase 4 matching.
4. Donor YES/NO uses **Phase 5** `acceptMatch` / `declineMatch` (single-acceptor lock).
5. **Phase 7** — if the emergency request remains open without an ACCEPTED
   donor past the response window (or via Escalate Now),
   `escalationService` creates `emergency_events` at
   `BLOOD_BANKS_HOSPITALS`, notifies verified nearby orgs, then optionally
   `ADMIN_INTERVENTION`. Phase 7 does **not** re-run donor matching or expand
   donor radius.

## Phase boundaries

| Phase | Responsibility |
|-------|----------------|
| 4 | Normal donor matching (`compatibility` / `scoring` / `ranking`) |
| 5 | Donor accept / decline / on-the-way / donation completion |
| 6 | IN_APP notifications + Emergency Response donor opt-in |
| 7 | Hospital / blood-bank / admin escalation after donor paths stall |
| 8 | Full hospital/blood-bank product + inventory management |

## Main entities

`profiles` (1) ─┬─(N) `user_roles`
                ├─(1) `donor_profiles` ─(1) `donor_availability`
                │                      └─(N) `donations`
                ├─(N) `blood_requests` ─(N) `blood_request_matches` ─(N) `donor_profiles`
                ├─(N) `notifications`
                └─(N) `emergency_events` ─(N) `emergency_event_targets`
                      └─ targets `hospitals` / `blood_banks`

`hospitals` / `blood_banks` each have `blood_inventory` rows (one per
blood group, `units_available` only). Phase 8B owns atomic owner adjust +
audit. Phase 8A owns org profile + verification + owner RLS. Phase 7 only
needs verified orgs with `user_id` + location. Phase 8C shows inventory
hints in the org escalation inbox (exact own stock) and a safe
non-quantitative hint to requesters on CAN_SUPPLY. CAN_SUPPLY remains
intent-only (no decrement/reserve). Phase 8D public `/find-blood` searches
VERIFIED orgs with stock > 0 for an **exact** blood group via a safe
DEFINER RPC (no public table SELECT; no exact units or coordinates).
Donor matching remains a separate path.

A user can hold multiple roles simultaneously (a hospital admin who is
also a donor, for example) — role is never a single column on `profiles`.

## Service boundaries

Each file in `src/services/` owns exactly one set of tables and is the
only code allowed to query them directly:

| Service | Owns | Notes |
|---|---|---|
| `authService` | `auth.users`, `user_roles` | Only place `requireRole` lives |
| `donorService` | `donor_profiles`, `donor_availability` | Enforces the location-privacy rule |
| `bloodRequestService` | `blood_requests` | Owns status transitions |
| `matchingService` | (read-only across donors) | `isCompatible` + `matchDonors`; no DB writes |
| `notificationService` | `notifications` | One adapter per channel behind a common interface |
| `hospitalService` / `bloodBankService` | `hospitals` / `blood_banks` | Phase 8A: session-bound profile CRUD |
| `inventoryService` | `blood_inventory` (+ audit via RPC) | Phase 8B: owner atomic adjust; no public search |
| `bloodAvailabilityService` | public search via safe DEFINER RPC | Phase 8D: exact group, VERIFIED, stock > 0; no units/coords |
| `verificationService` | org verification rules + admin verify/reject | Org verification is Phase 8A; donor verification is Phase 9 |
| `adminService` | cross-cutting admin actions | Always writes an `audit_logs` row |
| `locationService` | geo math | Only module that knows PostGIS query shapes |
| `escalationService` | `emergency_events`, `emergency_event_targets` | Org/admin escalation after donor stall (Phase 7) |

Components never import from `lib/supabase/*` directly — only services and
Server Actions do. This is what lets a table move, get renamed, or split
without touching any UI code.

## Authentication flow

- `@supabase/ssr` manages the session via cookies.
- `src/middleware.ts` refreshes the session cookie on every request.
- `lib/supabase/server.ts#createClient` is used in Server Components/Actions
  (RLS-scoped to the current user).
- `lib/supabase/server.ts#createAdminClient` uses the service-role key and
  is reserved for trusted server-only flows (escalation jobs, admin
  verification). It throws immediately if `window` is defined.
- Role membership (`user_roles`) is the authorization source of truth.
  `authService.requireRole(role)` is called at the top of every
  privileged service method — never inferred from a client-supplied flag.

## Future matching-engine architecture (Phase 4+)

`matchingService.matchDonors(request)` will:

1. Filter donors by `isCompatible(donor.bloodGroup, request.bloodGroup)`.
2. Filter by `isEligible` and `verificationStatus`.
3. Query `donor_profiles` within an expanding radius via PostGIS
   (`ST_DWithin`), starting narrow and widening only if needed.
4. Score remaining candidates (distance, night-availability match, past
   response reliability) and return a ranked `DonorPublicSummary[]`.

The scoring function is intentionally isolated so it can move from a
simple weighted sum to something more sophisticated without changing its
call sites in `escalationService` or any UI.

## Notification architecture

`NotificationProvider` is a small interface (`channel`, `send(payload)`).
Concrete adapters (Web Push, SMS, Email, WhatsApp) implement it and are
selected by `notificationService` based on a donor's preferences/what's
configured — call sites never import a vendor SDK directly. Every send
attempt is recorded in `notifications` regardless of channel, so delivery
can be audited and retried.

## Emergency escalation architecture

Phase 7 is **organization escalation**, not another donor matching engine.

```
Emergency request (is_emergency)
   │
   ├─ Phase 4 normal matching (NEARBY_DONORS — historical concept)
   ├─ Phase 6 Emergency Response (WIDER_RADIUS — historical concept;
   │    implemented as emergency opt-in / radius, not radius re-match)
   │  no ACCEPTED donor within window / Escalate Now
   ▼
BLOOD_BANKS_HOSPITALS
   │  notify verified nearby hospitals & blood banks (IN_APP)
   │  org ACKNOWLEDGED / CAN_SUPPLY / CANNOT_HELP
   │  still unresolved after admin window
   ▼
ADMIN_INTERVENTION
```

`NEARBY_DONORS` and `WIDER_RADIUS` enum values are retained for audit/history
compatibility only — Phase 7 **must not** re-run donor matching for them.

Each org/admin transition writes an `emergency_events` row (plus
`emergency_event_targets` for per-org responses). At most one OPEN
`BLOOD_BANKS_HOSPITALS` / `ADMIN_INTERVENTION` event exists per request.

Automatic processing: `POST /api/cron/escalate` (Bearer / `x-cron-secret`
= `CRON_SECRET`) → `escalationService.processDueEscalations()`.

## Privacy / security principles

- **Data minimization**: donor exact coordinates and full contact details
  are stored, but only ever exposed to the donor themselves — other users
  see a rounded distance and, post-match, an explicit contact action.
- **RLS as a second line of defense**: every table has RLS enabled even
  though services also check authorization, so a bug in a service can't
  turn into a data leak.
- **No client-trusted authorization**: role and ownership checks always
  happen server-side against `user_roles` / row ownership, never a client
  flag.
- **Secrets stay server-side**: the service-role key is only reachable from
  `createAdminClient()`, which self-destructs if imported into a client
  bundle context.
- **Errors are typed and sanitized**: `AppError` ensures internal details
  (SQL errors, stack traces) never reach the client; only a safe
  `userMessage` does.
