# BloodConnect

Emergency blood donor coordination PWA. When someone urgently needs blood,
they can create a request and reach nearby, compatible, currently-available
donors as fast as possible — including at night.

This repo is being built in phases (see **Roadmap** below). This is
**Phase 0 — Foundation**: project scaffolding, database schema, types,
service interfaces, and route/page skeletons. Almost nothing is wired up to
real data yet — that's intentional.

## Tech stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS
- Supabase (Postgres, Auth, RLS, Storage, Realtime)
- PostGIS for geospatial queries
- Zod for validation
- Vitest for tests

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values below
npm run dev
```

## Environment variables

See `.env.example`. Two kinds:

- **Public** (`NEXT_PUBLIC_*`) — safe to ship to the browser.
- **Server-only** (e.g. `SUPABASE_SERVICE_ROLE_KEY`) — never imported from
  client components, never prefixed `NEXT_PUBLIC_`. The service-role key
  bypasses Row Level Security, so it only lives in `lib/supabase/server.ts`'s
  `createAdminClient()`, which throws if it's ever called in the browser.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the project URL and anon key into `.env.local`.
3. Enable the **PostGIS** extension: Database → Extensions → `postgis`.
4. Run the migration:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   (or paste `supabase/migrations/0001_init.sql` into the SQL editor).
5. Regenerate types once the schema is live:

   ```bash
   npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
   ```

## Development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Vitest watch mode |

## Architecture overview

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full picture. Short
version: UI components never talk to Supabase or contain business logic —
they call functions in `src/services/*`, which own their tables and are the
only place authorization, validation, and status transitions happen.

```
src/
  app/            routes, grouped by role: (public) (auth) (requester) (donor) (hospital) (blood-bank) (admin)
  components/     ui/ (badges, states) cards/ (list-item cards) forms/ (input widgets)
  services/       one file per domain (authService, donorService, matchingService, ...)
  schemas/        Zod validation, one file per domain
  types/          hand-written domain types (types/domain.ts) + generated DB types (types/database.ts)
  lib/            supabase clients, error hierarchy, constants, small utils
  hooks/          client-only React hooks (useAuth, useGeolocation)
  config/         site metadata, env var validation
supabase/
  migrations/     SQL schema, applied in order
tests/            a small set of representative unit tests
```

## How to add a feature

1. **Data**: add/alter a table in a new `supabase/migrations/000N_*.sql` file. Never edit a migration that's already been applied.
2. **Types**: regenerate `types/database.ts`; add/extend the matching interface in `types/domain.ts` if the shape the app should see differs from the raw table.
3. **Validation**: add a Zod schema in `schemas/`.
4. **Business logic**: implement it in the relevant `services/*.ts` file — never inside a component or page.
5. **UI**: build the page/component, calling the service (via a Server Action or Route Handler for mutations).
6. **Tests**: add a focused unit test for any new business rule (compatibility, matching, authorization).

## Security notes

- Row Level Security is enabled on every table; the anon/browser client can only see what a policy explicitly allows.
- Server-side role checks (`authService.requireRole`) are the real authorization boundary — client-side role checks are UX only, never trusted.
- A donor's exact coordinates are never sent to another user. Public-facing reads go through `donor_public_view` / `DonorPublicSummary`, which omit location entirely; only a computed distance is exposed.
- The service-role key never reaches the browser bundle (`createAdminClient` throws if called client-side).

## MVP roadmap

- [x] Phase 0 — Foundation / skeleton
- [ ] Phase 1 — Authentication
- [ ] Phase 2 — Donor profile
- [ ] Phase 3 — Blood request (requester flow)
- [ ] Phase 4 — Blood compatibility + nearby matching
- [ ] Phase 5 — Contact + donor response
- [ ] Phase 6 — Notifications
- [ ] Phase 7 — Emergency escalation
- [ ] Phase 8 — Hospital + blood bank
- [ ] Phase 9 — Admin
- [ ] Phase 10 — Production hardening
