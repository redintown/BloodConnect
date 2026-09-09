-- ============================================================================
-- BloodConnect — Phase 8A: organization profile + verification + ownership/RLS
-- ============================================================================
-- Additive only. Does not modify 0001–0009.
-- Does not implement inventory, public find-blood, or Phase 7 changes.
-- ============================================================================

-- ── 1. Ownership uniqueness ──────────────────────────────────────────────────

create unique index if not exists idx_hospitals_one_per_user
  on hospitals (user_id)
  where user_id is not null;

create unique index if not exists idx_blood_banks_one_per_user
  on blood_banks (user_id)
  where user_id is not null;

-- ── 2. Location GiST indexes ─────────────────────────────────────────────────

create index if not exists idx_hospitals_location
  on hospitals using gist (location);

create index if not exists idx_blood_banks_location
  on blood_banks using gist (location);

-- ── 3. Verification metadata ─────────────────────────────────────────────────

alter table hospitals
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references profiles(id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists verification_notes text;

alter table blood_banks
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references profiles(id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists verification_notes text;

-- ── 4. Notification kind for org verification ────────────────────────────────

alter type notification_kind add value if not exists 'ORG_VERIFICATION';

-- ── 5. Integrity triggers (clients cannot self-verify) ───────────────────────

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
    end if;
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;

  if auth.role() is distinct from 'service_role' then
    sensitive_changed :=
      new.name is distinct from old.name
      or new.phone is distinct from old.phone
      or new.address is distinct from old.address
      or new.location is distinct from old.location;

    -- Never allow clients to set admin verification fields.
    if old.verification_status = 'VERIFIED'::verification_status and sensitive_changed then
      new.verification_status := 'PENDING'::verification_status;
      new.verified_at := null;
      new.verified_by := null;
      new.rejection_reason := null;
    else
      -- Clients may only move REJECTED/UNVERIFIED → PENDING (resubmit),
      -- or keep PENDING. Never VERIFIED / newly REJECTED.
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
      end if;

      new.verified_at := old.verified_at;
      new.verified_by := old.verified_by;
      if new.verification_status = 'PENDING'::verification_status
         and old.verification_status = 'REJECTED'::verification_status then
        new.rejection_reason := null;
      elsif new.verification_status = old.verification_status then
        -- Keep rejection_reason unless cleared by resubmit above.
        null;
      end if;
    end if;

    -- Non-sensitive fields (e.g. has_24h_emergency) do not clear verification.
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
      end if;

      new.verified_at := old.verified_at;
      new.verified_by := old.verified_by;
      if new.verification_status = 'PENDING'::verification_status
         and old.verification_status = 'REJECTED'::verification_status then
        new.rejection_reason := null;
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

-- ── 6. RLS: owner + admin; drop broad public SELECT of full rows ─────────────

drop policy if exists "hospitals_select_public" on hospitals;
drop policy if exists "blood_banks_select_public" on blood_banks;

drop policy if exists "hospitals_select_own" on hospitals;
create policy "hospitals_select_own"
  on hospitals for select
  using (auth.uid() = user_id);

drop policy if exists "hospitals_select_admin" on hospitals;
create policy "hospitals_select_admin"
  on hospitals for select
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'ADMIN'::app_role
    )
  );

drop policy if exists "hospitals_insert_own" on hospitals;
create policy "hospitals_insert_own"
  on hospitals for insert
  with check (auth.uid() = user_id);

drop policy if exists "hospitals_update_own" on hospitals;
create policy "hospitals_update_own"
  on hospitals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "blood_banks_select_own" on blood_banks;
create policy "blood_banks_select_own"
  on blood_banks for select
  using (auth.uid() = user_id);

drop policy if exists "blood_banks_select_admin" on blood_banks;
create policy "blood_banks_select_admin"
  on blood_banks for select
  using (
    exists (
      select 1 from user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'ADMIN'::app_role
    )
  );

drop policy if exists "blood_banks_insert_own" on blood_banks;
create policy "blood_banks_insert_own"
  on blood_banks for insert
  with check (auth.uid() = user_id);

drop policy if exists "blood_banks_update_own" on blood_banks;
create policy "blood_banks_update_own"
  on blood_banks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 7. Owner location + profile RPCs (extensions.ST_* pattern) ───────────────

create or replace function public.own_hospital_location()
returns table (latitude double precision, longitude double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select extensions.ST_Y(location::extensions.geometry),
         extensions.ST_X(location::extensions.geometry)
  from hospitals
  where user_id = auth.uid()
    and location is not null;
$$;

create or replace function public.own_blood_bank_location()
returns table (latitude double precision, longitude double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select extensions.ST_Y(location::extensions.geometry),
         extensions.ST_X(location::extensions.geometry)
  from blood_banks
  where user_id = auth.uid()
    and location is not null;
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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

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
        rejection_reason = null
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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

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
        rejection_reason = null
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

revoke all on function public.own_hospital_location() from public;
revoke all on function public.own_blood_bank_location() from public;
revoke all on function public.create_own_hospital_profile(text, text, text, double precision, double precision, boolean) from public;
revoke all on function public.update_own_hospital_profile(text, text, text, double precision, double precision, boolean) from public;
revoke all on function public.submit_own_hospital_verification() from public;
revoke all on function public.create_own_blood_bank_profile(text, text, text, double precision, double precision, text) from public;
revoke all on function public.update_own_blood_bank_profile(text, text, text, double precision, double precision, text) from public;
revoke all on function public.submit_own_blood_bank_verification() from public;

grant execute on function public.own_hospital_location() to authenticated;
grant execute on function public.own_blood_bank_location() to authenticated;
grant execute on function public.create_own_hospital_profile(text, text, text, double precision, double precision, boolean) to authenticated;
grant execute on function public.update_own_hospital_profile(text, text, text, double precision, double precision, boolean) to authenticated;
grant execute on function public.submit_own_hospital_verification() to authenticated;
grant execute on function public.create_own_blood_bank_profile(text, text, text, double precision, double precision, text) to authenticated;
grant execute on function public.update_own_blood_bank_profile(text, text, text, double precision, double precision, text) to authenticated;
grant execute on function public.submit_own_blood_bank_verification() to authenticated;
