-- Fase 9 — Avisos dentro do app.
--
-- O MCB não envia e-mail próprio (ver roadmap, Pendências: DNS). Para o dia a dia, os
-- avisos aparecem num sininho no painel da gestora e no portal da candidata.
--
-- QUEM RECEBE O QUÊ
--
-- Equipe do ambiente (dona, administradora e equipe):
-- - nova candidatura;
-- - tarefa concluída pela própria candidata no portal (a concluída pela gestora não avisa
--   ninguém: quem concluiu já sabe).
-- Dona e administradora, que são quem audita:
-- - candidata que passou para "Pronta para auditoria" depois da inscrição (quem já chega
--   pronta aparece no aviso de nova candidatura).
-- Candidata com conta no portal:
-- - tarefa nova e feedback novo.
--
-- Os avisos nascem em gatilhos do banco, e não no app: assim valem para todo caminho que
-- cria tarefa, feedback ou mudança de etapa (tela, auditoria, modelos, formulário
-- público). Ambientes de demonstração não geram avisos.
--
-- Várias tarefas criadas de uma vez (sugestões dos modelos) viram um aviso só, com a
-- contagem, enquanto o anterior não for lido.
--
-- Os avisos trazem o nome da candidata; por isso somem com ela (chave com `on delete
-- cascade`) e a limpeza diária apaga os lidos há mais de 30 dias e todos com mais de 90.

create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  influencer_id uuid references public.influencers(id) on delete cascade,
  tipo text not null check (tipo in ('nova_candidatura', 'tarefa_concluida', 'pronta_auditoria', 'tarefa_nova', 'feedback_novo')),
  titulo text not null,
  quantidade integer not null default 1,
  criado_em timestamptz not null default now(),
  lido_em timestamptz
);

create index if not exists avisos_do_usuario_idx on public.avisos (user_id, criado_em desc);

alter table public.avisos enable row level security;
revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to authenticated;
-- Só dá para marcar como lido; nada mais muda pela API.
grant update (lido_em) on public.avisos to authenticated;

drop policy if exists avisos_ler on public.avisos;
create policy avisos_ler on public.avisos
  for select to authenticated using (user_id = auth.uid());

