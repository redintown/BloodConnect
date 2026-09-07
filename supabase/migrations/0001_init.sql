-- ============================================================================
-- BloodConnect — Phase 0 initial schema
-- ============================================================================
-- Design notes:
--  * UUID PKs throughout (uuid-ossp / pgcrypto's gen_random_uuid()).
--  * A user can hold multiple roles (user_roles join table), never a single
--    `role` column on profiles — the product brief explicitly requires this.
--  * Donor exact coordinates are never stored in a publicly-readable column.
--    donor_profiles stores precise lat/lng but RLS restricts SELECT to the
--    owning donor; matching/public surfaces should read from
--    donor_public_view (rounded distance only) — created at the bottom.
--  * PostGIS is used for geospatial queries. Enable it in the Supabase
--    dashboard (Database > Extensions) if this fails in a fresh project.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "postgis";

-- ── ENUMS ───────────────────────────────────────────────────────────────────

create type app_role as enum ('REQUESTER', 'DONOR', 'HOSPITAL', 'BLOOD_BANK', 'ADMIN');

create type blood_group as enum (
  'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'
);

create type request_urgency as enum ('CRITICAL', 'HIGH', 'MODERATE');

create type blood_request_status as enum (
  'PENDING', 'MATCHING', 'DONOR_CONTACTED', 'DONOR_ACCEPTED',
  'DONOR_ON_THE_WAY', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_MATCH_FOUND'
);

create type donor_response_status as enum (
  'NOTIFIED', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED'
);

create type verification_status as enum ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

create type notification_channel as enum ('WEB_PUSH', 'SMS', 'EMAIL', 'WHATSAPP');

create type notification_status as enum ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

create type escalation_level as enum (
  'NEARBY_DONORS', 'WIDER_RADIUS', 'BLOOD_BANKS_HOSPITALS', 'ADMIN_INTERVENTION'
);

-- ── PROFILES & ROLES ────────────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index idx_user_roles_user_id on user_roles (user_id);

-- ── DONOR ───────────────────────────────────────────────────────────────────

create table donor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles (id) on delete cascade,
  blood_group blood_group not null,
  last_donation_date date,
  is_eligible boolean not null default true,
  verification_status verification_status not null default 'UNVERIFIED',
  -- Precise location. Never exposed directly to other users — see
  -- donor_public_view below. Nullable until the donor grants permission.
  location geography(Point, 4326),
  location_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_donor_profiles_blood_group on donor_profiles (blood_group);
create index idx_donor_profiles_location on donor_profiles using gist (location);

create table donor_availability (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null unique references donor_profiles (id) on delete cascade,
  is_available boolean not null default false,
  is_available_at_night boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── HOSPITAL / BLOOD BANK ────────────────────────────────────────────────────

create table hospitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  name text not null,
  phone text not null,
  address text not null,
  location geography(Point, 4326),
  has_24h_emergency boolean not null default false,
  verification_status verification_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table blood_banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  name text not null,
  phone text not null,
  address text not null,
  location geography(Point, 4326),
  emergency_hours text,
  verification_status verification_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table blood_inventory (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one of these two owners is set (enforced in app layer / check
  -- constraint below) — inventory belongs to either a hospital or a bank.
  hospital_id uuid references hospitals (id) on delete cascade,
  blood_bank_id uuid references blood_banks (id) on delete cascade,
  blood_group blood_group not null,
  units_available integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint blood_inventory_single_owner check (
    (hospital_id is not null and blood_bank_id is null) or
    (hospital_id is null and blood_bank_id is not null)
  )
);

create unique index idx_blood_inventory_hospital_group
  on blood_inventory (hospital_id, blood_group) where hospital_id is not null;
create unique index idx_blood_inventory_bank_group
  on blood_inventory (blood_bank_id, blood_group) where blood_bank_id is not null;

-- ── BLOOD REQUESTS ───────────────────────────────────────────────────────────

create table blood_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles (id) on delete cascade,
  blood_group blood_group not null,
  quantity_units integer not null check (quantity_units > 0),
  urgency request_urgency not null,
  required_by timestamptz,
  hospital_id uuid references hospitals (id) on delete set null,
  hospital_name_freeform text,
  location geography(Point, 4326) not null,
  contact_name text not null,
  contact_phone text not null,
  status blood_request_status not null default 'PENDING',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create index idx_blood_requests_status on blood_requests (status);
create index idx_blood_requests_blood_group on blood_requests (blood_group);
create index idx_blood_requests_location on blood_requests using gist (location);
create index idx_blood_requests_requester on blood_requests (requester_id);

create table blood_request_matches (
  id uuid primary key default gen_random_uuid(),
  blood_request_id uuid not null references blood_requests (id) on delete cascade,
  donor_id uuid not null references donor_profiles (id) on delete cascade,
  score numeric,
  distance_meters numeric,
  status donor_response_status not null default 'NOTIFIED',
  notified_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (blood_request_id, donor_id)
);

create index idx_matches_request on blood_request_matches (blood_request_id);
create index idx_matches_donor on blood_request_matches (donor_id);

-- donations references both donor_profiles and blood_requests, so it is
-- declared after both exist.
create table donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references donor_profiles (id) on delete cascade,
  blood_request_id uuid references blood_requests (id) on delete set null,
  donated_at timestamptz not null default now(),
  quantity_ml integer,
  notes text
);

create index idx_donations_donor on donations (donor_id);

-- ── NOTIFICATIONS ────────────────────────────────────────────────────────────

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  blood_request_id uuid references blood_requests (id) on delete set null,
  channel notification_channel not null,
  status notification_status not null default 'QUEUED',
  payload jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_recipient on notifications (recipient_id);

-- ── EMERGENCY ESCALATION ─────────────────────────────────────────────────────

create table emergency_events (
  id uuid primary key default gen_random_uuid(),
  blood_request_id uuid not null references blood_requests (id) on delete cascade,
  level escalation_level not null,
  triggered_at timestamptz not null default now(),
  notes text
);

create index idx_emergency_events_request on emergency_events (blood_request_id);

-- ── ADMIN / TRUST & SAFETY ───────────────────────────────────────────────────

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles (id) on delete set null,
  reported_user_id uuid references profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'OPEN',
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_actor on audit_logs (actor_id);
create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);

