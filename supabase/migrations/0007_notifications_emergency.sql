-- ============================================================================
-- BloodConnect — Phase 6 notifications + Emergency Response
-- ============================================================================
--  * blood_requests.is_emergency
--  * donor_availability emergency opt-in + radius
--  * notifications: IN_APP, kind, read_at, match_id
--  * find_emergency_response_candidates (service_role)
--  * accept_blood_request_match allows busy emergency donors
--  * Does not alter Phase 1–5 migrations in place; create or replace only.
--  * Phase 7 escalation / emergency_events intentionally untouched.
-- ============================================================================

-- ── Request emergency flag ───────────────────────────────────────────────────

alter table blood_requests
  add column if not exists is_emergency boolean not null default false;

-- ── Donor emergency settings (independent of is_available) ───────────────────

alter table donor_availability
  add column if not exists emergency_response_enabled boolean not null default false;

alter table donor_availability
  add column if not exists emergency_radius_km numeric not null default 10
    check (emergency_radius_km >= 5 and emergency_radius_km <= 50);

-- ── Notification kind + IN_APP channel ───────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type notification_kind as enum ('MATCH_NOTIFY', 'EMERGENCY_RESPONSE');
  end if;
end
$$;

alter type notification_channel add value if not exists 'IN_APP';

alter table notifications
  add column if not exists read_at timestamptz;

alter table notifications
  add column if not exists match_id uuid
    references blood_request_matches (id) on delete set null;

alter table notifications
  add column if not exists kind notification_kind;

create index if not exists idx_notifications_match
  on notifications (match_id);

create index if not exists idx_notifications_unread
  on notifications (recipient_id)
  where read_at is null;

-- One active notification per recipient + request + kind (idempotent notify).
create unique index if not exists idx_notifications_recipient_request_kind
  on notifications (recipient_id, blood_request_id, kind)
  where blood_request_id is not null and kind is not null;

