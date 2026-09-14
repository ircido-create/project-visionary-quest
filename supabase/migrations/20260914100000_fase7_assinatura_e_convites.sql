-- Fase 7 — Assinatura sem cobrança online, e convites de equipe que funcionam.
--
-- Decisões de 2026-09-14:
-- - ambiente criado por gestora nasce com 14 dias de avaliação no Essencial;
-- - aviso no painel a partir de 5 dias antes do vencimento; vencido, mais 3 dias de
--   tolerância; depois, só leitura (a suspensão que já existe) e a página para de
--   receber candidaturas; o pagamento registrado reativa na hora;
-- - pagamento combinado pelo contato; a administração registra o "pago até";
-- - cancelamento pela dona: vale até o fim do período; na primeira contratação, em até
--   7 dias do pagamento, é arrependimento — o período acaba na hora e o valor é devolvido
--   (a devolução é feita pela MCB, fora do sistema);
-- - aviso por e-mail feito pela dona da plataforma, a partir da lista da administração.
--
-- Os ambientes que existiam antes desta migração (o da dona da plataforma e as
-- demonstrações) ficam isentos. O corte é por data fixa, e não "todos os atuais", para
-- que reaplicar a migração depois não isente ambientes novos.

-- ---------------------------------------------------------------------------
-- Colunas da assinatura
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists cobranca text not null default 'AVALIACAO',
  add column if not exists vence_em timestamptz default (now() + interval '14 days'),
  add column if not exists cancelada_em timestamptz,
  add column if not exists suspensao_motivo text;

alter table public.tenants drop constraint if exists tenants_cobranca_check;
alter table public.tenants add constraint tenants_cobranca_check
  check (cobranca in ('AVALIACAO', 'PAGA', 'CANCELADA', 'ISENTA'));
alter table public.tenants drop constraint if exists tenants_suspensao_motivo_check;
alter table public.tenants add constraint tenants_suspensao_motivo_check
  check (suspensao_motivo is null or suspensao_motivo in ('VENCIMENTO', 'ADMINISTRACAO'));

update public.tenants set cobranca = 'ISENTA', vence_em = null
 where created_at < timestamptz '2026-09-14 12:00:00+00';
update public.tenants set suspensao_motivo = 'ADMINISTRACAO'
 where status = 'SUSPENDED' and suspensao_motivo is null;

-- ---------------------------------------------------------------------------
-- Pagamentos registrados pela administração
-- ---------------------------------------------------------------------------
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  valor_centavos integer not null check (valor_centavos >= 0),
  periodo_inicio timestamptz not null,
  periodo_fim timestamptz not null,
  forma text not null default 'combinado',
  observacao text,
  registrado_por uuid,
  registrado_em timestamptz not null default now()
);

create index if not exists pagamentos_tenant_idx on public.pagamentos (tenant_id, registrado_em);

alter table public.pagamentos enable row level security;
revoke all on public.pagamentos from anon, authenticated;
grant select on public.pagamentos to authenticated;

-- Membro lê o histórico do próprio ambiente, mesmo suspenso (por isso a versão "raw").
drop policy if exists pagamentos_ler on public.pagamentos;
create policy pagamentos_ler on public.pagamentos
  for select to authenticated
  using (public.is_tenant_member_raw(tenant_id) or public.has_platform_role(auth.uid(), 'platform_owner'));

