-- ============================================================================
-- BloodConnect — Phase 7 emergency escalation (hospitals / blood banks / admin)
-- ============================================================================
--  * Extends emergency_events; does NOT alter Phase 4 donor matching.
--  * Does NOT re-run NEARBY_DONORS / WIDER_RADIUS donor outreach.
--  * Phase 7 active levels: BLOOD_BANKS_HOSPITALS → ADMIN_INTERVENTION.
--  * Does not modify migrations 0001–0007.
-- ============================================================================

-- ── Status enums ─────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'emergency_event_status') then
    create type emergency_event_status as enum ('OPEN', 'RESOLVED', 'CANCELLED');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_escalation_response') then
    create type org_escalation_response as enum (
      'PENDING', 'ACKNOWLEDGED', 'CAN_SUPPLY', 'CANNOT_HELP'
    );
  end if;
end
$$;

-- ── Extend emergency_events ──────────────────────────────────────────────────

alter table emergency_events
  add column if not exists status emergency_event_status not null default 'OPEN';

alter table emergency_events
  add column if not exists resolved_at timestamptz;

alter table emergency_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- One active OPEN org/admin escalation per request.
create unique index if not exists idx_emergency_events_one_open_active
  on emergency_events (blood_request_id)
  where status = 'OPEN'
    and level in (
      'BLOOD_BANKS_HOSPITALS'::escalation_level,
      'ADMIN_INTERVENTION'::escalation_level
    );

create index if not exists idx_emergency_events_status
  on emergency_events (status, level);

-- ── Per-organization targets / responses ─────────────────────────────────────

create table if not exists emergency_event_targets (
  id uuid primary key default gen_random_uuid(),
  emergency_event_id uuid not null references emergency_events (id) on delete cascade,
  organization_type text not null check (organization_type in ('HOSPITAL', 'BLOOD_BANK')),
  organization_id uuid not null,
  status org_escalation_response not null default 'PENDING',
  distance_meters numeric,
  responded_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (emergency_event_id, organization_type, organization_id)
);

create index if not exists idx_emergency_event_targets_event
  on emergency_event_targets (emergency_event_id);

create index if not exists idx_emergency_event_targets_org
  on emergency_event_targets (organization_type, organization_id);

alter table emergency_event_targets enable row level security;

-- ── Notification kinds ───────────────────────────────────────────────────────

alter type notification_kind add value if not exists 'ESCALATION_ORG';
alter type notification_kind add value if not exists 'ESCALATION_ADMIN';
alter type notification_kind add value if not exists 'ESCALATION_REQUESTER';

-- ── Nearby verified orgs (service_role; uses request location in SQL) ────────

create or replace function public.find_nearby_escalation_organizations(
  p_request_id uuid,
  p_radius_meters double precision default 50000
)
returns table (
  organization_type text,
  organization_id uuid,
  user_id uuid,
  name text,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with req as (
    select location
    from blood_requests
    where id = p_request_id
      and location is not null
  )
  select
    'HOSPITAL'::text as organization_type,
    h.id as organization_id,
    h.user_id,
    h.name,
    extensions.ST_Distance(h.location, req.location) as distance_meters
  from hospitals h
  cross join req
  where h.verification_status = 'VERIFIED'::verification_status
    and h.user_id is not null
    and h.location is not null
    and extensions.ST_DWithin(h.location, req.location, p_radius_meters)

  union all

  select
    'BLOOD_BANK'::text,
    b.id,
    b.user_id,
    b.name,
    extensions.ST_Distance(b.location, req.location)
  from blood_banks b
  cross join req
  where b.verification_status = 'VERIFIED'::verification_status
    and b.user_id is not null
    and b.location is not null
    and extensions.ST_DWithin(b.location, req.location, p_radius_meters)

  order by distance_meters asc;
$$;

revoke all on function public.find_nearby_escalation_organizations(uuid, double precision)
  from public;
revoke all on function public.find_nearby_escalation_organizations(uuid, double precision)
  from anon;
revoke all on function public.find_nearby_escalation_organizations(uuid, double precision)
  from authenticated;
grant execute on function public.find_nearby_escalation_organizations(uuid, double precision)
  to service_role;

-- ── RLS: emergency_events ────────────────────────────────────────────────────

drop policy if exists "emergency_events_select_requester" on emergency_events;
create policy "emergency_events_select_requester"
  on emergency_events for select
  using (
    exists (
      select 1 from blood_requests br
      where br.id = blood_request_id
        and br.requester_id = auth.uid()
    )
  );

drop policy if exists "emergency_events_select_org" on emergency_events;
create policy "emergency_events_select_org"
  on emergency_events for select
  using (
    exists (
      select 1
      from emergency_event_targets t
      left join hospitals h
        on t.organization_type = 'HOSPITAL' and t.organization_id = h.id
      left join blood_banks b
        on t.organization_type = 'BLOOD_BANK' and t.organization_id = b.id
      where t.emergency_event_id = emergency_events.id
        and (
          h.user_id = auth.uid()
          or b.user_id = auth.uid()
        )
    )
  );

drop policy if exists "emergency_events_select_admin" on emergency_events;
create policy "emergency_events_select_admin"
  on emergency_events for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'ADMIN'::app_role
    )
  );

