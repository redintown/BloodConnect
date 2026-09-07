-- ============================================================================
-- BloodConnect — Phase 2 donor profile
-- ============================================================================
--  * Donors may read their own donation rows (writes stay in later phases).
--  * Location is read/written via SECURITY INVOKER RPCs so PostGIS stays in
--    SQL and RLS on donor_profiles still applies.
--  * Eligibility is derived from last_donation_date (56-day interval).
--  * Donors cannot self-assign verification_status.
-- ============================================================================

create policy "donations_select_own" on donations for select using (
  exists (
    select 1 from donor_profiles dp
    where dp.id = donor_id and dp.user_id = auth.uid()
  )
);

create or replace function public.own_donor_location()
returns table (latitude double precision, longitude double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select ST_Y(location::geometry), ST_X(location::geometry)
  from donor_profiles
  where user_id = auth.uid()
    and location is not null;
$$;

create or replace function public.set_own_donor_location(
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_lat is null or p_lng is null then
    update donor_profiles
      set location = null,
          location_updated_at = now(),
          updated_at = now()
    where user_id = auth.uid();
    return;
  end if;

  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid coordinates';
  end if;

  update donor_profiles
    set location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        location_updated_at = now(),
        updated_at = now()
  where user_id = auth.uid();
end;
$$;

revoke all on function public.own_donor_location() from public;
revoke all on function public.set_own_donor_location(double precision, double precision) from public;
grant execute on function public.own_donor_location() to authenticated;
grant execute on function public.set_own_donor_location(double precision, double precision) to authenticated;

create or replace function public.donor_profiles_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.last_donation_date is null then
    new.is_eligible := true;
  else
    new.is_eligible := (current_date - new.last_donation_date) >= 56;
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := 'UNVERIFIED';
  elsif auth.role() is distinct from 'service_role' then
    new.verification_status := old.verification_status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists donor_profiles_before_write on donor_profiles;

create trigger donor_profiles_before_write
  before insert or update on donor_profiles
  for each row execute procedure public.donor_profiles_before_write();
