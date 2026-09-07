-- ============================================================================
-- BloodConnect — Phase 1 auth bootstrap
-- ============================================================================
-- Profile rows must exist before user_roles (FK). Creating them from a
-- SECURITY DEFINER trigger on auth.users is idempotent and still works when
-- email confirmation means signUp returns no session (auth.uid() is null).
--
-- ADMIN is never taken from user metadata. Privileged org roles may be
-- selected at registration; they do not grant ADMIN. Verification workflows
-- in later phases can further restrict HOSPITAL / BLOOD_BANK.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'User'),
    nullif(trim(new.raw_user_meta_data->>'phone'), '')
  )
  on conflict (id) do nothing;

  meta_role := new.raw_user_meta_data->>'initial_role';
  if meta_role in ('REQUESTER', 'DONOR', 'HOSPITAL', 'BLOOD_BANK') then
    insert into public.user_roles (user_id, role)
    values (new.id, meta_role::app_role)
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Users may insert their own non-ADMIN roles (registration / retry). They
-- cannot insert ADMIN, and there is still no UPDATE/DELETE policy, so they
-- cannot promote themselves or edit another user's roles.
create policy "user_roles_insert_own_non_admin"
  on user_roles
  for insert
  with check (
    auth.uid() = user_id
    and role <> 'ADMIN'::app_role
  );
