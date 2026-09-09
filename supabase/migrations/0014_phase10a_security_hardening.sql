-- ============================================================================
-- BloodConnect — Phase 10A: Security Hardening
-- ============================================================================
-- Additive only. Does NOT modify 0001–0013 migration files.
-- H1: drop client user_roles self-insert
-- H2: org RPC role checks
-- H4: revoke public search EXECUTE from anon/authenticated
-- H6: org verification metadata anti-forgery (parity with donors)
-- ============================================================================

-- ── H1: clients must not INSERT into user_roles ──────────────────────────────
-- Legitimate bootstrap remains: handle_new_user() SECURITY DEFINER trigger
-- (bypasses RLS) and service-role inserts from trusted server code.

drop policy if exists "user_roles_insert_own_non_admin" on user_roles;

-- ── H2 helper: require app role for session user ─────────────────────────────

create or replace function public.require_own_app_role(p_role app_role)
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role = p_role
  ) then
    raise exception 'BC_UNAUTHORIZED: role required';
  end if;
end;
$$;

revoke all on function public.require_own_app_role(app_role) from public;
grant execute on function public.require_own_app_role(app_role) to authenticated;

-- ── H2: organization RPCs require matching role ──────────────────────────────

create or replace function public.own_hospital_location()
returns table (latitude double precision, longitude double precision)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  perform public.require_own_app_role('HOSPITAL'::app_role);
  return query
  select extensions.ST_Y(location::extensions.geometry),
         extensions.ST_X(location::extensions.geometry)
  from hospitals
  where user_id = auth.uid()
    and location is not null;
end;
$$;

create or replace function public.own_blood_bank_location()
returns table (latitude double precision, longitude double precision)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  perform public.require_own_app_role('BLOOD_BANK'::app_role);
  return query
  select extensions.ST_Y(location::extensions.geometry),
         extensions.ST_X(location::extensions.geometry)
  from blood_banks
  where user_id = auth.uid()
    and location is not null;
end;
$$;

