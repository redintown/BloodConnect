-- ============================================================================
-- BloodConnect — Phase 5 donor response & donation confirmation
-- ============================================================================
--  * Adds blood_request_match_id to donations + unique (donor, request) guard.
--  * Atomic SECURITY DEFINER RPCs for accept (single-acceptor lock), decline,
--    on-the-way, and requester donation confirmation.
--  * No authenticated INSERT on donations; Phase 6 owns notify delivery.
--  * Does not alter Phase 1–4 auth/donor/request/matching migrations.
-- ============================================================================

-- Link Phase 5 donations to the accepted match row.
alter table donations
  add column if not exists blood_request_match_id uuid
    references blood_request_matches (id) on delete set null;

create index if not exists idx_donations_match
  on donations (blood_request_match_id);

-- One donation per donor per blood request (when request is present).
create unique index if not exists idx_donations_donor_request_unique
  on donations (donor_id, blood_request_id)
  where blood_request_id is not null;

-- ── Accept: single-acceptor lock ─────────────────────────────────────────────

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
  v_request blood_requests%rowtype;
  v_request_id uuid;
  v_donor_id uuid;
begin
  if p_match_id is null or p_donor_user_id is null then
    raise exception 'BC_VALIDATION' using errcode = 'P0001';
  end if;

  -- Resolve request id without row locks first so we can lock the request
  -- before any match rows (avoids deadlock between concurrent acceptors).
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

  select coalesce(da.is_available, false) into v_available
  from donor_availability da
  where da.donor_id = v_donor.id;

  if coalesce(v_available, false) is not true then
    raise exception 'BC_UNAVAILABLE' using errcode = 'P0004';
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

-- ── Decline ──────────────────────────────────────────────────────────────────

