CREATE OR REPLACE FUNCTION public.get_portal_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _result jsonb;
begin
  select coalesce(jsonb_agg(candidatura order by candidatura->>'criada_em' desc), '[]'::jsonb) into _result
    from (
      select jsonb_build_object(
        'id', i.id, 'gestora', t.name, 'modulo', t.module, 'nome', i.full_name,
        'instagram', i.instagram_handle, 'status', i.status, 'nivel', i.level,
        'progresso', i.progress_score, 'criada_em', i.created_at,
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
end
$function$;

CREATE OR REPLACE FUNCTION public.instagram_record_sync(p_influencer_id uuid, p_followers integer, p_posts integer, p_female numeric, p_level text, p_score numeric, p_status text, p_rule_set_version text, p_requirements jsonb, p_progress jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _tenant_id uuid; _female numeric; _module text;
begin
  if not public.is_influencer_owner(p_influencer_id) then
    raise exception 'Só a própria afiliada pode sincronizar o Instagram dela.' using errcode = 'insufficient_privilege';
  end if;
  select i.tenant_id, coalesce(p_female, i.female_audience_pct), t.module
    into _tenant_id, _female, _module
    from public.influencers i
    join public.tenants t on t.id = i.tenant_id
   where i.id = p_influencer_id;

  if _module = 'ONBIO' then
    update public.influencers
       set followers = p_followers, posts_count = p_posts, female_audience_pct = _female,
           data_source = 'META_API'
     where id = p_influencer_id;
  else
    update public.influencers
       set followers = p_followers, posts_count = p_posts, female_audience_pct = _female,
           data_source = 'META_API', level = p_level, progress_score = p_score
     where id = p_influencer_id;
    insert into public.qualification_results
      (tenant_id, influencer_id, rule_set_version, status, requirements, progress)
    values (_tenant_id, p_influencer_id, p_rule_set_version, p_status::qualification_status, p_requirements, p_progress);
  end if;

  insert into public.metric_snapshots
    (tenant_id, influencer_id, followers, posts_count, female_audience_pct, source, created_by)
  values (_tenant_id, p_influencer_id, p_followers, p_posts, _female, 'META_API', auth.uid());
  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (_tenant_id, auth.uid(), 'instagram.sincronizado', 'influencers', p_influencer_id,
          jsonb_build_object('seguidores', p_followers, 'publicacoes', p_posts, 'publico_feminino', _female));
  update public.instagram_connections set last_sync_at = now(), last_sync_error = null
   where influencer_id = p_influencer_id;
end
$function$;