-- ============================================================================
-- ROW LEVEL SECURITY — baseline policies only.
-- Fine-grained field masking (e.g. hiding a donor's exact location from a
-- requester who has matched with them) is enforced via donor_public_view
-- below, not raw table grants. Advanced policies (rate limiting, admin
-- overrides audited per-action) are deferred to Phase 10 hardening.
-- ============================================================================

alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table donor_profiles enable row level security;
alter table donor_availability enable row level security;
alter table donations enable row level security;
alter table hospitals enable row level security;
alter table blood_banks enable row level security;
alter table blood_inventory enable row level security;
alter table blood_requests enable row level security;
alter table blood_request_matches enable row level security;
alter table notifications enable row level security;
alter table emergency_events enable row level security;
alter table reports enable row level security;
alter table audit_logs enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

create policy "user_roles_select_own" on user_roles for select using (auth.uid() = user_id);

create policy "donor_profiles_select_own" on donor_profiles for select using (auth.uid() = user_id);
create policy "donor_profiles_upsert_own" on donor_profiles for insert with check (auth.uid() = user_id);
create policy "donor_profiles_update_own" on donor_profiles for update using (auth.uid() = user_id);

create policy "donor_availability_owner" on donor_availability for all using (
  exists (select 1 from donor_profiles dp where dp.id = donor_id and dp.user_id = auth.uid())
);

create policy "blood_requests_select_own" on blood_requests for select using (auth.uid() = requester_id);
create policy "blood_requests_insert_own" on blood_requests for insert with check (auth.uid() = requester_id);
create policy "blood_requests_update_own" on blood_requests for update using (auth.uid() = requester_id);

create policy "matches_select_participant" on blood_request_matches for select using (
  exists (select 1 from blood_requests br where br.id = blood_request_id and br.requester_id = auth.uid())
  or exists (select 1 from donor_profiles dp where dp.id = donor_id and dp.user_id = auth.uid())
);

create policy "notifications_select_own" on notifications for select using (auth.uid() = recipient_id);

create policy "hospitals_select_public" on hospitals for select using (verification_status = 'VERIFIED');
create policy "blood_banks_select_public" on blood_banks for select using (verification_status = 'VERIFIED');

create policy "reports_select_own" on reports for select using (auth.uid() = reporter_id);
create policy "reports_insert_own" on reports for insert with check (auth.uid() = reporter_id);

-- Admin bypass: server code using the service-role key skips RLS entirely,
-- so no ADMIN-specific policies are required here for Phase 0. Admin UI
-- routes must go through server-side services, never direct client queries.

-- ============================================================================
-- PUBLIC-SAFE VIEW — never leaks a donor's exact coordinates.
-- Distance is computed server-side per-request (see locationService) and
-- attached separately; this view intentionally omits `location`.
-- ============================================================================

create view donor_public_view as
  select
    dp.id,
    dp.blood_group,
    dp.is_eligible,
    dp.verification_status,
    da.is_available,
    da.is_available_at_night
  from donor_profiles dp
  left join donor_availability da on da.donor_id = dp.id;