drop policy if exists avisos_marcar_lido on public.avisos;
create policy avisos_marcar_lido on public.avisos
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Gravar um aviso, agrupando com o anterior não lido quando pedido
-- ---------------------------------------------------------------------------
-- `p_titulo_grupo` usa {n} no lugar da contagem ("{n} tarefas novas ...").
create or replace function public.avisar(
  p_user uuid,
  p_tenant uuid,
  p_influencer uuid,
  p_tipo text,
  p_titulo text,
  p_titulo_grupo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
  _n integer;
begin
  if p_user is null then
    return;
  end if;

  if p_titulo_grupo is not null then
    select id, quantidade into _id, _n
      from public.avisos
     where user_id = p_user and tipo = p_tipo and lido_em is null
       and influencer_id is not distinct from p_influencer
     order by criado_em desc
     limit 1;
    if _id is not null then
      update public.avisos
         set quantidade = _n + 1,
             titulo = replace(p_titulo_grupo, '{n}', (_n + 1)::text),
             criado_em = now()
       where id = _id;
      return;
    end if;
  end if;

  insert into public.avisos (user_id, tenant_id, influencer_id, tipo, titulo)
  values (p_user, p_tenant, p_influencer, p_tipo, left(p_titulo, 200));
end
$$;

revoke execute on function public.avisar(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;

create or replace function public.ambiente_gera_avisos(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tenants where id = _tenant and not is_demo)
$$;

revoke execute on function public.ambiente_gera_avisos(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------
create or replace function public.aviso_nova_candidatura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _m record;
begin
  if not public.ambiente_gera_avisos(new.tenant_id) then
    return new;
  end if;
  for _m in
    select user_id from public.tenant_memberships
     where tenant_id = new.tenant_id and role in ('manager_owner', 'manager_admin', 'manager_member')
  loop
    perform public.avisar(_m.user_id, new.tenant_id, new.id, 'nova_candidatura',
                          'Nova candidatura: ' || coalesce(new.full_name, 'sem nome'));
  end loop;
  return new;
end
$$;

create or replace function public.aviso_pronta_para_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _m record;
  _nome text;
begin
  if new.to_status <> 'PRONTA_AUDITORIA' or new.from_status is null
     or new.from_status = 'PRONTA_AUDITORIA'
     or not public.ambiente_gera_avisos(new.tenant_id) then
    return new;
  end if;
  select full_name into _nome from public.influencers where id = new.influencer_id;
  for _m in
    select user_id from public.tenant_memberships
     where tenant_id = new.tenant_id and role in ('manager_owner', 'manager_admin')
  loop
    perform public.avisar(_m.user_id, new.tenant_id, new.influencer_id, 'pronta_auditoria',
                          'Pronta para auditoria: ' || coalesce(_nome, 'candidata'));
  end loop;
  return new;
end
$$;

create or replace function public.aviso_tarefa_concluida_pela_candidata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _m record;
  _nome text;
  _dona_da_tarefa uuid;
begin
  if new.status <> 'CONCLUIDA' or old.status = 'CONCLUIDA' or new.influencer_id is null
     or not public.ambiente_gera_avisos(new.tenant_id) then
    return new;
  end if;
  select full_name, user_id into _nome, _dona_da_tarefa from public.influencers where id = new.influencer_id;
  -- Só quando quem concluiu foi a própria candidata, pelo portal.
  if _dona_da_tarefa is null or auth.uid() is distinct from _dona_da_tarefa then
    return new;
  end if;
  for _m in
    select user_id from public.tenant_memberships
     where tenant_id = new.tenant_id and role in ('manager_owner', 'manager_admin', 'manager_member')
  loop
    perform public.avisar(_m.user_id, new.tenant_id, new.influencer_id, 'tarefa_concluida',
                          coalesce(_nome, 'A candidata') || ' concluiu: ' || new.title,
                          coalesce(_nome, 'A candidata') || ' concluiu {n} tarefas');
  end loop;
  return new;
end
$$;

create or replace function public.aviso_tarefa_nova()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _candidata uuid;
begin
  if new.influencer_id is null or not public.ambiente_gera_avisos(new.tenant_id) then
    return new;
  end if;
  select user_id into _candidata from public.influencers where id = new.influencer_id;
  perform public.avisar(_candidata, new.tenant_id, new.influencer_id, 'tarefa_nova',
                        'Nova tarefa: ' || new.title,
                        '{n} tarefas novas no seu acompanhamento');
  return new;
end
$$;

create or replace function public.aviso_feedback_novo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _candidata uuid;
begin
  if not public.ambiente_gera_avisos(new.tenant_id) then
    return new;
  end if;
  select user_id into _candidata from public.influencers where id = new.influencer_id;
  perform public.avisar(_candidata, new.tenant_id, new.influencer_id, 'feedback_novo',
                        'Novo feedback da sua gestora',
                        '{n} feedbacks novos da sua gestora');
  return new;
end
$$;

revoke execute on function public.aviso_nova_candidatura() from public, anon, authenticated;
revoke execute on function public.aviso_pronta_para_auditoria() from public, anon, authenticated;
revoke execute on function public.aviso_tarefa_concluida_pela_candidata() from public, anon, authenticated;
revoke execute on function public.aviso_tarefa_nova() from public, anon, authenticated;
revoke execute on function public.aviso_feedback_novo() from public, anon, authenticated;

drop trigger if exists mcb_aviso_nova_candidatura on public.influencers;
create trigger mcb_aviso_nova_candidatura
  after insert on public.influencers
  for each row execute function public.aviso_nova_candidatura();

drop trigger if exists mcb_aviso_pronta_para_auditoria on public.status_history;
create trigger mcb_aviso_pronta_para_auditoria
  after insert on public.status_history
  for each row execute function public.aviso_pronta_para_auditoria();

drop trigger if exists mcb_aviso_tarefa_concluida on public.tasks;
create trigger mcb_aviso_tarefa_concluida
  after update of status on public.tasks
  for each row execute function public.aviso_tarefa_concluida_pela_candidata();

drop trigger if exists mcb_aviso_tarefa_nova on public.tasks;
create trigger mcb_aviso_tarefa_nova
  after insert on public.tasks
  for each row execute function public.aviso_tarefa_nova();

drop trigger if exists mcb_aviso_feedback_novo on public.feedbacks;
create trigger mcb_aviso_feedback_novo
  after insert on public.feedbacks
  for each row execute function public.aviso_feedback_novo();

-- ---------------------------------------------------------------------------
-- Limpeza diária
-- ---------------------------------------------------------------------------
select cron.schedule(
  'mcb-limpeza-avisos',
  '30 6 * * *',
  $$delete from public.avisos where (lido_em is not null and lido_em < now() - interval '30 days') or criado_em < now() - interval '90 days'$$
);
