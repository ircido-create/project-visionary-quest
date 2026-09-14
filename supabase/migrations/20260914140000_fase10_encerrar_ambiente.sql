-- Fase 10 — A dona encerra o ambiente e leva os dados.
--
-- Até aqui, cancelar a assinatura deixava o ambiente só leitura, sem prazo, e excluir
-- dependia da administração da plataforma. Agora a dona baixa todos os dados (pelo app,
-- com as regras de leitura de sempre) e pode excluir o ambiente de vez.
--
-- A exclusão tem três passos, feitos pelo servidor do app com a chave de serviço:
-- 1. arquivos no Storage (pasta do ambiente e o que está registrado em `files`);
-- 2. esta função: confere de novo que quem pede é a dona, apaga do Vault os tokens do
--    Instagram das candidatas e apaga o ambiente — o resto sai em cascata;
-- 3. o registro fica no log da plataforma, fora do ambiente, só com contagens.
--
-- Só a chave de serviço executa: a conferência de papel aqui dentro usa o `p_actor` que o
-- servidor tirou da sessão, e não `auth.uid()`, que é vazio com a chave de serviço.

create or replace function public.excluir_ambiente(p_tenant uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _t public.tenants;
  _contagem jsonb;
begin
  select * into _t from public.tenants where id = p_tenant for update;
  if not found then
    raise exception 'Ambiente não encontrado.' using errcode = 'no_data_found';
  end if;
  if _t.is_demo then
    raise exception 'Ambiente de demonstração não é excluído por aqui.';
  end if;
  if not exists (select 1 from public.tenant_memberships
                  where tenant_id = p_tenant and user_id = p_actor and role = 'manager_owner') then
    raise exception 'Só a dona do ambiente pode excluí-lo.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'candidatas',           (select count(*) from public.influencers where tenant_id = p_tenant),
    'inscricoes',           (select count(*) from public.applications where tenant_id = p_tenant),
    'tarefas',              (select count(*) from public.tasks where tenant_id = p_tenant),
    'notas',                (select count(*) from public.notes where tenant_id = p_tenant),
    'feedbacks',            (select count(*) from public.feedbacks where tenant_id = p_tenant),
    'registros_de_numeros', (select count(*) from public.metric_snapshots where tenant_id = p_tenant),
    'avaliacoes',           (select count(*) from public.qualification_results where tenant_id = p_tenant),
    'arquivos',             (select count(*) from public.files where tenant_id = p_tenant),
    'membros',              (select count(*) from public.tenant_memberships where tenant_id = p_tenant),
    'convites',             (select count(*) from public.invitations where tenant_id = p_tenant),
    'pagamentos',           (select count(*) from public.pagamentos where tenant_id = p_tenant),
    'modelos_de_tarefa',    (select count(*) from public.task_templates where tenant_id = p_tenant)
  ) into _contagem;

  delete from vault.secrets
   where id in (select token_secret_id from public.instagram_connections
                 where tenant_id = p_tenant and token_secret_id is not null);

  delete from public.tenants where id = p_tenant;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (null, p_actor, 'ambiente.excluido_pela_dona', 'tenants', p_tenant,
          _contagem || jsonb_build_object('cobranca', _t.cobranca));

  return _contagem;
end
$$;

revoke execute on function public.excluir_ambiente(uuid, uuid) from public, anon, authenticated;
grant execute on function public.excluir_ambiente(uuid, uuid) to service_role;