create or replace function public.create_own_hospital_profile(
  p_name text,
  p_phone text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_has_24h_emergency boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.require_own_app_role('HOSPITAL'::app_role);
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'BC_VALIDATION: name';
  end if;
  if p_phone is null or length(trim(p_phone)) < 5 then
    raise exception 'BC_VALIDATION: phone';
  end if;
  if p_address is null or length(trim(p_address)) < 5 then
    raise exception 'BC_VALIDATION: address';
  end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'BC_VALIDATION: location';
  end if;

  insert into hospitals (
    user_id, name, phone, address, location, has_24h_emergency, verification_status
  ) values (
    auth.uid(),
    trim(p_name),
    trim(p_phone),
    trim(p_address),
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
    coalesce(p_has_24h_emergency, false),
    'PENDING'::verification_status
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'BC_CONFLICT: hospital profile already exists';
end;
$$;

create or replace function public.update_own_hospital_profile(
  p_name text,
  p_phone text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_has_24h_emergency boolean default false
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.require_own_app_role('HOSPITAL'::app_role);
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'BC_VALIDATION: name';
  end if;
  if p_phone is null or length(trim(p_phone)) < 5 then
    raise exception 'BC_VALIDATION: phone';
  end if;
  if p_address is null or length(trim(p_address)) < 5 then
    raise exception 'BC_VALIDATION: address';
  end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'BC_VALIDATION: location';
  end if;

  update hospitals
    set name = trim(p_name),
        phone = trim(p_phone),
        address = trim(p_address),
        location = extensions.ST_SetSRID(
          extensions.ST_MakePoint(p_lng, p_lat),
          4326
        )::extensions.geography,
        has_24h_emergency = coalesce(p_has_24h_emergency, false)
  where user_id = auth.uid();

  if not found then
    raise exception 'BC_NOT_FOUND: hospital profile';
  end if;
end;
$$;

create or replace function public.submit_own_hospital_verification()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row hospitals%rowtype;
begin
  perform public.require_own_app_role('HOSPITAL'::app_role);

  select * into v_row from hospitals where user_id = auth.uid();
  if not found then
    raise exception 'BC_NOT_FOUND: hospital profile';
  end if;
  if v_row.location is null then
    raise exception 'BC_VALIDATION: location required';
  end if;
  if v_row.verification_status = 'VERIFIED'::verification_status then
    raise exception 'BC_CONFLICT: already verified';
  end if;
  if v_row.verification_status = 'PENDING'::verification_status then
    return;
  end if;

  update hospitals
    set verification_status = 'PENDING'::verification_status,
        rejection_reason = null,
        verification_notes = null
  where user_id = auth.uid()
    and verification_status in (
      'REJECTED'::verification_status,
      'UNVERIFIED'::verification_status
    );

  if not found then
    raise exception 'BC_CONFLICT: cannot submit verification';
  end if;
end;
$$;

create or replace function public.create_own_blood_bank_profile(
  p_name text,
  p_phone text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_emergency_hours text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.require_own_app_role('BLOOD_BANK'::app_role);
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'BC_VALIDATION: name';
  end if;
  if p_phone is null or length(trim(p_phone)) < 5 then
    raise exception 'BC_VALIDATION: phone';
  end if;
  if p_address is null or length(trim(p_address)) < 5 then
    raise exception 'BC_VALIDATION: address';
  end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'BC_VALIDATION: location';
  end if;

  insert into blood_banks (
    user_id, name, phone, address, location, emergency_hours, verification_status
  ) values (
    auth.uid(),
    trim(p_name),
    trim(p_phone),
    trim(p_address),
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
    nullif(trim(coalesce(p_emergency_hours, '')), ''),
    'PENDING'::verification_status
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'BC_CONFLICT: blood bank profile already exists';
end;
$$;

create or replace function public.update_own_blood_bank_profile(
  p_name text,
  p_phone text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_emergency_hours text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.require_own_app_role('BLOOD_BANK'::app_role);
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'BC_VALIDATION: name';
  end if;
  if p_phone is null or length(trim(p_phone)) < 5 then
    raise exception 'BC_VALIDATION: phone';
  end if;
  if p_address is null or length(trim(p_address)) < 5 then
    raise exception 'BC_VALIDATION: address';
  end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'BC_VALIDATION: location';
  end if;

  update blood_banks
    set name = trim(p_name),
        phone = trim(p_phone),
        address = trim(p_address),
        location = extensions.ST_SetSRID(
          extensions.ST_MakePoint(p_lng, p_lat),
          4326
        )::extensions.geography,
        emergency_hours = nullif(trim(coalesce(p_emergency_hours, '')), '')
  where user_id = auth.uid();

  if not found then
    raise exception 'BC_NOT_FOUND: blood bank profile';
  end if;
end;
$$;

create or replace function public.submit_own_blood_bank_verification()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row blood_banks%rowtype;
begin
  perform public.require_own_app_role('BLOOD_BANK'::app_role);

  select * into v_row from blood_banks where user_id = auth.uid();
  if not found then
    raise exception 'BC_NOT_FOUND: blood bank profile';
  end if;
  if v_row.location is null then
    raise exception 'BC_VALIDATION: location required';
  end if;
  if v_row.verification_status = 'VERIFIED'::verification_status then
    raise exception 'BC_CONFLICT: already verified';
  end if;
  if v_row.verification_status = 'PENDING'::verification_status then
    return;
  end if;

  update blood_banks
    set verification_status = 'PENDING'::verification_status,
        rejection_reason = null,
        verification_notes = null
  where user_id = auth.uid()
    and verification_status in (
      'REJECTED'::verification_status,
      'UNVERIFIED'::verification_status
    );

  if not found then
    raise exception 'BC_CONFLICT: cannot submit verification';
  end if;
end;
$$;

-- ── H6: org verification metadata anti-forgery (parity with donors) ──────────

create or replace function public.hospitals_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sensitive_changed boolean;
begin
  if tg_op = 'INSERT' then
    if auth.role() is distinct from 'service_role' then
      if auth.uid() is null then
        raise exception 'Not authenticated';
      end if;
      new.user_id := auth.uid();
      new.verification_status := 'PENDING'::verification_status;
      new.verified_at := null;
      new.verified_by := null;
      new.rejection_reason := null;
      new.verification_notes := null;
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;

  if auth.role() is distinct from 'service_role' then
    sensitive_changed :=
      new.name is distinct from old.name
      or new.phone is distinct from old.phone
      or new.address is distinct from old.address
      or new.location is distinct from old.location;

    if old.verification_status = 'VERIFIED'::verification_status and sensitive_changed then
      new.verification_status := 'PENDING'::verification_status;
      new.verified_at := null;
      new.verified_by := null;
      new.rejection_reason := null;
      new.verification_notes := null;
    else
      if new.verification_status = 'VERIFIED'::verification_status then
        raise exception 'Owners cannot set VERIFIED';
      end if;
      if new.verification_status = 'REJECTED'::verification_status
         and old.verification_status is distinct from 'REJECTED'::verification_status then
        raise exception 'Owners cannot set REJECTED';
      end if;
      if new.verification_status is distinct from old.verification_status then
        if not (
          new.verification_status = 'PENDING'::verification_status
          and old.verification_status in (
            'REJECTED'::verification_status,
            'UNVERIFIED'::verification_status,
            'PENDING'::verification_status
          )
        ) then
          raise exception 'Invalid verification status transition';
        end if;

        new.verified_at := null;
        new.verified_by := null;
        new.rejection_reason := null;
        new.verification_notes := null;
      else
        new.verified_at := old.verified_at;
        new.verified_by := old.verified_by;
        new.rejection_reason := old.rejection_reason;
        new.verification_notes := old.verification_notes;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hospitals_before_write on hospitals;
create trigger hospitals_before_write
  before insert or update on hospitals
  for each row execute function public.hospitals_before_write();

create or replace function public.blood_banks_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sensitive_changed boolean;
begin
  if tg_op = 'INSERT' then
    if auth.role() is distinct from 'service_role' then
      if auth.uid() is null then
        raise exception 'Not authenticated';
      end if;
      new.user_id := auth.uid();
      new.verification_status := 'PENDING'::verification_status;
      new.verified_at := null;
      new.verified_by := null;
      new.rejection_reason := null;
      new.verification_notes := null;
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;

  if auth.role() is distinct from 'service_role' then
    sensitive_changed :=
      new.name is distinct from old.name
      or new.phone is distinct from old.phone
      or new.address is distinct from old.address
      or new.location is distinct from old.location;

    if old.verification_status = 'VERIFIED'::verification_status and sensitive_changed then
      new.verification_status := 'PENDING'::verification_status;
      new.verified_at := null;
      new.verified_by := null;
      new.rejection_reason := null;
      new.verification_notes := null;
    else
      if new.verification_status = 'VERIFIED'::verification_status then
        raise exception 'Owners cannot set VERIFIED';
      end if;
      if new.verification_status = 'REJECTED'::verification_status
         and old.verification_status is distinct from 'REJECTED'::verification_status then
        raise exception 'Owners cannot set REJECTED';
      end if;
      if new.verification_status is distinct from old.verification_status then
        if not (
          new.verification_status = 'PENDING'::verification_status
          and old.verification_status in (
            'REJECTED'::verification_status,
            'UNVERIFIED'::verification_status,
            'PENDING'::verification_status
          )
        ) then
          raise exception 'Invalid verification status transition';
        end if;

        new.verified_at := null;
        new.verified_by := null;
        new.rejection_reason := null;
        new.verification_notes := null;
      else
        new.verified_at := old.verified_at;
        new.verified_by := old.verified_by;
        new.rejection_reason := old.rejection_reason;
        new.verification_notes := old.verification_notes;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists blood_banks_before_write on blood_banks;
create trigger blood_banks_before_write
  before insert or update on blood_banks
  for each row execute function public.blood_banks_before_write();

-- ── H4: public search RPC — service_role only ────────────────────────────────
-- Browser must use Server Action → bloodAvailabilityService → createAdminClient.

revoke all on function public.search_public_blood_availability(
  blood_group, double precision, double precision, double precision, text
) from public;

revoke all on function public.search_public_blood_availability(
  blood_group, double precision, double precision, double precision, text
) from anon;

revoke all on function public.search_public_blood_availability(
  blood_group, double precision, double precision, double precision, text
) from authenticated;

grant execute on function public.search_public_blood_availability(
  blood_group, double precision, double precision, double precision, text
) to service_role;
