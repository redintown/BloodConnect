-- ============================================================================
-- BloodConnect — Phase 8B: blood inventory (atomic adjust + audit + owner RLS)
-- ============================================================================
-- Additive only. Does not modify 0001–0010.
-- Does not implement reservation, fulfillment, public search, or Phase 7 changes.
-- Model: units_available only (one row per organization + blood_group).
-- ============================================================================

-- ── 1. Non-negative stock ────────────────────────────────────────────────────

alter table blood_inventory
  drop constraint if exists blood_inventory_units_non_negative;

alter table blood_inventory
  add constraint blood_inventory_units_non_negative
  check (units_available >= 0);

-- ── 2. Owner RLS (no public inventory access) ────────────────────────────────

drop policy if exists "blood_inventory_select_own_hospital" on blood_inventory;
create policy "blood_inventory_select_own_hospital"
  on blood_inventory for select
  using (
    hospital_id is not null
    and exists (
      select 1 from hospitals h
      where h.id = blood_inventory.hospital_id
        and h.user_id = auth.uid()
    )
  );

drop policy if exists "blood_inventory_select_own_blood_bank" on blood_inventory;
create policy "blood_inventory_select_own_blood_bank"
  on blood_inventory for select
  using (
    blood_bank_id is not null
    and exists (
      select 1 from blood_banks b
      where b.id = blood_inventory.blood_bank_id
        and b.user_id = auth.uid()
    )
  );

-- Writes go through SECURITY DEFINER adjust RPC (inventory + audit atomically).
-- No direct INSERT/UPDATE/DELETE policies for clients on blood_inventory.
-- No client policies on audit_logs (inserts only via DEFINER RPC).

-- ── 3. Atomic adjust + audit RPC ─────────────────────────────────────────────

create or replace function public.adjust_own_inventory(
  p_organization_type text,
  p_blood_group blood_group,
  p_delta integer,
  p_reason text default null
)
returns table (
  inventory_id uuid,
  blood_group blood_group,
  old_units integer,
  new_units integer,
  units_available integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hospital_id uuid;
  v_blood_bank_id uuid;
  v_row blood_inventory%rowtype;
  v_old integer;
  v_new integer;
  v_reason text;
begin
  if v_uid is null then
    raise exception 'BC_UNAUTHORIZED: Not authenticated';
  end if;

  if p_organization_type is distinct from 'HOSPITAL'
     and p_organization_type is distinct from 'BLOOD_BANK' then
    raise exception 'BC_VALIDATION: organization type';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'BC_VALIDATION: delta';
  end if;

  if abs(p_delta) > 10000 then
    raise exception 'BC_VALIDATION: delta bound';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and length(v_reason) > 300 then
    raise exception 'BC_VALIDATION: reason';
  end if;

  if p_organization_type = 'HOSPITAL' then
    if not exists (
      select 1 from user_roles ur
      where ur.user_id = v_uid and ur.role = 'HOSPITAL'::app_role
    ) then
      raise exception 'BC_UNAUTHORIZED: Hospital role required';
    end if;

    select h.id into v_hospital_id
    from hospitals h
    where h.user_id = v_uid;

    if v_hospital_id is null then
      raise exception 'BC_NOT_FOUND: hospital profile';
    end if;

    select * into v_row
    from blood_inventory bi
    where bi.hospital_id = v_hospital_id
      and bi.blood_group = p_blood_group
    for update;

    if not found then
      begin
        insert into blood_inventory (hospital_id, blood_bank_id, blood_group, units_available)
        values (v_hospital_id, null, p_blood_group, 0)
        returning * into v_row;
      exception
        when unique_violation then
          select * into v_row
          from blood_inventory bi
          where bi.hospital_id = v_hospital_id
            and bi.blood_group = p_blood_group
          for update;
      end;
    end if;

  else
    if not exists (
      select 1 from user_roles ur
      where ur.user_id = v_uid and ur.role = 'BLOOD_BANK'::app_role
    ) then
      raise exception 'BC_UNAUTHORIZED: Blood bank role required';
    end if;

    select b.id into v_blood_bank_id
    from blood_banks b
    where b.user_id = v_uid;

    if v_blood_bank_id is null then
      raise exception 'BC_NOT_FOUND: blood bank profile';
    end if;

    select * into v_row
    from blood_inventory bi
    where bi.blood_bank_id = v_blood_bank_id
      and bi.blood_group = p_blood_group
    for update;

    if not found then
      begin
        insert into blood_inventory (hospital_id, blood_bank_id, blood_group, units_available)
        values (null, v_blood_bank_id, p_blood_group, 0)
        returning * into v_row;
      exception
        when unique_violation then
          select * into v_row
          from blood_inventory bi
          where bi.blood_bank_id = v_blood_bank_id
            and bi.blood_group = p_blood_group
          for update;
      end;
    end if;
  end if;

  if v_row.id is null then
    raise exception 'BC_SERVER: inventory row missing after upsert';
  end if;

  v_old := v_row.units_available;
  v_new := v_old + p_delta;

  if v_new < 0 then
    raise exception 'BC_INSUFFICIENT: available=%', v_old;
  end if;

  update blood_inventory
    set units_available = v_new,
        updated_at = now()
  where id = v_row.id
  returning * into v_row;

  insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_uid,
    'INVENTORY_ADJUSTED',
    'blood_inventory',
    v_row.id,
    jsonb_build_object(
      'organizationType', p_organization_type,
      'organizationId', coalesce(v_hospital_id, v_blood_bank_id),
      'bloodGroup', p_blood_group::text,
      'oldUnits', v_old,
      'newUnits', v_new,
      'delta', p_delta,
      'reason', v_reason
    )
  );

  inventory_id := v_row.id;
  blood_group := v_row.blood_group;
  old_units := v_old;
  new_units := v_new;
  units_available := v_row.units_available;
  updated_at := v_row.updated_at;
  return next;
end;
$$;

revoke all on function public.adjust_own_inventory(text, blood_group, integer, text) from public;
revoke all on function public.adjust_own_inventory(text, blood_group, integer, text) from anon;
grant execute on function public.adjust_own_inventory(text, blood_group, integer, text) to authenticated;
