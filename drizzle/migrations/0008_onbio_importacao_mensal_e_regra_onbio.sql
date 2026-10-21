-- ONBIO — importação mês a mês e regra de comissão do sistema ONBIO (2026-10-21).
--
-- 1. A planilha pode trazer a mesma pessoa em várias linhas, uma por período (mês). A
--    importação passa a substituir a carga inteira de mesmo nome: os resultados antigos
--    daquela carga saem antes de os novos entrarem. Antes, só o mesmo período era
--    substituído, o que somaria uma carga mensal a uma carga de período inteiro.
--
-- 2. Percentuais de comissão iguais aos do sistema da ONBIO (app_settings.rules):
--    afiliada 15% sobre a venda própria, gestora 5% (1º nível acima), supervisora 2,5%,
--    embaixadora 1,5% e diretora executiva 1% (4º nível). Não há 5º nível. O ambiente
--    que ainda está com o padrão anterior passa para o novo; quem já mudou à mão fica
--    como está.

alter table public.tenants
  alter column onbio_comissao_percentuais
  set default array[15, 5, 2.5, 1.5, 1, 0]::numeric(5, 2)[];

update public.tenants
   set onbio_comissao_percentuais = array[15, 5, 2.5, 1.5, 1, 0]::numeric(5, 2)[]
 where onbio_comissao_percentuais = array[15, 5, 2.5, 2.5, 2.5, 1]::numeric(5, 2)[];

