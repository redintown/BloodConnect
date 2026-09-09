# Phase 10B database integration tests

These tests exercise **live Supabase / Postgres** behavior. They are **not** part of
the default `npm test` unit suite and are **skipped** unless explicitly enabled.

## Prerequisites

1. Apply migrations through **0015** to a disposable project (recommended) or a
   dedicated staging database. Do **not** point this suite at production data.
2. Set environment variables (never commit secrets):

```bash
RUN_DB_INTEGRATION=1
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Optional helpers for dual-accept / inventory scenarios (seeded fixtures):

```bash
# Prefer creating fixtures in SQL Editor, then pass IDs:
BC_IT_REQUEST_ID=
BC_IT_MATCH_A_ID=
BC_IT_MATCH_B_ID=
BC_IT_DONOR_USER_A=
BC_IT_DONOR_USER_B=
BC_IT_INVENTORY_OWNER_JWT=
```

Without fixture IDs, the suite still runs grant/RPC denial checks that need only
anon + service-role keys.

## Run

```bash
npm run test:integration
```

## Coverage (when fixtures present)

1. `user_roles` authenticated INSERT denied
2. anon EXECUTE on `search_public_blood_availability` denied
3. Dual `accept_blood_request_match` → one winner
4. Inventory cannot go below zero (`adjust_own_inventory`)
5. Duplicate donation completion prevented
6. One ACCEPTED match per request (unique index)
7. Accept after incompatible blood-group change → `BC_INCOMPATIBLE`

## Status

- **Code verified:** unit/source tests in `tests/*.test.ts`
- **Local/live DB verified:** only when this suite is run against a migrated DB
- **Production live DB:** not claimed until migration 0015 is applied there
