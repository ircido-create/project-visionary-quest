-- Fase 2 (item 3) — Portal da candidata.
--
-- Roda inteira de uma vez no SQL editor: mexe só no schema `public`.
--
-- POR QUE FUNÇÃO EM VEZ DE POLÍTICA
--
-- As políticas da fase 1 dão a qualquer membro do ambiente leitura de tudo do
-- ambiente, em 12 tabelas — incluindo `notes`, que são as notas internas da gestora
-- sobre as candidatas. Dar membresia à candidata (mesmo com o papel `influencer`)
-- faria cada uma enxergar os dados de todas as outras.
--
-- Então a candidata **não é membro**. Ela acessa por estas três funções, que rodam
-- com privilégio elevado e filtram por `influencers.user_id = auth.uid()`. A vantagem
-- sobre políticas espalhadas: existe um lugar só definindo o que ela vê, e o que não
-- está listado aqui não é alcançável.
--
-- O que a candidata NÃO vê, de propósito: notes (notas internas), ai_analyses
-- (leitura da IA, que é insumo da gestora), audit_logs, files de qualquer candidata,
-- e qualquer dado de outra candidata.

-- Preenche influencers.user_id no primeiro acesso, casando pelo e-mail usado na
-- Porta de Entrada. Devolve quantos registros foram vinculados.
--
-- ATENÇÃO: a segurança disto depende da confirmação de e-mail estar ativa no
-- Supabase. Sem ela, qualquer pessoa que se cadastre com o e-mail de uma candidata
-- assume o registro dela. A checagem de email_confirmed_at abaixo é a defesa que dá
-- para fazer daqui — se a confirmação estiver desligada, o Supabase preenche esse
-- campo sozinho no cadastro e a checagem passa a não proteger nada.
create or replace function public.link_influencer_account()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text;
  _confirmed timestamptz;
  _count integer;
begin
  select lower(u.email), u.email_confirmed_at
    into _email, _confirmed
    from auth.users u
   where u.id = auth.uid();

  if _email is null or _confirmed is null then
    return 0;
  end if;

  -- A mesma pessoa pode ter se candidatado a mais de uma gestora; todas as linhas
  -- com aquele e-mail e ainda sem dono passam a ser dela.
  update public.influencers
     set user_id = auth.uid()
   where lower(email) = _email
     and user_id is null;

  get diagnostics _count = row_count;
  return _count;
end
$$;

-- Tudo que o portal mostra, numa chamada. O que não está neste json não é exposto.
create or replace function public.get_portal_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _result jsonb;
begin
  select coalesce(jsonb_agg(candidatura order by candidatura->>'criada_em' desc), '[]'::jsonb)
    into _result
    from (
      select jsonb_build_object(
        'id', i.id,
        'gestora', t.name,
        'nome', i.full_name,
        'status', i.status,
        'nivel', i.level,
        'progresso', i.progress_score,
        'criada_em', i.created_at,
        'metricas', jsonb_build_object(
          'seguidores', i.followers,
          'publicacoes', i.posts_count,
          'publico_feminino_pct', i.female_audience_pct
        ),
        'tarefas', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', k.id, 'titulo', k.title, 'status', k.status,
            'prioridade', k.priority, 'prazo', k.due_date
          ) order by k.due_date nulls last)
          from public.tasks k where k.influencer_id = i.id
        ), '[]'::jsonb),
        'evolucao', coalesce((
          select jsonb_agg(jsonb_build_object(
            'data', s.captured_at, 'seguidores', s.followers, 'publicacoes', s.posts_count
          ) order by s.captured_at)
          from public.metric_snapshots s where s.influencer_id = i.id
        ), '[]'::jsonb),
        'feedbacks', coalesce((
          select jsonb_agg(jsonb_build_object('texto', f.body, 'data', f.created_at)
                           order by f.created_at desc)
          from public.feedbacks f where f.influencer_id = i.id
        ), '[]'::jsonb)
      ) as candidatura
      from public.influencers i
      join public.tenants t on t.id = i.tenant_id
      where i.user_id = auth.uid()
        and i.archived_at is null
    ) as candidaturas;

  return _result;
end
$$;

-- A candidata marca a própria tarefa. Função em vez de política de UPDATE porque RLS
-- não restringe colunas: com update direto ela poderia reescrever o título da tarefa
-- que a gestora criou. Aqui, só o status muda.
create or replace function public.influencer_set_task_status(_task uuid, _status public.task_status)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _updated integer;
begin
  update public.tasks k
     set status = _status
   where k.id = _task
     and exists (
       select 1 from public.influencers i
        where i.id = k.influencer_id
          and i.user_id = auth.uid()
     );

  get diagnostics _updated = row_count;
  return _updated > 0;
end
$$;

revoke execute on function public.link_influencer_account() from anon, public;
revoke execute on function public.get_portal_data() from anon, public;
revoke execute on function public.influencer_set_task_status(uuid, public.task_status) from anon, public;

grant execute on function public.link_influencer_account() to authenticated;
grant execute on function public.get_portal_data() to authenticated;
grant execute on function public.influencer_set_task_status(uuid, public.task_status) to authenticated;

-- Um e-mail pode ter várias candidaturas (gestoras diferentes), então o índice não é
-- único; ele existe para o filtro por dono ficar barato.
create index if not exists idx_influencers_user on public.influencers(user_id)
  where user_id is not null;
