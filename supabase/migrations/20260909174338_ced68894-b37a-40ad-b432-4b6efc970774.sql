create or replace function public.shares_tenant_with(_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships a
    join public.tenant_memberships b on b.tenant_id = a.tenant_id
    where a.user_id = auth.uid() and b.user_id = _user
  )
$$;

revoke execute on function public.shares_tenant_with(uuid) from anon, public;
grant execute on function public.shares_tenant_with(uuid) to authenticated;

create policy "profiles_tenant_read" on public.profiles
for select to authenticated
using (public.shares_tenant_with(id));

create policy "memberships_owner_update" on public.tenant_memberships
for update to authenticated
using (public.has_tenant_role(tenant_id, ARRAY['manager_owner'::tenant_role]))
with check (public.has_tenant_role(tenant_id, ARRAY['manager_owner'::tenant_role]));

drop policy if exists "memberships_admin_delete" on public.tenant_memberships;

create policy "memberships_owner_delete" on public.tenant_memberships
for delete to authenticated
using (public.has_tenant_role(tenant_id, ARRAY['manager_owner'::tenant_role]));