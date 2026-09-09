-- ============================================================================
-- BloodConnect — Phase 10B: Database + Production Hardening
-- ============================================================================
-- Additive only. Does NOT modify 0001–0014 migration files.
--
-- P10B-01: accept-time whole-blood compatibility re-check
-- P10B-02: guard open match writes on terminal requests
-- P10B-04: one ACCEPTED match per request (partial unique)
-- P10B-05: donor_public_view security_invoker + revoke public access
-- P10B-09: expires_at partial index for expireOverdue
--
-- P10B-10: donations(blood_request_id) bare index — DEFERRED.
--   Current lookups use (donor_id, blood_request_id) which is already covered by
--   idx_donations_donor_request_unique (0006). No service/RPC queries bare
--   blood_request_id alone.
-- ============================================================================

-- ── P10B-01: whole-blood compatibility (donor → recipient) ───────────────────
-- Exact semantics of src/lib/matching/compatibility.ts (do not diverge).

create or replace function public.is_whole_blood_compatible(
  p_donor blood_group,
  p_recipient blood_group
)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select case p_recipient
    when 'O_NEG'::blood_group then p_donor = 'O_NEG'::blood_group
    when 'O_POS'::blood_group then p_donor in (
      'O_NEG'::blood_group, 'O_POS'::blood_group
    )
    when 'A_NEG'::blood_group then p_donor in (
      'O_NEG'::blood_group, 'A_NEG'::blood_group
    )
    when 'A_POS'::blood_group then p_donor in (
      'O_NEG'::blood_group, 'O_POS'::blood_group,
      'A_NEG'::blood_group, 'A_POS'::blood_group
    )
    when 'B_NEG'::blood_group then p_donor in (
      'O_NEG'::blood_group, 'B_NEG'::blood_group
    )
    when 'B_POS'::blood_group then p_donor in (
      'O_NEG'::blood_group, 'O_POS'::blood_group,
      'B_NEG'::blood_group, 'B_POS'::blood_group
    )
    when 'AB_NEG'::blood_group then p_donor in (
      'O_NEG'::blood_group, 'A_NEG'::blood_group,
      'B_NEG'::blood_group, 'AB_NEG'::blood_group
    )
    when 'AB_POS'::blood_group then true
    else false
  end;
$$;

revoke all on function public.is_whole_blood_compatible(blood_group, blood_group) from public;
grant execute on function public.is_whole_blood_compatible(blood_group, blood_group)
  to authenticated, service_role;

-- Replace accept RPC: preserve locks/transitions; add compatibility check.
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

  -- Phase 10B: re-check compatibility at accept (donor may have changed blood_group).
  if not public.is_whole_blood_compatible(v_donor.blood_group, v_request.blood_group) then
    raise exception 'BC_INCOMPATIBLE' using errcode = 'P0004';
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

revoke all on function public.accept_blood_request_match(uuid, uuid) from public;
revoke all on function public.accept_blood_request_match(uuid, uuid) from anon;
revoke all on function public.accept_blood_request_match(uuid, uuid) from authenticated;
grant execute on function public.accept_blood_request_match(uuid, uuid) to service_role;

-- ── P10B-02: refuse open match writes when request is terminal ───────────────
-- Closes the accept ∩ matching race without redesigning matching transactions.

create or replace function public.blood_request_matches_guard_open_on_terminal()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status blood_request_status;
begin
  if new.status in (
    'MATCHED'::donor_response_status,
    'NOTIFIED'::donor_response_status,
    'VIEWED'::donor_response_status
  ) then
    select status into v_status
    from blood_requests
    where id = new.blood_request_id;

    if not found then
      raise exception 'BC_NOT_FOUND: blood request' using errcode = 'P0002';
    end if;

    if v_status not in (
      'PENDING'::blood_request_status,
      'MATCHING'::blood_request_status,
      'NO_MATCH_FOUND'::blood_request_status
    ) then
      raise exception 'BC_REQUEST_TERMINAL: cannot open matches on terminal request'
        using errcode = 'P0004';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists blood_request_matches_guard_open_on_terminal
  on blood_request_matches;
create trigger blood_request_matches_guard_open_on_terminal
  before insert or update on blood_request_matches
  for each row execute function public.blood_request_matches_guard_open_on_terminal();

-- ── P10B-04: one ACCEPTED match per request ──────────────────────────────────
-- Fail clearly if existing data already violates the invariant.
-- Does NOT delete or alter ACCEPTED rows.

do $$
declare
  v_conflict_request_id uuid;
  v_conflict_count bigint;
begin
  select blood_request_id, count(*)
    into v_conflict_request_id, v_conflict_count
  from blood_request_matches
  where status = 'ACCEPTED'::donor_response_status
  group by blood_request_id
  having count(*) > 1
  order by count(*) desc
  limit 1;

  if v_conflict_request_id is not null then
    raise exception
      'P10B-04 precondition failed: blood_request_id=% has % ACCEPTED matches. Resolve manually before creating idx_blood_request_matches_one_accepted.',
      v_conflict_request_id, v_conflict_count;
  end if;
end;
$$;

create unique index if not exists idx_blood_request_matches_one_accepted
  on blood_request_matches (blood_request_id)
  where status = 'ACCEPTED'::donor_response_status;

-- ── P10B-05: donor_public_view hygiene ───────────────────────────────────────
-- View is unused by application code (DonorPublicSummary DTOs are used instead).
-- Keep the view for schema continuity, but force invoker rights and revoke access.

alter view public.donor_public_view set (security_invoker = true);

revoke all on public.donor_public_view from public;
revoke all on public.donor_public_view from anon;
revoke all on public.donor_public_view from authenticated;
-- No grants: intentional unused surface with no client SELECT path.

-- ── P10B-09: expires_at partial index ────────────────────────────────────────
-- Matches expireOverdue: non-null expires_at + EXPIRABLE statuses.

create index if not exists idx_blood_requests_expires_at_expirable
  on blood_requests (expires_at)
  where expires_at is not null
    and status in (
      'PENDING'::blood_request_status,
      'MATCHING'::blood_request_status,
      'DONOR_CONTACTED'::blood_request_status
    );