-- ---------------------------------------------------------------------------
-- Colunas de plataforma: o gatilho passa a cobrir a assinatura
-- ---------------------------------------------------------------------------
-- As funções abaixo mudam a assinatura em nome de quem está logado (a dona cancela).
-- Elas ligam `mcb.assinatura` só durante a própria transação; a API não expõe
-- `set_config`, então quem chama pela API não consegue ligar isso sozinho.
create or replace function public.proteger_colunas_de_plataforma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or public.has_platform_role(auth.uid(), 'platform_owner')
     or coalesce(current_setting('mcb.assinatura', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_demo := false;
    new.status := 'ACTIVE';
    new.plan_id := (select id from public.plans where code = 'essencial');
    new.created_by := auth.uid();
    new.cobranca := 'AVALIACAO';
    new.vence_em := now() + interval '14 days';
    new.cancelada_em := null;
    new.suspensao_motivo := null;
    return new;
  end if;

  if new.plan_id is distinct from old.plan_id
     or new.status is distinct from old.status
     or new.is_demo is distinct from old.is_demo
     or new.created_by is distinct from old.created_by
     or new.cobranca is distinct from old.cobranca
     or new.vence_em is distinct from old.vence_em
     or new.cancelada_em is distinct from old.cancelada_em
     or new.suspensao_motivo is distinct from old.suspensao_motivo then
    raise exception 'Plano, situação e assinatura do ambiente só mudam pela administração da plataforma.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

revoke execute on function public.proteger_colunas_de_plataforma() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registrar pagamento (administração)
-- ---------------------------------------------------------------------------
-- O período novo começa no fim do atual, se ainda não venceu (quem paga durante a
-- avaliação não perde os dias dela), ou agora, se já venceu.
create or replace function public.registrar_pagamento(
  p_tenant uuid,
  p_valor_centavos integer,
  p_meses integer,
  p_forma text,
  p_observacao text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  _t public.tenants;
  _inicio timestamptz;
  _fim timestamptz;
begin
  if not public.has_platform_role(auth.uid(), 'platform_owner') then
    raise exception 'Só a administração da plataforma registra pagamentos.' using errcode = '42501';
  end if;
  if p_meses is null or p_meses < 1 or p_meses > 12 then
    raise exception 'Informe de 1 a 12 meses.';
  end if;
  if p_valor_centavos is null or p_valor_centavos < 0 then
    raise exception 'Informe o valor pago.';
  end if;

  select * into _t from public.tenants where id = p_tenant for update;
  if not found then
    raise exception 'Ambiente não encontrado.';
  end if;

  _inicio := greatest(coalesce(_t.vence_em, now()), now());
  _fim := _inicio + make_interval(months => p_meses);

  insert into public.pagamentos (tenant_id, valor_centavos, periodo_inicio, periodo_fim, forma, observacao, registrado_por)
  values (p_tenant, p_valor_centavos, _inicio, _fim,
          coalesce(nullif(trim(p_forma), ''), 'combinado'), nullif(trim(p_observacao), ''), auth.uid());

  update public.tenants
     set cobranca = 'PAGA',
         vence_em = _fim,
         cancelada_em = null,
         status = case when _t.status = 'SUSPENDED' and _t.suspensao_motivo = 'VENCIMENTO' then 'ACTIVE' else status end,
         suspensao_motivo = case when _t.suspensao_motivo = 'VENCIMENTO' then null else suspensao_motivo end
   where id = p_tenant;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (p_tenant, auth.uid(), 'platform.pagamento_registrado', 'tenants', p_tenant,
          jsonb_build_object('valor_centavos', p_valor_centavos, 'meses', p_meses, 'ate', _fim,
                             'reativou', _t.status = 'SUSPENDED' and _t.suspensao_motivo = 'VENCIMENTO'));
  return _fim;
end
$$;

revoke execute on function public.registrar_pagamento(uuid, integer, integer, text, text) from public, anon;
grant execute on function public.registrar_pagamento(uuid, integer, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancelar a assinatura (dona do ambiente)
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_assinatura(p_tenant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _t public.tenants;
  _pagamentos integer;
  _primeiro timestamptz;
  _arrependimento boolean;
  _vale_ate timestamptz;
begin
  if not public.has_tenant_role(p_tenant, array['manager_owner'::tenant_role]) then
    raise exception 'Só a dona do ambiente cancela a assinatura.' using errcode = '42501';
  end if;

  select * into _t from public.tenants where id = p_tenant for update;
  if _t.is_demo or _t.cobranca not in ('AVALIACAO', 'PAGA') then
    raise exception 'Este ambiente não tem assinatura ativa para cancelar.';
  end if;

  select count(*), min(registrado_em) into _pagamentos, _primeiro
    from public.pagamentos where tenant_id = p_tenant;
  _arrependimento := _pagamentos = 1 and _primeiro > now() - interval '7 days';
  _vale_ate := case when _arrependimento then now() else _t.vence_em end;

  perform set_config('mcb.assinatura', 'on', true);
  update public.tenants
     set cobranca = 'CANCELADA', cancelada_em = now(), vence_em = _vale_ate
   where id = p_tenant;
  perform set_config('mcb.assinatura', '', true);

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (p_tenant, auth.uid(), 'assinatura.cancelada', 'tenants', p_tenant,
          jsonb_build_object('arrependimento', _arrependimento, 'vale_ate', _vale_ate, 'cobranca_anterior', _t.cobranca));

  return jsonb_build_object('arrependimento', _arrependimento, 'vale_ate', _vale_ate);
end
$$;

revoke execute on function public.cancelar_assinatura(uuid) from public, anon;
grant execute on function public.cancelar_assinatura(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Suspensão diária dos vencidos
-- ---------------------------------------------------------------------------
-- Avaliação e mês pago: 3 dias de tolerância depois do vencimento. Cancelada: suspende
-- no fim do período, sem tolerância. Isentos e demonstrações nunca.
create or replace function public.suspender_vencidos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _n integer;
begin
  with alvo as (
    select id, cobranca from public.tenants
     where not is_demo
       and status = 'ACTIVE'
       and vence_em is not null
       and ((cobranca in ('AVALIACAO', 'PAGA') and vence_em + interval '3 days' < now())
         or (cobranca = 'CANCELADA' and vence_em < now()))
  ), suspensos as (
    update public.tenants t
       set status = 'SUSPENDED', suspensao_motivo = 'VENCIMENTO'
      from alvo
     where t.id = alvo.id
    returning t.id, alvo.cobranca
  )
  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  select id, null, 'platform.suspenso_por_vencimento', 'tenants', id, jsonb_build_object('cobranca', cobranca)
    from suspensos;
  get diagnostics _n = row_count;
  return _n;
end
$$;

revoke execute on function public.suspender_vencidos() from public, anon, authenticated;

select cron.schedule('mcb-suspensao-por-vencimento', '15 6 * * *', $$select public.suspender_vencidos()$$);

-- ---------------------------------------------------------------------------
-- Contato das donas, para a lista de vencimentos da administração
-- ---------------------------------------------------------------------------
-- A administração não é membro dos ambientes e não lê os membros deles pela API.
create or replace function public.plataforma_contatos_das_donas()
returns table (tenant_id uuid, nome text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select m.tenant_id, p.full_name, coalesce(p.email, u.email)
    from public.tenant_memberships m
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
   where m.role = 'manager_owner'
     and public.has_platform_role(auth.uid(), 'platform_owner')
$$;

revoke execute on function public.plataforma_contatos_das_donas() from public, anon;
grant execute on function public.plataforma_contatos_das_donas() to authenticated;

-- ---------------------------------------------------------------------------
-- Convites de equipe
-- ---------------------------------------------------------------------------
-- Até aqui o convite era gravado e nada o aceitava. Agora, quem entra com o e-mail
-- convidado (confirmado) passa a fazer parte da equipe com o papel do convite. O limite
-- do plano já foi conferido ao convidar (convite pendente ocupa vaga). Convite para
-- "dona" nunca é aceito: dona é quem cria o ambiente.
create or replace function public.aceitar_convites_pendentes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text;
  _convite record;
  _n integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select lower(email) into _email
    from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if _email is null then
    return 0;
  end if;

  for _convite in
    select i.id, i.tenant_id, i.role
      from public.invitations i
      join public.tenants t on t.id = i.tenant_id
     where lower(i.email) = _email
       and i.accepted_at is null
       and (i.expires_at is null or i.expires_at > now())
       and i.role in ('manager_admin', 'manager_member')
       and t.status = 'ACTIVE'
       and not t.is_demo
  loop
    if not exists (select 1 from public.tenant_memberships m
                    where m.tenant_id = _convite.tenant_id and m.user_id = auth.uid()) then
      insert into public.tenant_memberships (tenant_id, user_id, role)
      values (_convite.tenant_id, auth.uid(), _convite.role);
    end if;
    update public.invitations set accepted_at = now() where id = _convite.id;
    insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
    values (_convite.tenant_id, auth.uid(), 'equipe.convite_aceito', 'invitations', _convite.id,
            jsonb_build_object('papel', _convite.role));
    _n := _n + 1;
  end loop;
  return _n;
end
$$;

revoke execute on function public.aceitar_convites_pendentes() from public, anon;
grant execute on function public.aceitar_convites_pendentes() to authenticated;

-- Convite só é criado, alterado ou apagado por dona e administradora (antes: qualquer
-- membro, com qualquer papel).
drop policy if exists invitations_member_write on public.invitations;
drop policy if exists invitations_member_update on public.invitations;
drop policy if exists invitations_member_delete on public.invitations;
drop policy if exists invitations_admin_write on public.invitations;
drop policy if exists invitations_admin_update on public.invitations;
drop policy if exists invitations_admin_delete on public.invitations;
create policy invitations_admin_write on public.invitations
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role])
              and role in ('manager_admin', 'manager_member'));
create policy invitations_admin_update on public.invitations
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role]))
  with check (public.has_tenant_role(tenant_id, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role])
              and role in ('manager_admin', 'manager_member'));
create policy invitations_admin_delete on public.invitations
  for delete to authenticated
  using (public.has_tenant_role(tenant_id, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role]));
