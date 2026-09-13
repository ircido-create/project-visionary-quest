-- Fase 6 — Exclusão de dados a pedido (LGPD).
--
-- Roda inteira de uma vez no SQL editor: cria uma função no schema `public`.
--
-- O formulário de candidatura promete "posso pedir a exclusão a qualquer momento". Esta
-- função é a parte do banco: apaga a candidata e tudo que depende dela, numa transação
-- só. As 11 tabelas ligadas a `influencers` já têm `on delete cascade` (inscrição,
-- consentimentos, tarefas, notas, feedbacks, números, avaliações, histórico, análises de
-- IA, registros de arquivo, conexão do Instagram). O que a cascata não alcança:
--
-- - o token do Instagram no Vault — apagado aqui, antes da linha que aponta para ele;
-- - os arquivos no Storage e a conta de acesso — ficam com o servidor
--   (`exclusao.functions.ts`), que tem as APIs para isso.
--
-- O registro em `audit_logs` fica: é a prova de que o pedido foi atendido. Ele guarda só
-- contagens e o identificador, que deixa de apontar para qualquer dado pessoal.
--
-- QUEM CHAMA: só o servidor, com a chave de serviço, depois de conferir que quem pediu é
-- a dona da plataforma. Nenhum papel de usuário executa esta função.

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
  values (_tenant, p_actor, 'candidata.excluida_a_pedido', 'influencers', p_influencer_id,
          _contagem || jsonb_build_object('instagram', _segredo is not null));

  return _contagem || jsonb_build_object('tenant_id', _tenant, 'user_id', _usuario);
end
$$;

revoke execute on function public.excluir_candidata(uuid, uuid) from public, anon, authenticated;
grant execute on function public.excluir_candidata(uuid, uuid) to service_role;
