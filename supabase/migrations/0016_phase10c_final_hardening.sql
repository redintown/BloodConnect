-- ============================================================================
-- BloodConnect — Phase 10C: Final hardening (minimal)
-- ============================================================================
-- Additive only. Does NOT modify 0001–0015.
--
-- P10C: mark_own_notification_read must be SECURITY DEFINER.
-- notifications has SELECT-only RLS (0001); SECURITY INVOKER UPDATE fails closed
-- and recipients cannot mark notifications read.
-- ============================================================================

create or replace function public.mark_own_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_notification_id is null then
    raise exception 'BC_VALIDATION' using errcode = 'P0001';
  end if;

  update notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = auth.uid();

  if not found then
    raise exception 'BC_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.mark_own_notification_read(uuid) from public;
revoke all on function public.mark_own_notification_read(uuid) from anon;
grant execute on function public.mark_own_notification_read(uuid) to authenticated;
