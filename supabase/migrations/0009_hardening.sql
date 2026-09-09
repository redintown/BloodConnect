-- ============================================================================
-- BloodConnect — Pre-Phase-8 hardening (audit fixes)
-- ============================================================================
--  * Freeze requester content updates after PENDING (RLS + trigger).
--  * Split requester escalation notification kinds for multi-step alerts.
--  * Does not modify 0001–0008 in place.
-- ============================================================================

-- ── 1. Freeze blood_requests content after PENDING ───────────────────────────

drop policy if exists "blood_requests_update_own" on blood_requests;

-- Requester may update while PENDING (content edits) or set CANCELLED (cancel).
-- New-row status must be PENDING or CANCELLED so MATCHING+ content edits fail.
create policy "blood_requests_update_own"
  on blood_requests for update
  using (auth.uid() = requester_id)
  with check (
    auth.uid() = requester_id
    and status in (
      'PENDING'::blood_request_status,
      'CANCELLED'::blood_request_status
    )
  );

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

    -- Content fields are frozen once the request leaves PENDING
    -- (cancel may only change status + updated_at).
    if old.status is distinct from 'PENDING'::blood_request_status then
      if new.blood_group is distinct from old.blood_group
         or new.quantity_units is distinct from old.quantity_units
         or new.urgency is distinct from old.urgency
         or new.required_by is distinct from old.required_by
         or new.hospital_id is distinct from old.hospital_id
         or new.hospital_name_freeform is distinct from old.hospital_name_freeform
         or new.location is distinct from old.location
         or new.contact_name is distinct from old.contact_name
         or new.contact_phone is distinct from old.contact_phone
         or new.notes is distinct from old.notes
         or new.expires_at is distinct from old.expires_at
         or new.is_emergency is distinct from old.is_emergency
      then
        raise exception 'Request content is frozen after PENDING';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ── 2. Requester escalation notification kinds (multi-step alerts) ───────────

alter type notification_kind add value if not exists 'ESCALATION_REQUESTER_ORG_RESPONSE';
alter type notification_kind add value if not exists 'ESCALATION_REQUESTER_ADMIN';
