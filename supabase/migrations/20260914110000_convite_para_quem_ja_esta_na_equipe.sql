-- Convite para quem já está na equipe (achado no teste de ponta a ponta de 2026-09-14).
--
-- Convidar um e-mail que já fazia parte da equipe gravava o convite, que ocupava vaga do
-- plano e era "aceito" na entrada seguinte sem mudar nada. Agora o banco recusa, e o app
-- mostra "Essa pessoa já faz parte da equipe." antes de tentar.
--
-- A comparação é com o e-mail da conta (`auth.users`), não o do perfil: conta criada por
-- e-mail e senha não ganha perfil sozinha. Para não virar um jeito de descobrir quem tem
-- conta, a função só responde a dona e administradora do ambiente — as mesmas que podem
-- convidar.

create or replace function public.email_ja_na_equipe(_tenant uuid, _email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_tenant_role(_tenant, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role])
     and exists (
       select 1 from public.tenant_memberships m
         join auth.users u on u.id = m.user_id
        where m.tenant_id = _tenant and lower(u.email) = lower(trim(_email))
     )
$$;

revoke execute on function public.email_ja_na_equipe(uuid, text) from public, anon;
grant execute on function public.email_ja_na_equipe(uuid, text) to authenticated;

drop policy if exists invitations_admin_write on public.invitations;
create policy invitations_admin_write on public.invitations
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role])
              and role in ('manager_admin', 'manager_member')
              and not public.email_ja_na_equipe(tenant_id, email));

-- O app grava convite por upsert: reenviar para o mesmo e-mail cai aqui.
drop policy if exists invitations_admin_update on public.invitations;
create policy invitations_admin_update on public.invitations
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role]))
  with check (public.has_tenant_role(tenant_id, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role])
              and role in ('manager_admin', 'manager_member')
              and not public.email_ja_na_equipe(tenant_id, email));
