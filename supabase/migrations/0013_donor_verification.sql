-- ============================================================================
-- BloodConnect — Phase 9: Donor verification
-- ============================================================================
-- Additive only. Does NOT modify old migrations.
-- Uses existing verification_status enum (UNVERIFIED/PENDING/VERIFIED/REJECTED).
-- ============================================================================

-- 1) Verification metadata columns (admin-controlled)
alter table donor_profiles
  add column if not exists verified_at timestamptz;

alter table donor_profiles
  add column if not exists verified_by uuid references profiles (id) on delete set null;

alter table donor_profiles
  add column if not exists rejection_reason text;

-- Optional admin notes (kept for future expansions; donors cannot edit).
alter table donor_profiles
  add column if not exists verification_notes text;

create index if not exists idx_donor_profiles_verification_status
  on donor_profiles (verification_status);

-- 1b) Notification kind: donor verification (in-app only)
alter type notification_kind add value if not exists 'DONOR_VERIFICATION';

-- 2) Migration safety: preserve explicitly trusted VERIFIED donors only.
-- Existing donors that are not VERIFIED become UNVERIFIED.
update donor_profiles
set verification_status = 'UNVERIFIED'::verification_status,
    verified_at = null,
    verified_by = null,
    rejection_reason = null,
    verification_notes = null
where verification_status <> 'VERIFIED'::verification_status;

-- 3) Donor submit RPC: UNVERIFIED/REJECTED -> PENDING (no client-forged metadata)
create or replace function public.submit_own_donor_verification()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row donor_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row
  from donor_profiles
  where user_id = auth.uid();

  if not found then
    raise exception 'BC_NOT_FOUND: donor profile';
  end if;

  if v_row.verification_status = 'VERIFIED'::verification_status then
    raise exception 'BC_CONFLICT: already verified';
  end if;

  if v_row.verification_status = 'PENDING'::verification_status then
    return;
  end if;

  update donor_profiles
    set verification_status = 'PENDING'::verification_status,
        verified_at = null,
        verified_by = null,
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

-- 4) Owner write hardening:
-- - Donors cannot set VERIFIED/REJECTED.
-- - Donors cannot tamper with verified_at/verified_by/rejection_reason/verification_notes.
-- - If a VERIFIED donor changes sensitive fields, VERIFIED -> PENDING and metadata clears.
-- - Sensitive fields for donors: blood_group, location.
create or replace function public.donor_profiles_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sensitive_changed boolean;
begin
  -- Derive eligibility from last donation date.
  if new.last_donation_date is null then
    new.is_eligible := true;
  else
    new.is_eligible := (current_date - new.last_donation_date) >= 56;
  end if;

  if tg_op = 'INSERT' then
    if auth.role() is distinct from 'service_role' then
      if auth.uid() is null then
        raise exception 'Not authenticated';
      end if;

      new.user_id := auth.uid();
      new.verification_status := 'UNVERIFIED'::verification_status;
      new.verified_at := null;
      new.verified_by := null;
      new.rejection_reason := null;
      new.verification_notes := null;
    end if;

  else
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id is immutable';
    end if;

    if auth.role() is distinct from 'service_role' then
      sensitive_changed :=
        new.blood_group is distinct from old.blood_group
        or new.location is distinct from old.location;

      -- Sensitive edit on a VERIFIED donor triggers re-verification.
      if old.verification_status = 'VERIFIED'::verification_status and sensitive_changed then
        new.verification_status := 'PENDING'::verification_status;
        new.verified_at := null;
        new.verified_by := null;
        new.rejection_reason := null;
        new.verification_notes := null;
      else
        -- Owners cannot self-verify.
        if new.verification_status = 'VERIFIED'::verification_status then
          raise exception 'Owners cannot set VERIFIED';
        end if;
        if new.verification_status = 'REJECTED'::verification_status then
          raise exception 'Owners cannot set REJECTED';
        end if;

        if new.verification_status is distinct from old.verification_status then
          -- Only allowed transition for owners:
          -- (UNVERIFIED|REJECTED|PENDING) -> PENDING.
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

          -- Submissions clear admin-controlled verification metadata.
          new.verified_at := null;
          new.verified_by := null;
          new.rejection_reason := null;
          new.verification_notes := null;
        else
          -- Preserve admin-controlled metadata on ordinary edits.
          new.verified_at := old.verified_at;
          new.verified_by := old.verified_by;
          new.rejection_reason := old.rejection_reason;
          new.verification_notes := old.verification_notes;
        end if;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists donor_profiles_before_write on donor_profiles;
create trigger donor_profiles_before_write
  before insert or update on donor_profiles
  for each row execute procedure public.donor_profiles_before_write();

revoke all on function public.submit_own_donor_verification() from public;
grant execute on function public.submit_own_donor_verification() to authenticated;

