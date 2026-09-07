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

1. Requester submits the request-blood form → `bloodRequestService.create`.
2. `matchingService.matchDonors(request)` ranks compatible, eligible,
   available donors by distance and other factors (Phase 4).
3. `escalationService` decides how many donors to notify and at what
   radius (LEVEL 1: nearby → LEVEL 2: wider radius → LEVEL 3: blood
   banks/hospitals → LEVEL 4: admin) (Phase 7).
4. `notificationService` sends to the current batch through whichever
   channel is configured, recording each attempt (Phase 6).
5. A donor accepts/declines (`blood_request_matches.status`); the request
   status machine advances (`PENDING → MATCHING → DONOR_CONTACTED →
   DONOR_ACCEPTED → DONOR_ON_THE_WAY → COMPLETED`), or escalates further if
   nobody responds in time.

## Main entities

`profiles` (1) ─┬─(N) `user_roles`
                ├─(1) `donor_profiles` ─(1) `donor_availability`
                │                      └─(N) `donations`
                ├─(N) `blood_requests` ─(N) `blood_request_matches` ─(N) `donor_profiles`
                └─(N) `notifications`

`hospitals` / `blood_banks` each have `blood_inventory` rows (one per
blood group) and can be the target of a `blood_request`.

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
| `hospitalService` / `bloodBankService` | `hospitals` / `blood_banks`, `blood_inventory` | |
| `verificationService` | (business rules only) | Eligibility rules for admin's verification decisions |
| `adminService` | cross-cutting admin actions | Always writes an `audit_logs` row |
| `locationService` | geo math | Only module that knows PostGIS query shapes |
| `escalationService` | `emergency_events` | Pure state machine over levels 1–4 |

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

A pure state machine, deliberately decoupled from both notification
delivery and UI:

```
LEVEL 1  Nearby compatible donors        (small radius, all channels)
   │  no acceptance within timeout
   ▼
LEVEL 2  Wider donor radius              (expanded radius)
   │  no acceptance within timeout
   ▼
LEVEL 3  Blood banks / hospitals         (inventory-based)
   │  still unresolved
   ▼
LEVEL 4  Verified organizations / admin  (human intervention)
```

Each transition writes an `emergency_events` row so the full escalation
history of a request is auditable.

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