create or replace function public.onbio_importar_rede(
  p_tenant uuid,
  p_linhas jsonb,
  p_origem text default 'planilha'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_origem text := left(coalesce(nullif(btrim(p_origem), ''), 'planilha'), 80);
  v_campanha text;
  v_linha jsonb;
  v_nome text;
  v_chave text;
  v_email text;
  v_id uuid;
  v_pessoa uuid;
  v_quantos integer;
  v_criadas integer := 0;
  v_encontradas integer := 0;
  v_emails integer := 0;
  v_ligacoes integer := 0;
  v_resultados integer := 0;
  v_metas integer := 0;
  v_inicio date;
  v_fim date;
  v_centavos integer;
  v_pedidos integer;
  v_mes text;
  v_situacao text;
  v_superior uuid;
begin
  if not exists (select 1 from public.tenants where id = p_tenant and module = 'ONBIO') then
    raise exception 'A importação de rede existe só no ambiente ONBIO.' using errcode = '22023';
  end if;
  if not public.has_tenant_role(p_tenant, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role]) then
    raise exception 'Só a dona ou uma administradora do ambiente importa a rede.'
      using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' then
    raise exception 'As linhas precisam vir em lista.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) = 0 then
    raise exception 'A planilha não tem linhas.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) > 2000 then
    raise exception 'Máximo de 2.000 linhas por importação.' using errcode = '22023';
  end if;

  v_campanha := 'Importação: ' || v_origem;

  -- Mapa nome -> afiliada desta importação.
  create temporary table if not exists pg_temp.rede_mapa (
    chave text primary key,
    influencer_id uuid not null
  ) on commit drop;
  truncate pg_temp.rede_mapa;

  -- Passo 1: todas as pessoas citadas (linhas e indicadoras), linhas primeiro para
  -- que o e-mail da linha valha quando a pessoa também aparece como indicadora.
  for v_linha in
    select value from (
      select value, 0 as ordem from jsonb_array_elements(p_linhas)
      union all
      select jsonb_build_object('nome', value ->> 'indicada_por'), 1
      from jsonb_array_elements(p_linhas)
      where nullif(btrim(value ->> 'indicada_por'), '') is not null
    ) todas
    order by ordem
  loop
    v_nome := regexp_replace(btrim(coalesce(v_linha ->> 'nome', '')), '\s+', ' ', 'g');
    if length(v_nome) < 3 or length(v_nome) > 120 then
      raise exception 'Nome inválido na planilha: "%".', v_nome using errcode = '22023';
    end if;
    v_chave := public.onbio_chave_do_nome(v_nome);
    if exists (select 1 from pg_temp.rede_mapa where chave = v_chave) then
      continue;
    end if;

    v_email := lower(nullif(btrim(coalesce(v_linha ->> 'email', '')), ''));
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'E-mail inválido para %: "%".', v_nome, v_email using errcode = '22023';
    end if;

    v_id := null;
    if v_email is not null then
      select id into v_id from public.influencers
      where tenant_id = p_tenant and lower(email) = v_email
      limit 1;
    end if;
    if v_id is null then
      select count(*) into v_quantos from public.influencers
      where tenant_id = p_tenant and public.onbio_chave_do_nome(full_name) = v_chave;
      if v_quantos > 1 then
        raise exception 'Há mais de uma afiliada chamada % no ambiente. Informe o e-mail na planilha.', v_nome
          using errcode = '22023';
      end if;
      select id into v_id from public.influencers
      where tenant_id = p_tenant and public.onbio_chave_do_nome(full_name) = v_chave;
    end if;

    if v_id is not null then
      v_encontradas := v_encontradas + 1;
      -- Troca o e-mail provisório pelo real quando a planilha traz um.
      if v_email is not null then
        update public.influencers set email = v_email
        where id = v_id and email like '%@importacao.invalid';
        if found then
          v_emails := v_emails + 1;
          update public.people p set email = v_email
          from public.influencers i
          where i.id = v_id and p.id = i.person_id and p.email like '%@importacao.invalid';
        end if;
      end if;
    else
      v_email := coalesce(
        v_email,
        'pendente-' || left(md5(p_tenant::text || v_chave), 12) || '@importacao.invalid'
      );
      insert into public.people (full_name, email, created_by)
      values (v_nome, v_email, coalesce(v_uid, '00000000-0000-0000-0000-000000000000'::uuid))
      returning id into v_pessoa;

      insert into public.influencers (
        tenant_id, person_id, full_name, email, data_source, status, level,
        progress_score, origin
      ) values (
        p_tenant, v_pessoa, v_nome, v_email, 'MANUAL', 'EM_PRODUCAO', 'Afiliada ativa',
        100, 'importacao_rede'
      )
      returning id into v_id;
      v_criadas := v_criadas + 1;
    end if;

    insert into pg_temp.rede_mapa (chave, influencer_id) values (v_chave, v_id);
  end loop;

  -- A carga é substituída por inteiro: os resultados da importação anterior com o mesmo
  -- nome saem antes de entrarem os novos. Assim uma carga mensal pode substituir uma
  -- carga de período inteiro sem somar as duas.
  delete from public.commercial_results
  where tenant_id = p_tenant and campaign = v_campanha;

  -- Passo 2: ligações de indicação, resultados e metas, linha por linha.
  for v_linha in select value from jsonb_array_elements(p_linhas)
  loop
    select influencer_id into v_id from pg_temp.rede_mapa
    where chave = public.onbio_chave_do_nome(v_linha ->> 'nome');

    if nullif(btrim(v_linha ->> 'indicada_por'), '') is not null then
      select influencer_id into v_superior from pg_temp.rede_mapa
      where chave = public.onbio_chave_do_nome(v_linha ->> 'indicada_por');
      update public.influencers set indicada_por = v_superior
      where id = v_id and indicada_por is distinct from v_superior;
      if found then
        v_ligacoes := v_ligacoes + 1;
      end if;
    end if;

    v_inicio := nullif(v_linha ->> 'periodo_inicio', '')::date;
    v_fim := nullif(v_linha ->> 'periodo_fim', '')::date;
    v_centavos := nullif(v_linha ->> 'vendas_centavos', '')::integer;
    v_pedidos := nullif(v_linha ->> 'pedidos', '')::integer;
    if (v_centavos is not null or v_pedidos is not null) then
      if v_inicio is null or v_fim is null or v_fim < v_inicio then
        raise exception 'Período inválido na linha de %.', v_linha ->> 'nome' using errcode = '22023';
      end if;
      if coalesce(v_centavos, 0) < 0 or coalesce(v_pedidos, 0) < 0 then
        raise exception 'Valor negativo na linha de %.', v_linha ->> 'nome' using errcode = '22023';
      end if;
      if coalesce(v_centavos, 0) > 0 or coalesce(v_pedidos, 0) > 0 then
        insert into public.commercial_results (
          tenant_id, influencer_id, period_start, period_end, revenue_cents, orders,
          campaign, notes, created_by
        ) values (
          p_tenant, v_id, v_inicio, v_fim, coalesce(v_centavos, 0), coalesce(v_pedidos, 0),
          v_campanha, 'Total do período, importado de planilha.', v_uid
        );
        v_resultados := v_resultados + 1;
      end if;
    end if;

    if jsonb_typeof(v_linha -> 'metas') = 'object' then
      for v_mes, v_situacao in select key, value #>> '{}' from jsonb_each(v_linha -> 'metas')
      loop
        if v_situacao is null or v_situacao = '' then
          continue;
        end if;
        if v_situacao not in ('BATEU', 'NAO_BATEU', 'SEM_VENDAS') then
          raise exception 'Situação de meta inválida para %: %.', v_linha ->> 'nome', v_situacao
            using errcode = '22023';
        end if;
        insert into public.onbio_metas_mensais (tenant_id, influencer_id, mes, situacao, origem, created_by)
        values (p_tenant, v_id, date_trunc('month', v_mes::date)::date, v_situacao, v_origem, v_uid)
        on conflict (influencer_id, mes)
        do update set situacao = excluded.situacao, origem = excluded.origem;
        v_metas := v_metas + 1;
      end loop;
    end if;
  end loop;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, meta)
  values (p_tenant, v_uid, 'onbio.rede_importada', 'influencers', jsonb_build_object(
    'origem', v_origem, 'linhas', jsonb_array_length(p_linhas), 'criadas', v_criadas,
    'encontradas', v_encontradas, 'emails_atualizados', v_emails, 'ligacoes', v_ligacoes,
    'resultados', v_resultados, 'metas', v_metas));

  return jsonb_build_object(
    'criadas', v_criadas,
    'encontradas', v_encontradas,
    'emails_atualizados', v_emails,
    'ligacoes', v_ligacoes,
    'resultados', v_resultados,
    'metas', v_metas
  );
end
$$;

revoke all on function public.onbio_importar_rede(uuid, jsonb, text) from public, anon;
grant execute on function public.onbio_importar_rede(uuid, jsonb, text) to authenticated;