-- Recipients mark read via SECURITY INVOKER RPC (only sets read_at).
create or replace function public.mark_own_notification_read(p_notification_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = auth.uid();

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.mark_own_notification_read(uuid) from public;
grant execute on function public.mark_own_notification_read(uuid) to authenticated;

-- ── Create request: accept is_emergency ──────────────────────────────────────
-- Drop prior signature so the new arity replaces it (CREATE OR REPLACE is
-- identity-sensitive on argument lists).

drop function if exists public.create_own_blood_request(
  blood_group, integer, request_urgency, double precision, double precision,
  text, text, uuid, text, timestamptz, text, timestamptz
);

create or replace function public.create_own_blood_request(
  p_blood_group blood_group,
  p_quantity_units integer,
  p_urgency request_urgency,
  p_lat double precision,
  p_lng double precision,
  p_contact_name text,
  p_contact_phone text,
  p_hospital_id uuid default null,
  p_hospital_name_freeform text default null,
  p_required_by timestamptz default null,
  p_notes text default null,
  p_expires_at timestamptz default null,
  p_is_emergency boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_lat is null or p_lng is null then
    raise exception 'Location is required';
  end if;

  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid coordinates';
  end if;

  if p_hospital_id is null
     and (p_hospital_name_freeform is null or length(trim(p_hospital_name_freeform)) = 0) then
    raise exception 'Hospital is required';
  end if;

  insert into blood_requests (
    requester_id,
    blood_group,
    quantity_units,
    urgency,
    required_by,
    hospital_id,
    hospital_name_freeform,
    location,
    contact_name,
    contact_phone,
    status,
    notes,
    expires_at,
    is_emergency
  ) values (
    auth.uid(),
    p_blood_group,
    p_quantity_units,
    p_urgency,
    p_required_by,
    p_hospital_id,
    nullif(trim(p_hospital_name_freeform), ''),
    extensions.ST_SetSRID(
      extensions.ST_MakePoint(p_lng, p_lat),
      4326
    )::extensions.geography,
    p_contact_name,
    p_contact_phone,
    'PENDING'::blood_request_status,
    nullif(trim(p_notes), ''),
    p_expires_at,
    coalesce(p_is_emergency, false)
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_own_blood_request(
  blood_group, integer, request_urgency, double precision, double precision,
  text, text, uuid, text, timestamptz, text, timestamptz, boolean
) from public;
grant execute on function public.create_own_blood_request(
  blood_group, integer, request_urgency, double precision, double precision,
  text, text, uuid, text, timestamptz, text, timestamptz, boolean
) to authenticated;

-- ── Emergency candidates (does NOT require is_available) ─────────────────────

create or replace function public.find_emergency_response_candidates(
  p_lat double precision,
  p_lng double precision,
  p_requester_id uuid,
  p_max_radius_meters double precision default 50000
)
returns table (
  donor_id uuid,
  user_id uuid,
  blood_group blood_group,
  is_eligible boolean,
  verification_status verification_status,
  is_available boolean,
  emergency_response_enabled boolean,
  emergency_radius_km numeric,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dp.id as donor_id,
    dp.user_id,
    dp.blood_group,
    dp.is_eligible,
    dp.verification_status,
    coalesce(da.is_available, false) as is_available,
    coalesce(da.emergency_response_enabled, false) as emergency_response_enabled,
    coalesce(da.emergency_radius_km, 10) as emergency_radius_km,
    extensions.ST_Distance(
      dp.location,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography
    ) as distance_meters
  from donor_profiles dp
  inner join donor_availability da on da.donor_id = dp.id
  where dp.location is not null
    and dp.is_eligible = true
    and dp.verification_status <> 'REJECTED'::verification_status
    and coalesce(da.emergency_response_enabled, false) = true
    and dp.user_id is distinct from p_requester_id
    and extensions.ST_DWithin(
      dp.location,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
      least(
        coalesce(da.emergency_radius_km, 10) * 1000,
        p_max_radius_meters
      )
    )
  order by distance_meters asc;
$$;

revoke all on function public.find_emergency_response_candidates(
  double precision, double precision, uuid, double precision
) from public;
revoke all on function public.find_emergency_response_candidates(
  double precision, double precision, uuid, double precision
) from anon;
revoke all on function public.find_emergency_response_candidates(
  double precision, double precision, uuid, double precision
) from authenticated;
grant execute on function public.find_emergency_response_candidates(
  double precision, double precision, uuid, double precision
) to service_role;

-- ── Accept: busy emergency donors may accept emergency requests ──────────────

create or replace function public.accept_blood_request_match(
  p_match_id uuid,
  p_donor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match blood_request_matches%rowtype;
  v_donor donor_profiles%rowtype;
  v_available boolean;
  v_emergency_opt_in boolean;
  v_request blood_requests%rowtype;
  v_request_id uuid;
  v_donor_id uuid;
begin
  if p_match_id is null or p_donor_user_id is null then
    raise exception 'BC_VALIDATION' using errcode = 'P0001';
  end if;

  select blood_request_id, donor_id
    into v_request_id, v_donor_id
  from blood_request_matches
  where id = p_match_id;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_request
  from blood_requests
  where id = v_request_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_request.status is distinct from 'MATCHING'::blood_request_status then
    raise exception 'BC_REQUEST_NOT_MATCHING' using errcode = 'P0004';
  end if;

  select * into v_donor
  from donor_profiles
  where id = v_donor_id
  for update;

  if not found or v_donor.user_id is distinct from p_donor_user_id then
    raise exception 'BC_UNAUTHORIZED' using errcode = 'P0003';
  end if;

  if not v_donor.is_eligible then
    raise exception 'BC_INELIGIBLE' using errcode = 'P0004';
  end if;

  select
    coalesce(da.is_available, false),
    coalesce(da.emergency_response_enabled, false)
  into v_available, v_emergency_opt_in
  from donor_availability da
  where da.donor_id = v_donor.id;

  if coalesce(v_available, false) is not true then
    -- Phase 6: emergency requests may be accepted by opted-in busy donors.
    if not (
      coalesce(v_request.is_emergency, false) = true
      and coalesce(v_emergency_opt_in, false) = true
    ) then
      raise exception 'BC_UNAVAILABLE' using errcode = 'P0004';
    end if;
  end if;

  select * into v_match
  from blood_request_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_match.status not in (
    'MATCHED'::donor_response_status,
    'NOTIFIED'::donor_response_status,
    'VIEWED'::donor_response_status
  ) then
    raise exception 'BC_MATCH_TERMINAL' using errcode = 'P0004';
  end if;

  update blood_request_matches
  set status = 'ACCEPTED'::donor_response_status,
      responded_at = now()
  where id = v_match.id;

  update blood_request_matches
  set status = 'EXPIRED'::donor_response_status
  where blood_request_id = v_match.blood_request_id
    and id is distinct from v_match.id
    and status in (
      'MATCHED'::donor_response_status,
      'NOTIFIED'::donor_response_status,
      'VIEWED'::donor_response_status
    );

  update blood_requests
  set status = 'DONOR_ACCEPTED'::blood_request_status,
      updated_at = now()
  where id = v_match.blood_request_id
    and status = 'MATCHING'::blood_request_status;

  if not found then
    raise exception 'BC_REQUEST_NOT_MATCHING' using errcode = 'P0004';
  end if;
end;
$$;
