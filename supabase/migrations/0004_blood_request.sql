-- ============================================================================
-- BloodConnect — Phase 3 blood requests
-- ============================================================================
--  * Create + read location via SECURITY INVOKER RPCs (PostGIS stays in SQL).
--  * Authenticated users may cancel cancellable requests; they cannot set
--    EXPIRED / MATCHING / etc. System transitions use the service role.
--  * Does not alter donor, auth, or Phase 2 objects.
-- ============================================================================

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
  p_expires_at timestamptz default null
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
    expires_at
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
    p_expires_at
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.own_request_location(p_request_id uuid)
returns table (latitude double precision, longitude double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select
    extensions.ST_Y(location::extensions.geometry),
    extensions.ST_X(location::extensions.geometry)
  from blood_requests
  where id = p_request_id
    and requester_id = auth.uid()
    and location is not null;
$$;

create or replace function public.set_own_request_location(
  p_request_id uuid,
  p_lat double precision,
  p_lng double precision
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

  if p_lat is null or p_lng is null then
    raise exception 'Location is required';
  end if;

  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid coordinates';
  end if;

  update blood_requests
    set location = extensions.ST_SetSRID(
      extensions.ST_MakePoint(p_lng, p_lat),
      4326
    )::extensions.geography,
        updated_at = now()
  where id = p_request_id
    and requester_id = auth.uid()
    and status = 'PENDING'::blood_request_status;

  if not found then
    raise exception 'Request not found or not editable';
  end if;
end;
$$;

create or replace function public.blood_requests_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'PENDING'::blood_request_status;
    if auth.role() is distinct from 'service_role' then
      if auth.uid() is null then
        raise exception 'Not authenticated';
      end if;
      new.requester_id := auth.uid();
    end if;
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE
  if new.requester_id is distinct from old.requester_id then
    raise exception 'requester_id is immutable';
  end if;

  if auth.role() is distinct from 'service_role' then
    if new.status is distinct from old.status then
      if not (
        new.status = 'CANCELLED'::blood_request_status
        and old.status in (
          'PENDING'::blood_request_status,
          'MATCHING'::blood_request_status
        )
      ) then
        raise exception 'Unauthorized status change';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists blood_requests_before_write on blood_requests;

create trigger blood_requests_before_write
  before insert or update on blood_requests
  for each row execute procedure public.blood_requests_before_write();

revoke all on function public.create_own_blood_request(
  blood_group, integer, request_urgency, double precision, double precision,
  text, text, uuid, text, timestamptz, text, timestamptz
) from public;
revoke all on function public.own_request_location(uuid) from public;
revoke all on function public.set_own_request_location(uuid, double precision, double precision) from public;

grant execute on function public.create_own_blood_request(
  blood_group, integer, request_urgency, double precision, double precision,
  text, text, uuid, text, timestamptz, text, timestamptz
) to authenticated;
grant execute on function public.own_request_location(uuid) to authenticated;
grant execute on function public.set_own_request_location(uuid, double precision, double precision) to authenticated;
