-- ONBIO — rede de indicações, metas mensais e importação por planilha (2026-10-20).
--
-- POR QUE
--
-- A ONBIO acompanha as vendas num painel do Power BI organizado por rede: cada afiliada
-- foi indicada por alguém, e quem tem indicadas diretas é gestora de uma equipe. A
-- plataforma guardava cada afiliada solta, sem saber quem indicou quem, e por isso não
-- conseguia mostrar gerações nem o valor por equipe.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--
-- 1. `influencers.indicada_por`: quem indicou a afiliada, dentro do mesmo ambiente. Um
--    gatilho recusa indicação de outro ambiente e ciclos (A indica B que indica A).
-- 2. `onbio_metas_mensais`: situação de cada afiliada em cada mês (bateu a meta, não
--    bateu, sem vendas). É o que o painel mostra e o que não cabe em `commercial_results`,
--    que guarda valores e não situação.
-- 3. `onbio_importar_rede(tenant, linhas, origem)`: recebe as linhas já lidas da planilha
--    e grava tudo de uma vez, numa transação só. Quem já existe no ambiente é encontrado
--    pelo e-mail ou, sem e-mail, pelo nome (sem acento e sem diferença de maiúsculas).
--    Quem não existe é criado. Quem aparece só como "indicada por" também vira cadastro,
--    para a árvore não ter buracos.
--
-- E-MAIL PENDENTE
--
-- O painel não traz e-mail. Cadastro exige e-mail único por ambiente, então quem chega
-- sem e-mail recebe um endereço `@importacao.invalid`. O domínio `.invalid` é reservado
-- (RFC 2606) e nunca entrega mensagem. A gestora troca pelo e-mail real na ficha da
-- afiliada, e a importação seguinte também troca, se a planilha trouxer o e-mail.
--
-- REIMPORTAR É SEGURO
--
-- Rodar a mesma planilha de novo não duplica nada: as pessoas são reencontradas, o
-- resultado do mesmo período e da mesma origem é substituído e a meta do mês é
-- sobrescrita.

-- ---------------------------------------------------------------------------
-- 1. Quem indicou quem
-- ---------------------------------------------------------------------------

alter table public.influencers
  add column if not exists indicada_por uuid
  references public.influencers(id) on delete set null;

alter table public.influencers
  drop constraint if exists influencers_indicada_por_nao_e_ela_mesma;
alter table public.influencers
  add constraint influencers_indicada_por_nao_e_ela_mesma
  check (indicada_por is null or indicada_por <> id);

create index if not exists idx_influencers_indicada_por
  on public.influencers (tenant_id, indicada_por)
  where indicada_por is not null;

create or replace function public.onbio_conferir_indicacao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tenant uuid;
  v_ciclo boolean;
begin
  if new.indicada_por is null then
    return new;
  end if;

  select tenant_id into v_tenant from public.influencers where id = new.indicada_por;
  if v_tenant is distinct from new.tenant_id then
    raise exception 'A indicadora precisa estar no mesmo ambiente.' using errcode = '22023';
  end if;

  -- Sobe pela cadeia de quem indicou a indicadora. Se chegar na própria afiliada,
  -- a nova ligação fecharia um ciclo.
  with recursive acima(id, profundidade) as (
    select new.indicada_por, 1
    union all
    select i.indicada_por, a.profundidade + 1
    from acima a
    join public.influencers i on i.id = a.id
    where i.indicada_por is not null and a.profundidade < 100
  )
  select exists (select 1 from acima where id = new.id) into v_ciclo;

  if v_ciclo then
    raise exception 'Essa indicação fecharia um ciclo na rede.' using errcode = '22023';
  end if;
  return new;
end
$$;

drop trigger if exists trg_onbio_conferir_indicacao on public.influencers;
create trigger trg_onbio_conferir_indicacao
  before insert or update of indicada_por on public.influencers
  for each row execute function public.onbio_conferir_indicacao();

-- ---------------------------------------------------------------------------
-- 2. Situação mensal de meta
-- ---------------------------------------------------------------------------

create table if not exists public.onbio_metas_mensais (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  situacao text not null check (situacao in ('BATEU', 'NAO_BATEU', 'SEM_VENDAS')),
  origem text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (influencer_id, mes)
);

grant select, insert, update, delete on public.onbio_metas_mensais to authenticated;
grant all on public.onbio_metas_mensais to service_role;
alter table public.onbio_metas_mensais enable row level security;

drop policy if exists onbio_metas_read on public.onbio_metas_mensais;
create policy onbio_metas_read on public.onbio_metas_mensais for select to authenticated
  using (public.can_read_tenant(tenant_id));
drop policy if exists onbio_metas_insert on public.onbio_metas_mensais;
create policy onbio_metas_insert on public.onbio_metas_mensais for insert to authenticated
  with check (public.is_tenant_member(tenant_id));
drop policy if exists onbio_metas_update on public.onbio_metas_mensais;
create policy onbio_metas_update on public.onbio_metas_mensais for update to authenticated
  using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
drop policy if exists onbio_metas_delete on public.onbio_metas_mensais;
create policy onbio_metas_delete on public.onbio_metas_mensais for delete to authenticated
  using (public.is_tenant_member(tenant_id));

create index if not exists idx_onbio_metas_tenant_mes
  on public.onbio_metas_mensais (tenant_id, mes desc);

drop trigger if exists trg_onbio_metas_touch on public.onbio_metas_mensais;
create trigger trg_onbio_metas_touch before update on public.onbio_metas_mensais
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Importação
-- ---------------------------------------------------------------------------

-- Uma importação cria dezenas de cadastros de uma vez. Sem esta condição, cada um
-- viraria um aviso de "Nova candidatura" para toda a equipe.
drop trigger if exists mcb_aviso_nova_candidatura on public.influencers;
create trigger mcb_aviso_nova_candidatura
  after insert on public.influencers
  for each row
  when (new.origin is distinct from 'importacao_rede')
  execute function public.aviso_nova_candidatura();

-- Chave de comparação de nomes: sem acento, minúsculas, espaços únicos.
create or replace function public.onbio_chave_do_nome(p_nome text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(
    translate(btrim(coalesce(p_nome, '')),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'),
    '\s+', ' ', 'g'))
$$;

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
      delete from public.commercial_results
      where tenant_id = p_tenant and influencer_id = v_id
        and period_start = v_inicio and period_end = v_fim and campaign = v_campanha;
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

-- Trocar a indicadora pela ficha da afiliada.
create or replace function public.onbio_definir_indicacao(p_influencer uuid, p_indicada_por uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.influencers where id = p_influencer;
  if v_tenant is null then
    raise exception 'Afiliada não encontrada.' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.tenants where id = v_tenant and module = 'ONBIO') then
    raise exception 'A rede de indicações existe só no ambiente ONBIO.' using errcode = '22023';
  end if;
  if not public.is_tenant_member(v_tenant) then
    raise exception 'Sem acesso a este ambiente.' using errcode = 'insufficient_privilege';
  end if;
  update public.influencers set indicada_por = p_indicada_por where id = p_influencer;
  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (v_tenant, auth.uid(), 'onbio.indicacao_definida', 'influencers', p_influencer,
          jsonb_build_object('indicada_por', p_indicada_por));
end
$$;

revoke all on function public.onbio_definir_indicacao(uuid, uuid) from public, anon;
grant execute on function public.onbio_definir_indicacao(uuid, uuid) to authenticated;
