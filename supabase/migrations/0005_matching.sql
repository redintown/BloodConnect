-- ============================================================================
-- BloodConnect — Phase 4 matching
-- ============================================================================
--  * Adds MATCHED to donor_response_status for Phase 4 persistence (not NOTIFIED).
--  * Privileged nearby-candidate RPC reads donor coordinates internally and
--    returns ONLY public-safe fields + distance_meters (never lat/lng).
--  * No authenticated INSERT policy on blood_request_matches.
--  * Does not alter Phase 1–3 auth/donor/request migrations.
-- ============================================================================

-- Phase 4 initial match status (notifications still use NOTIFIED later).
alter type donor_response_status add value 'MATCHED' before 'NOTIFIED';

create or replace function public.find_nearby_match_candidates(
  p_lat double precision,
  p_lng double precision,
  p_requester_id uuid,
  p_radius_meters double precision
)
returns table (
  donor_id uuid,
  blood_group blood_group,
  is_eligible boolean,
  verification_status verification_status,
  is_available boolean,
  is_available_at_night boolean,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dp.id as donor_id,
    dp.blood_group,
    dp.is_eligible,
    dp.verification_status,
    coalesce(da.is_available, false) as is_available,
    coalesce(da.is_available_at_night, false) as is_available_at_night,
    extensions.ST_Distance(
      dp.location,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography
    ) as distance_meters
  from donor_profiles dp
  left join donor_availability da on da.donor_id = dp.id
  where dp.location is not null
    and dp.is_eligible = true
    and dp.verification_status <> 'REJECTED'::verification_status
    and coalesce(da.is_available, false) = true
    and dp.user_id is distinct from p_requester_id
    and extensions.ST_DWithin(
      dp.location,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
      p_radius_meters
    )
  order by distance_meters asc;
$$;

revoke all on function public.find_nearby_match_candidates(
  double precision, double precision, uuid, double precision
) from public;
revoke all on function public.find_nearby_match_candidates(
  double precision, double precision, uuid, double precision
) from anon;
revoke all on function public.find_nearby_match_candidates(
  double precision, double precision, uuid, double precision
) from authenticated;

-- Service-role key is used by createAdminClient(); grant execute there only.
grant execute on function public.find_nearby_match_candidates(
  double precision, double precision, uuid, double precision
) to service_role;