-- ── RLS: emergency_event_targets ─────────────────────────────────────────────

drop policy if exists "emergency_targets_select_requester" on emergency_event_targets;
create policy "emergency_targets_select_requester"
  on emergency_event_targets for select
  using (
    exists (
      select 1
      from emergency_events e
      join blood_requests br on br.id = e.blood_request_id
      where e.id = emergency_event_id
        and br.requester_id = auth.uid()
    )
  );

drop policy if exists "emergency_targets_select_own_org" on emergency_event_targets;
create policy "emergency_targets_select_own_org"
  on emergency_event_targets for select
  using (
    (
      organization_type = 'HOSPITAL'
      and exists (
        select 1 from hospitals h
        where h.id = organization_id and h.user_id = auth.uid()
      )
    )
    or (
      organization_type = 'BLOOD_BANK'
      and exists (
        select 1 from blood_banks b
        where b.id = organization_id and b.user_id = auth.uid()
      )
    )
  );

drop policy if exists "emergency_targets_select_admin" on emergency_event_targets;
create policy "emergency_targets_select_admin"
  on emergency_event_targets for select
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'ADMIN'::app_role
    )
  );

-- Org responds via SECURITY DEFINER RPC (no direct client UPDATE).
create or replace function public.respond_to_escalation_target(
  p_target_id uuid,
  p_response org_escalation_response,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target emergency_event_targets%rowtype;
  v_event emergency_events%rowtype;
  v_request blood_requests%rowtype;
  v_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'BC_UNAUTHORIZED' using errcode = 'P0003';
  end if;

  if p_response not in (
    'ACKNOWLEDGED'::org_escalation_response,
    'CAN_SUPPLY'::org_escalation_response,
    'CANNOT_HELP'::org_escalation_response
  ) then
    raise exception 'BC_VALIDATION' using errcode = 'P0001';
  end if;

  select * into v_target
  from emergency_event_targets
  where id = p_target_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_event
  from emergency_events
  where id = v_target.emergency_event_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_event.status is distinct from 'OPEN'::emergency_event_status then
    raise exception 'BC_ESCALATION_CLOSED' using errcode = 'P0004';
  end if;

  select * into v_request
  from blood_requests
  where id = v_event.blood_request_id
  for update;

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Donor acceptance / terminal request wins — org response becomes no-op conflict.
  if v_request.status in (
    'DONOR_ACCEPTED'::blood_request_status,
    'DONOR_ON_THE_WAY'::blood_request_status,
    'COMPLETED'::blood_request_status,
    'CANCELLED'::blood_request_status,
    'EXPIRED'::blood_request_status
  ) then
    raise exception 'BC_REQUEST_TERMINAL' using errcode = 'P0004';
  end if;

  if exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'ADMIN'::app_role
  ) then
    v_allowed := true;
  elsif v_target.organization_type = 'HOSPITAL' then
    select exists (
      select 1 from hospitals h
      where h.id = v_target.organization_id and h.user_id = auth.uid()
    ) into v_allowed;
  elsif v_target.organization_type = 'BLOOD_BANK' then
    select exists (
      select 1 from blood_banks b
      where b.id = v_target.organization_id and b.user_id = auth.uid()
    ) into v_allowed;
  end if;

  if not v_allowed then
    raise exception 'BC_UNAUTHORIZED' using errcode = 'P0003';
  end if;

  update emergency_event_targets
  set status = p_response,
      responded_at = now(),
      notes = nullif(trim(p_notes), '')
  where id = v_target.id;
end;
$$;

revoke all on function public.respond_to_escalation_target(
  uuid, org_escalation_response, text
) from public;
grant execute on function public.respond_to_escalation_target(
  uuid, org_escalation_response, text
) to authenticated;
