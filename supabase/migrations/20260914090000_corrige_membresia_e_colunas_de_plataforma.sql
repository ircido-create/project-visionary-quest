-- Correção de segurança (2026-09-14), antes da Fase 7.
--
-- DOIS FUROS NAS REGRAS, ACHADOS AO PLANEJAR A ASSINATURA
--
-- 1. `tenant_memberships`: a política de inclusão aceitava `user_id = auth.uid()` sem
--    olhar o ambiente. Qualquer conta logada podia se incluir como `manager_owner` de
--    qualquer ambiente e passar a ler e alterar as candidatas dele. O único uso legítimo
--    da inclusão por conta própria é a criação de ambiente (`createTenant`), em que a
--    criadora vira a primeira dona — os convites nunca incluíram ninguém.
-- 2. `tenants`: a política de atualização deixa dona e administradora mudarem qualquer
--    coluna, e a de inclusão aceita qualquer valor. Uma gestora podia se pôr no plano
--    Premium, reativar o próprio ambiente ou marcá-lo como demonstração.
--
-- O QUE MUDA
--
-- - Inclusão de membro: dona e administradora do ambiente continuam incluindo; por conta
--   própria, só quem criou o ambiente, como dona, e só enquanto ele não tem nenhum membro.
-- - `tenants`: plano, situação, demonstração e criadora só mudam pela administração da
--   plataforma. Na criação por gestora, o banco força Essencial, ativo, não demonstração
--   e a própria usuária como criadora, seja o que for que chegue.
--
-- As checagens que olham `tenants` e `tenant_memberships` ficam em funções `security
-- definer`: a política roda com os olhos de quem está logado, e a criadora ainda não
-- enxerga o ambiente que acabou de criar (nem os membros de outros ambientes).
--
-- Sem usuário no JWT (chave de serviço, tarefas agendadas, SQL editor), o gatilho não
-- interfere.

create or replace function public.pode_ser_primeira_dona(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenants t
     where t.id = _tenant
       and t.created_by = auth.uid()
       and not t.is_demo
       and not exists (select 1 from public.tenant_memberships m where m.tenant_id = _tenant)
  )
$$;

revoke execute on function public.pode_ser_primeira_dona(uuid) from public, anon;
grant execute on function public.pode_ser_primeira_dona(uuid) to authenticated;

drop policy if exists memberships_self_insert on public.tenant_memberships;
drop policy if exists memberships_insert on public.tenant_memberships;
create policy memberships_insert on public.tenant_memberships
  for insert to authenticated
  with check (
    public.has_tenant_role(tenant_id, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role])
    or (
      user_id = auth.uid()
      and role = 'manager_owner'::tenant_role
      and public.pode_ser_primeira_dona(tenant_id)
    )
  );

create or replace function public.proteger_colunas_de_plataforma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.has_platform_role(auth.uid(), 'platform_owner') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_demo := false;
    new.status := 'ACTIVE';
    new.plan_id := (select id from public.plans where code = 'essencial');
    new.created_by := auth.uid();
    return new;
  end if;

  if new.plan_id is distinct from old.plan_id
     or new.status is distinct from old.status
     or new.is_demo is distinct from old.is_demo
     or new.created_by is distinct from old.created_by then
    raise exception 'Plano, situação e tipo do ambiente só mudam pela administração da plataforma.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

revoke execute on function public.proteger_colunas_de_plataforma() from public, anon, authenticated;

drop trigger if exists mcb_protege_colunas_de_plataforma on public.tenants;
create trigger mcb_protege_colunas_de_plataforma
  before insert or update on public.tenants
  for each row execute function public.proteger_colunas_de_plataforma();
