-- Fase 3 — Superadministração: o platform_owner passa a poder agir, e `tenants.status`
-- deixa de ser decorativo.
--
-- Roda inteira de uma vez no SQL editor: mexe só no schema `public`.
--
-- SUSPENSÃO É SOMENTE LEITURA, NÃO BLOQUEIO
--
-- Ambiente suspenso continua legível para quem é membro: a gestora vê os dados dela e
-- entende a situação, em vez de encontrar uma tela vazia. O que ela perde é a escrita.
-- Para bloquear também a leitura, bastaria `can_read_tenant` passar a usar
-- `is_tenant_member` no lugar de `is_tenant_member_raw`.
--
-- POR QUE MEXER EM is_tenant_member EM VEZ DE ESPALHAR CHECAGENS
--
-- Toda política de escrita das 12 tabelas do tenant — e as quatro do bucket
-- `evidencias` — passa por `is_tenant_member`. Colocar a condição de ambiente ativo
-- ali cobre tudo de uma vez, sem depender de alguém lembrar de checar em cada função
-- nova. A alternativa seria repetir a verificação em quinze lugares e torcer.
--
-- A mudança é aditiva: hoje todos os ambientes estão ACTIVE, então o comportamento
-- atual não muda. Só ambientes suspensos passam a se comportar diferente.

-- Membresia sem olhar o status. Existe para a leitura continuar funcionando quando o
-- ambiente está suspenso.
create or replace function public.is_tenant_member_raw(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_memberships m
     where m.tenant_id = _tenant and m.user_id = auth.uid()
  )
$$;

revoke execute on function public.is_tenant_member_raw(uuid) from anon, public;
grant execute on function public.is_tenant_member_raw(uuid) to authenticated;

-- Escrita exige ambiente ativo.
create or replace function public.is_tenant_member(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.tenant_memberships m
      join public.tenants t on t.id = m.tenant_id
     where m.tenant_id = _tenant
       and m.user_id = auth.uid()
       and t.status = 'ACTIVE'
  )
$$;

-- Idem para os papéis administrativos do ambiente. Sem isso, a dona de um ambiente
-- suspenso poderia reativá-lo sozinha pela tela de Configurações.
create or replace function public.has_tenant_role(_tenant uuid, _roles public.tenant_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.tenant_memberships m
      join public.tenants t on t.id = m.tenant_id
     where m.tenant_id = _tenant
       and m.user_id = auth.uid()
       and m.role = any(_roles)
       and t.status = 'ACTIVE'
  )
$$;

-- Leitura ignora o status: membro continua vendo o que é dele.
create or replace function public.can_read_tenant(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_tenant_member_raw(_tenant)
     or public.tenant_is_demo(_tenant)
     or public.has_platform_role(auth.uid(), 'platform_owner')
$$;

-- O superadministrador precisa alterar plano e status. Nenhuma política dava isso a
-- ele: `tenants_admin_update` exige papel dentro do ambiente, e ele não é membro.
create policy "tenants_platform_update" on public.tenants
for update to authenticated
using (public.has_platform_role(auth.uid(), 'platform_owner'))
with check (public.has_platform_role(auth.uid(), 'platform_owner'));

-- Status permitidos. A coluna é texto livre desde a fase 1, e sem isso um erro de
-- digitacao suspenderia um ambiente sem que ninguém percebesse o porquê.
alter table public.tenants
  add constraint tenants_status_valido check (status in ('ACTIVE', 'SUSPENDED'));
