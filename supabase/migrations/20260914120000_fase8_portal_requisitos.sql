-- Fase 8 — O portal da candidata mostra o que falta.
--
-- O portal já recebia seguidores, publicações e público feminino. Para calcular os cinco
-- requisitos com o mesmo motor da página da gestora (`evaluateQualification`, no servidor
-- do app), faltavam o tipo de perfil, a recência das 12 últimas publicações, a origem do
-- número e a data da última atualização. Só isso entra.
--
-- De propósito, não entra a última avaliação gravada (`qualification_results`): ela
-- pode estar atrás do cadastro — a correção do perfil pela gestora recalcula o índice
-- sem gravar avaliação nova — e traz a decisão de auditoria, a nota e o autor, que são
-- internos da gestora.
--
-- `create or replace` preserva as permissões da função.

create or replace function public.get_portal_data()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _result jsonb;
begin
  select coalesce(jsonb_agg(candidatura order by candidatura->>'criada_em' desc), '[]'::jsonb) into _result
    from (
      select jsonb_build_object(
        'id', i.id, 'gestora', t.name, 'nome', i.full_name, 'status', i.status,
        'nivel', i.level, 'progresso', i.progress_score, 'criada_em', i.created_at,
        'metricas', jsonb_build_object(
          'seguidores', i.followers,
          'publicacoes', i.posts_count,
          'publico_feminino_pct', i.female_audience_pct,
          'recentes_6m', i.recent_posts_6m,
          'tipo_perfil', i.profile_type,
          'fonte', i.data_source,
          'atualizado_em', i.updated_at
        ),
        'tarefas', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'titulo', k.title, 'status', k.status, 'prioridade', k.priority, 'prazo', k.due_date) order by k.due_date nulls last) from public.tasks k where k.influencer_id = i.id), '[]'::jsonb),
        'evolucao', coalesce((select jsonb_agg(jsonb_build_object('data', s.captured_at, 'seguidores', s.followers, 'publicacoes', s.posts_count) order by s.captured_at) from public.metric_snapshots s where s.influencer_id = i.id), '[]'::jsonb),
        'feedbacks', coalesce((select jsonb_agg(jsonb_build_object('texto', f.body, 'data', f.created_at) order by f.created_at desc) from public.feedbacks f where f.influencer_id = i.id), '[]'::jsonb)
      ) as candidatura
      from public.influencers i
      join public.tenants t on t.id = i.tenant_id
      where i.user_id = auth.uid() and i.archived_at is null
    ) as candidaturas;
  return _result;
end $function$;