create or replace function public.decline_blood_request_match(
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
  v_request blood_requests%rowtype;
begin
  if p_match_id is null or p_donor_user_id is null then
    raise exception 'BC_VALIDATION' using errcode = 'P0001';
  end if;

  select * into v_match
  from blood_request_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_donor
  from donor_profiles
  where id = v_match.donor_id;

  if not found or v_donor.user_id is distinct from p_donor_user_id then
    raise exception 'BC_UNAUTHORIZED' using errcode = 'P0003';
  end if;

  if v_match.status not in (
    'MATCHED'::donor_response_status,
    'NOTIFIED'::donor_response_status,
    'VIEWED'::donor_response_status
  ) then
    raise exception 'BC_MATCH_TERMINAL' using errcode = 'P0004';
  end if;

  select * into v_request
  from blood_requests
  where id = v_match.blood_request_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_request.status is distinct from 'MATCHING'::blood_request_status then
    raise exception 'BC_REQUEST_NOT_MATCHING' using errcode = 'P0004';
  end if;

  update blood_request_matches
  set status = 'DECLINED'::donor_response_status,
      responded_at = now()
  where id = v_match.id;
end;
$$;

-- ── On the way ───────────────────────────────────────────────────────────────

create or replace function public.mark_donor_on_the_way(
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
  v_request blood_requests%rowtype;
begin
  if p_match_id is null or p_donor_user_id is null then
    raise exception 'BC_VALIDATION' using errcode = 'P0001';
  end if;

  select * into v_match
  from blood_request_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_donor
  from donor_profiles
  where id = v_match.donor_id;

  if not found or v_donor.user_id is distinct from p_donor_user_id then
    raise exception 'BC_UNAUTHORIZED' using errcode = 'P0003';
  end if;

  if v_match.status is distinct from 'ACCEPTED'::donor_response_status then
    raise exception 'BC_MATCH_NOT_ACCEPTED' using errcode = 'P0004';
  end if;

  select * into v_request
  from blood_requests
  where id = v_match.blood_request_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_request.status is distinct from 'DONOR_ACCEPTED'::blood_request_status then
    raise exception 'BC_INVALID_STATUS' using errcode = 'P0004';
  end if;

  update blood_requests
  set status = 'DONOR_ON_THE_WAY'::blood_request_status,
      updated_at = now()
  where id = v_request.id
    and status = 'DONOR_ACCEPTED'::blood_request_status;

  if not found then
    raise exception 'BC_INVALID_STATUS' using errcode = 'P0004';
  end if;
end;
$$;

-- ── Confirm donation received (requester) ────────────────────────────────────

create or replace function public.confirm_donation_received(
  p_request_id uuid,
  p_requester_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request blood_requests%rowtype;
  v_match blood_request_matches%rowtype;
  v_donation_id uuid;
  v_quantity_ml integer;
begin
  if p_request_id is null or p_requester_id is null then
    raise exception 'BC_VALIDATION' using errcode = 'P0001';
  end if;

  select * into v_request
  from blood_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_request.requester_id is distinct from p_requester_id then
    raise exception 'BC_UNAUTHORIZED' using errcode = 'P0003';
  end if;

  if v_request.status is distinct from 'DONOR_ON_THE_WAY'::blood_request_status then
    raise exception 'BC_INVALID_STATUS' using errcode = 'P0004';
  end if;

  select * into v_match
  from blood_request_matches
  where blood_request_id = v_request.id
    and status = 'ACCEPTED'::donor_response_status
  for update;

  if not found then
    raise exception 'BC_NO_ACCEPTED_MATCH' using errcode = 'P0004';
  end if;

  -- Guard against a second ACCEPTED row (should be impossible after Phase 5 lock).
  if (
    select count(*) from blood_request_matches
    where blood_request_id = v_request.id
      and status = 'ACCEPTED'::donor_response_status
  ) <> 1 then
    raise exception 'BC_NO_ACCEPTED_MATCH' using errcode = 'P0004';
  end if;

  if exists (
    select 1 from donations
    where donor_id = v_match.donor_id
      and blood_request_id = v_request.id
  ) then
    raise exception 'BC_DUPLICATE_DONATION' using errcode = 'P0004';
  end if;

  v_quantity_ml := v_request.quantity_units * 450;

  insert into donations (
    donor_id,
    blood_request_id,
    blood_request_match_id,
    donated_at,
    quantity_ml,
    notes
  ) values (
    v_match.donor_id,
    v_request.id,
    v_match.id,
    now(),
    v_quantity_ml,
    null
  )
  returning id into v_donation_id;

  update donor_profiles
  set last_donation_date = (now() at time zone 'utc')::date,
      updated_at = now()
  where id = v_match.donor_id;
  -- is_eligible is derived by donor_profiles_before_write (Phase 2 trigger).

  update blood_requests
  set status = 'COMPLETED'::blood_request_status,
      updated_at = now()
  where id = v_request.id
    and status = 'DONOR_ON_THE_WAY'::blood_request_status;

  if not found then
    raise exception 'BC_INVALID_STATUS' using errcode = 'P0004';
  end if;

  return v_donation_id;
end;
$$;

revoke all on function public.accept_blood_request_match(uuid, uuid) from public;
revoke all on function public.accept_blood_request_match(uuid, uuid) from anon;
revoke all on function public.accept_blood_request_match(uuid, uuid) from authenticated;

revoke all on function public.decline_blood_request_match(uuid, uuid) from public;
revoke all on function public.decline_blood_request_match(uuid, uuid) from anon;
revoke all on function public.decline_blood_request_match(uuid, uuid) from authenticated;

revoke all on function public.mark_donor_on_the_way(uuid, uuid) from public;
revoke all on function public.mark_donor_on_the_way(uuid, uuid) from anon;
revoke all on function public.mark_donor_on_the_way(uuid, uuid) from authenticated;

revoke all on function public.confirm_donation_received(uuid, uuid) from public;
revoke all on function public.confirm_donation_received(uuid, uuid) from anon;
revoke all on function public.confirm_donation_received(uuid, uuid) from authenticated;

grant execute on function public.accept_blood_request_match(uuid, uuid) to service_role;
grant execute on function public.decline_blood_request_match(uuid, uuid) to service_role;
grant execute on function public.mark_donor_on_the_way(uuid, uuid) to service_role;
grant execute on function public.confirm_donation_received(uuid, uuid) to service_role;
