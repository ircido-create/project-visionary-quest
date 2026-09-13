-- Fase 6 — Exclusão automática de candidatas sem atividade há 90 dias.
--
-- Roda inteira de uma vez no SQL editor. Decisão de 2026-09-13 (revisão da Política de
-- Privacidade, ponto P5): os dados de uma candidatura sem nenhuma atividade por 90 dias
-- são excluídos. A gestora vê o aviso no painel 15 dias antes.
--
-- O QUE CONTA COMO ATIVIDADE
--
-- Qualquer ação da gestora ou da candidata que deixa rastro no banco: o cadastro mudar
-- (`influencers.updated_at`, mantido por gatilho), mudança de etapa, números registrados,
-- tarefa criada, mexida ou concluída, nota, feedback, print, avaliação, inscrição e o
-- último acesso da candidata ao portal.
--
-- O QUE A LIMPEZA NÃO FAZ
--
-- - Não toca ambientes de demonstração: as candidatas de exemplo sumiriam.
-- - Não apaga candidatas com arquivos de evidência. Pelo banco dá para apagar a linha do
--   arquivo, mas não o arquivo no Storage; essas aparecem na administração, para a
--   exclusão pela ferramenta que também apaga o arquivo.
--
-- A exclusão usa a mesma `excluir_candidata` da exclusão a pedido. A ação gravada no log
-- passa a vir do contexto da transação: a limpeza registra
-- `candidata.excluida_por_inatividade`; o pedido manual continua
-- `candidata.excluida_a_pedido`.

create extension if not exists pg_cron;

create or replace function public.excluir_candidata(p_influencer_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant uuid;
  _usuario uuid;
  _segredo uuid;
  _contagem jsonb;
  _acao text := coalesce(nullif(current_setting('mcb.acao_exclusao', true), ''), 'candidata.excluida_a_pedido');
begin
  select tenant_id, user_id into _tenant, _usuario
    from public.influencers where id = p_influencer_id;
  if _tenant is null then
    raise exception 'Candidata não encontrada.' using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'inscricoes',           (select count(*) from public.applications where influencer_id = p_influencer_id),
    'consentimentos',       (select count(*) from public.consent_logs where influencer_id = p_influencer_id),
    'tarefas',              (select count(*) from public.tasks where influencer_id = p_influencer_id),
    'notas',                (select count(*) from public.notes where influencer_id = p_influencer_id),
    'feedbacks',            (select count(*) from public.feedbacks where influencer_id = p_influencer_id),
    'registros_de_numeros', (select count(*) from public.metric_snapshots where influencer_id = p_influencer_id),
    'avaliacoes',           (select count(*) from public.qualification_results where influencer_id = p_influencer_id),
    'historico',            (select count(*) from public.status_history where influencer_id = p_influencer_id),
    'analises_ia',          (select count(*) from public.ai_analyses where influencer_id = p_influencer_id),
    'arquivos',             (select count(*) from public.files where influencer_id = p_influencer_id)
  ) into _contagem;

  select token_secret_id into _segredo
    from public.instagram_connections where influencer_id = p_influencer_id;
  if _segredo is not null then
    delete from vault.secrets where id = _segredo;
  end if;

  delete from public.influencers where id = p_influencer_id;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (_tenant, p_actor, _acao, 'influencers', p_influencer_id,
          _contagem || jsonb_build_object('instagram', _segredo is not null));

  return _contagem || jsonb_build_object('tenant_id', _tenant, 'user_id', _usuario);
end
$$;

revoke execute on function public.excluir_candidata(uuid, uuid) from public, anon, authenticated;
grant execute on function public.excluir_candidata(uuid, uuid) to service_role;

-- A data mais recente de qualquer atividade da candidata. `greatest` ignora os nulos.
create or replace function public.ultima_atividade_candidata(p_influencer_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    i.created_at,
    i.updated_at,
    (select max(created_at) from public.status_history where influencer_id = i.id),
    (select max(captured_at) from public.metric_snapshots where influencer_id = i.id),
    (select max(greatest(updated_at, coalesce(completed_at, updated_at))) from public.tasks where influencer_id = i.id),
    (select max(created_at) from public.notes where influencer_id = i.id),
    (select max(created_at) from public.feedbacks where influencer_id = i.id),
    (select max(created_at) from public.files where influencer_id = i.id),
    (select max(computed_at) from public.qualification_results where influencer_id = i.id),
    (select max(submitted_at) from public.applications where influencer_id = i.id),
    (select u.last_sign_in_at from auth.users u where u.id = i.user_id)
  )
  from public.influencers i
  where i.id = p_influencer_id
$$;

revoke execute on function public.ultima_atividade_candidata(uuid) from public, anon, authenticated;

-- Para o aviso no painel: candidatas do ambiente que entram na janela de aviso. Só quem lê
-- o ambiente recebe algo (`can_read_tenant`).
create or replace function public.candidatas_perto_da_exclusao(p_tenant uuid, p_dias_aviso integer default 15)
returns table (influencer_id uuid, nome text, ultima_atividade timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.full_name, public.ultima_atividade_candidata(i.id)
    from public.influencers i
    join public.tenants t on t.id = i.tenant_id
   where i.tenant_id = p_tenant
     and not t.is_demo
     and public.can_read_tenant(p_tenant)
     and public.ultima_atividade_candidata(i.id) < now() - make_interval(days => 90 - p_dias_aviso)
   order by 3
$$;

revoke execute on function public.candidatas_perto_da_exclusao(uuid, integer) from public, anon;
grant execute on function public.candidatas_perto_da_exclusao(uuid, integer) to authenticated;

-- Para a administração: vencidas que a limpeza pula por terem arquivos. Só a dona da
-- plataforma recebe algo.
create or replace function public.candidatas_inativas_com_arquivos()
returns table (influencer_id uuid, nome text, email text, ambiente text, ultima_atividade timestamptz, arquivos bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.full_name, i.email, t.name, public.ultima_atividade_candidata(i.id),
         (select count(*) from public.files f where f.influencer_id = i.id)
    from public.influencers i
    join public.tenants t on t.id = i.tenant_id
   where not t.is_demo
     and public.has_platform_role(auth.uid(), 'platform_owner')
     and exists (select 1 from public.files f where f.influencer_id = i.id)
     and public.ultima_atividade_candidata(i.id) < now() - interval '90 days'
   order by 5
$$;

revoke execute on function public.candidatas_inativas_com_arquivos() from public, anon;
grant execute on function public.candidatas_inativas_com_arquivos() to authenticated;

-- A limpeza diária. Devolve quantas candidatas excluiu.
create or replace function public.limpar_candidatas_inativas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
  _n integer := 0;
begin
  perform set_config('mcb.acao_exclusao', 'candidata.excluida_por_inatividade', true);
  for _id in
    select i.id
      from public.influencers i
      join public.tenants t on t.id = i.tenant_id
     where not t.is_demo
       and not exists (select 1 from public.files f where f.influencer_id = i.id)
       and public.ultima_atividade_candidata(i.id) < now() - interval '90 days'
  loop
    perform public.excluir_candidata(_id, null);
    _n := _n + 1;
  end loop;
  perform set_config('mcb.acao_exclusao', '', true);
  return _n;
end
$$;

revoke execute on function public.limpar_candidatas_inativas() from public, anon, authenticated;

-- Todo dia às 06h UTC (03h em Brasília). Agendar de novo com o mesmo nome substitui.
select cron.schedule('mcb-limpeza-inatividade', '0 6 * * *', $$select public.limpar_candidatas_inativas()$$);
