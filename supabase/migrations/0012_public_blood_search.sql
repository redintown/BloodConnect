-- ============================================================================
-- BloodConnect — Phase 8D: public blood availability search
-- ============================================================================
-- Additive only. Does not modify 0001–0011.
-- Does NOT restore public SELECT on hospitals / blood_banks / blood_inventory.
-- Does NOT change inventory, escalation, matching, or verification semantics.
-- ============================================================================

create or replace function public.search_public_blood_availability(
  p_blood_group blood_group,
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 10,
  p_organization_type text default 'ALL'
)
returns table (
  organization_id uuid,
  organization_type text,
  name text,
  address text,
  phone text,
  distance_km_rounded integer,
  availability text,
  inventory_updated_at timestamptz,
  has_24h_emergency boolean,
  emergency_hours text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_radius_km double precision;
  v_radius_m double precision;
  v_center extensions.geography;
  v_org_type text;
begin
  if p_blood_group is null then
    raise exception 'BC_VALIDATION: blood group required';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'BC_VALIDATION: location';
  end if;

  v_org_type := upper(trim(coalesce(p_organization_type, 'ALL')));
  if v_org_type not in ('ALL', 'HOSPITAL', 'BLOOD_BANK') then
    raise exception 'BC_VALIDATION: organization type';
  end if;

  -- Clamp to [0.001, 50] km (service layer restricts to 5/10/25/50).
  v_radius_km := least(greatest(coalesce(p_radius_km, 10), 0.001), 50);
  v_radius_m := v_radius_km * 1000;

  v_center := extensions.ST_SetSRID(
    extensions.ST_MakePoint(p_lng, p_lat),
    4326
  )::extensions.geography;

  return query
  (
    select
      h.id,
      'HOSPITAL'::text,
      h.name,
      h.address,
      h.phone,
      greatest(1, ceil(extensions.ST_Distance(h.location, v_center) / 1000.0))::integer,
      'POSSIBLE'::text,
      i.updated_at,
      h.has_24h_emergency,
      null::text
    from hospitals h
    inner join blood_inventory i
      on i.hospital_id = h.id
     and i.blood_group = p_blood_group
     and i.units_available > 0
    where v_org_type in ('ALL', 'HOSPITAL')
      and h.verification_status = 'VERIFIED'::verification_status
      and h.location is not null
      and extensions.ST_DWithin(h.location, v_center, v_radius_m)

    union all

    select
      b.id,
      'BLOOD_BANK'::text,
      b.name,
      b.address,
      b.phone,
      greatest(1, ceil(extensions.ST_Distance(b.location, v_center) / 1000.0))::integer,
      'POSSIBLE'::text,
      i.updated_at,
      null::boolean,
      b.emergency_hours
    from blood_banks b
    inner join blood_inventory i
      on i.blood_bank_id = b.id
     and i.blood_group = p_blood_group
     and i.units_available > 0
    where v_org_type in ('ALL', 'BLOOD_BANK')
      and b.verification_status = 'VERIFIED'::verification_status
      and b.location is not null
      and extensions.ST_DWithin(b.location, v_center, v_radius_m)
  )
  order by 6 asc, 3 asc
  limit 25;
end;
$$;

revoke all on function public.search_public_blood_availability(
  blood_group, double precision, double precision, double precision, text
) from public;

revoke all on function public.search_public_blood_availability(
  blood_group, double precision, double precision, double precision, text
) from anon;

revoke all on function public.search_public_blood_availability(
  blood_group, double precision, double precision, double precision, text
) from authenticated;

-- Executable by server (anon key without session, or authenticated session).
-- Browser must not call this as a free-form client workflow; use Server Action.
grant execute on function public.search_public_blood_availability(
  blood_group, double precision, double precision, double precision, text
) to anon, authenticated;
