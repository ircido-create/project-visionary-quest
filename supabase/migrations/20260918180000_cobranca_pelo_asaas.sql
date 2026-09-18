-- Cobrança recorrente pelo Asaas (2026-09-18).
--
-- Até aqui o pagamento era registrado à mão pela administração da plataforma
-- (`registrar_pagamento`). Isso continua valendo — é o caminho para acordos fora do
-- provedor —, e passa a existir o caminho automático: a gestora assina, o Asaas cobra
-- (Pix Automático, boleto ou cartão) e avisa por webhook; o webhook registra o pagamento
-- e empurra o vencimento, que é o que a rotina diária de suspensão já olha.
--
-- POR QUE UMA FUNÇÃO SEPARADA PARA O WEBHOOK
--
-- `registrar_pagamento` exige `platform_owner`, e o webhook não é ninguém: chega pela
-- chave de serviço, sem `auth.uid()`. A função de serviço abaixo faz o mesmo trabalho,
-- mas é idempotente pela referência da cobrança no Asaas — o Asaas reenvia o mesmo evento
-- quando não recebe 200, e sem isso o ambiente ganharia meses de brinde a cada reenvio.

alter table public.tenants
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text;

alter table public.pagamentos
  add column if not exists referencia_externa text;

-- Duas linhas com a mesma cobrança do Asaas nunca fazem sentido.
create unique index if not exists pagamentos_referencia_externa_unica
  on public.pagamentos (referencia_externa)
  where referencia_externa is not null;

-- ---------------------------------------------------------------------------
-- Segredos do provedor (só a chave de serviço lê)
-- ---------------------------------------------------------------------------

create or replace function public.segredos_do_asaas()
returns table (nome text, valor text)
language sql
stable
security definer
set search_path = public
as $$
  select name, decrypted_secret
    from vault.decrypted_secrets
   where name in ('ASAAS_API_KEY', 'ASAAS_API_KEY_SANDBOX', 'ASAAS_WEBHOOK_TOKEN')
$$;

revoke execute on function public.segredos_do_asaas() from public, anon, authenticated;
grant execute on function public.segredos_do_asaas() to service_role;

-- ---------------------------------------------------------------------------
-- Guardar o vínculo do ambiente com o provedor
-- ---------------------------------------------------------------------------

create or replace function public.salvar_assinatura_externa(
  p_tenant uuid,
  p_customer text,
  p_subscription text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenants
     set asaas_customer_id = coalesce(p_customer, asaas_customer_id),
         asaas_subscription_id = coalesce(p_subscription, asaas_subscription_id)
   where id = p_tenant;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (p_tenant, null, 'assinatura.vinculada_ao_provedor', 'tenants', p_tenant,
          jsonb_build_object('provedor', 'asaas', 'assinatura', p_subscription));
end
$$;

revoke execute on function public.salvar_assinatura_externa(uuid, text, text) from public, anon, authenticated;
grant execute on function public.salvar_assinatura_externa(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Pagamento confirmado pelo provedor
-- ---------------------------------------------------------------------------

create or replace function public.registrar_pagamento_do_provedor(
  p_tenant uuid,
  p_valor_centavos integer,
  p_meses integer,
  p_forma text,
  p_referencia text,
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
  if p_referencia is null or trim(p_referencia) = '' then
    raise exception 'A cobrança do provedor precisa de referência.' using errcode = '22023';
  end if;
  if p_meses is null or p_meses < 1 or p_meses > 12 then
    raise exception 'Informe de 1 a 12 meses.';
  end if;

  -- Reenvio do mesmo evento: devolve o vencimento atual sem somar mês nenhum.
  select periodo_fim into _fim from public.pagamentos where referencia_externa = p_referencia;
  if found then
    return _fim;
  end if;

  select * into _t from public.tenants where id = p_tenant for update;
  if not found then
    raise exception 'Ambiente não encontrado.';
  end if;

  _inicio := greatest(coalesce(_t.vence_em, now()), now());
  _fim := _inicio + make_interval(months => p_meses);

  insert into public.pagamentos
    (tenant_id, valor_centavos, periodo_inicio, periodo_fim, forma, observacao, referencia_externa)
  values (p_tenant, p_valor_centavos, _inicio, _fim,
          coalesce(nullif(trim(p_forma), ''), 'asaas'), nullif(trim(p_observacao), ''), p_referencia);

  update public.tenants
     set cobranca = 'PAGA',
         vence_em = _fim,
         cancelada_em = null,
         status = case when _t.status = 'SUSPENDED' and _t.suspensao_motivo = 'VENCIMENTO'
                       then 'ACTIVE' else status end,
         suspensao_motivo = case when _t.suspensao_motivo = 'VENCIMENTO' then null else suspensao_motivo end
   where id = p_tenant;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (p_tenant, null, 'assinatura.pagamento_confirmado', 'tenants', p_tenant,
          jsonb_build_object('provedor', 'asaas', 'valor_centavos', p_valor_centavos,
                             'meses', p_meses, 'ate', _fim, 'referencia', p_referencia,
                             'reativou', _t.status = 'SUSPENDED' and _t.suspensao_motivo = 'VENCIMENTO'));
  return _fim;
end
$$;

revoke execute on function public.registrar_pagamento_do_provedor(uuid, integer, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.registrar_pagamento_do_provedor(uuid, integer, integer, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Ambiente pelo identificador do provedor (o webhook só conhece esses ids)
-- ---------------------------------------------------------------------------

create or replace function public.ambiente_do_asaas(p_customer text, p_subscription text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.tenants
   where (p_subscription is not null and asaas_subscription_id = p_subscription)
      or (p_customer is not null and asaas_customer_id = p_customer)
   order by case when asaas_subscription_id = p_subscription then 0 else 1 end
   limit 1
$$;

revoke execute on function public.ambiente_do_asaas(text, text) from public, anon, authenticated;
grant execute on function public.ambiente_do_asaas(text, text) to service_role;
