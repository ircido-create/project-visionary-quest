-- ONBIO — seguidores atualizados automaticamente (2026-09-17).
--
-- O QUE A META PERMITE
--
-- A integração usa a "Instagram API with Instagram Login". Por ela só se lê o número de
-- seguidores de uma conta profissional (Criador ou Empresa) **que autorizou o app**:
-- `GET /me?fields=followers_count`, com o token daquela conta. Não existe, por essa API,
-- consulta de um @ qualquer. Por isso cada afiliada autoriza a própria conta no portal, e
-- quem não autoriza continua com número informado à mão, marcado como manual.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--
-- 1. Intervalo de atualização por ambiente (6 h a 7 dias, padrão 24 h).
-- 2. Situação das conexões para a gestora ler (Conectado, Pendente, Erro), sem token.
-- 3. Funções só da chave de serviço para a rotina: fila de contas vencidas, token,
--    gravação do resultado, erro e renovação do token. A rotina roda no servidor do app.
-- 4. A gestora pode desconectar uma conta (o token sai do Vault).
-- 5. `pg_net` + job do `pg_cron` que chama a rotina de hora em hora. Cada conta só é
--    consultada quando passou o intervalo do ambiente, então a hora é só a frequência de
--    verificação. O segredo do chamado mora no Vault.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Intervalo por ambiente
-- ---------------------------------------------------------------------------

alter table public.tenants
  add column if not exists instagram_intervalo_horas integer not null default 24
  check (instagram_intervalo_horas in (6, 12, 24, 48, 168));

create or replace function public.instagram_definir_intervalo(p_tenant uuid, p_horas integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_tenant_role(p_tenant, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role]) then
    raise exception 'Só a dona ou uma administradora do ambiente muda o intervalo.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_horas not in (6, 12, 24, 48, 168) then
    raise exception 'Intervalo inválido.' using errcode = '22023';
  end if;
  update public.tenants set instagram_intervalo_horas = p_horas where id = p_tenant;
  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (p_tenant, auth.uid(), 'instagram.intervalo_definido', 'tenants', p_tenant,
          jsonb_build_object('horas', p_horas));
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Situação das conexões do ambiente (sem token)
-- ---------------------------------------------------------------------------

create or replace function public.instagram_conexoes_do_ambiente(p_tenant uuid)
returns table (
  influencer_id uuid,
  usuario text,
  conectado_em timestamptz,
  expira_em timestamptz,
  ultimo_sync timestamptz,
  ultimo_erro text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_read_tenant(p_tenant) then
    raise exception 'Sem acesso a este ambiente.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select c.influencer_id, c.username, c.connected_at, c.token_expires_at,
           c.last_sync_at, c.last_sync_error
      from public.instagram_connections c
     where c.tenant_id = p_tenant
       and c.revoked_at is null;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Rotina (só chave de serviço)
-- ---------------------------------------------------------------------------

-- Contas ONBIO conectadas cuja última consulta (com sucesso ou erro) passou do intervalo.
-- A mais antiga primeiro; o limite protege os limites de requisição da Meta.
create or replace function public.instagram_fila_de_atualizacao(p_limite integer default 25)
returns table (influencer_id uuid, tenant_id uuid, usuario text, expira_em timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.influencer_id, c.tenant_id, c.username, c.token_expires_at
    from public.instagram_connections c
    join public.tenants t on t.id = c.tenant_id
    join public.influencers i on i.id = c.influencer_id
   where c.revoked_at is null
     and t.module = 'ONBIO'
     and t.status = 'ACTIVE'
     and i.archived_at is null
     and (c.last_sync_at is null
          or c.last_sync_at < now() - make_interval(hours => t.instagram_intervalo_horas))
   order by c.last_sync_at nulls first
   limit greatest(1, least(p_limite, 100))
$$;

create or replace function public.instagram_token_servico(p_influencer_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.decrypted_secret
    from public.instagram_connections c
    join vault.decrypted_secrets s on s.id = c.token_secret_id
   where c.influencer_id = p_influencer_id
     and c.revoked_at is null
$$;

-- Grava o número lido na Meta. Só ONBIO: na Ybera o sync recalcula a qualificação, que
-- vive no TypeScript e continua pelo fluxo da própria candidata.
create or replace function public.instagram_gravar_servico(
  p_influencer_id uuid,
  p_followers integer,
  p_posts integer,
  p_ator uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid;
  _module text;
begin
  select i.tenant_id, t.module into _tenant_id, _module
    from public.influencers i
    join public.tenants t on t.id = i.tenant_id
   where i.id = p_influencer_id;

  if _module is distinct from 'ONBIO' then
    raise exception 'A atualização automática existe só no ambiente ONBIO.' using errcode = '42501';
  end if;

  update public.influencers
     set followers = p_followers,
         posts_count = coalesce(p_posts, posts_count),
         data_source = 'META_API'
   where id = p_influencer_id;

  insert into public.metric_snapshots
    (tenant_id, influencer_id, followers, posts_count, source, created_by)
  values (_tenant_id, p_influencer_id, p_followers, p_posts, 'META_API', p_ator);

  update public.instagram_connections
     set last_sync_at = now(), last_sync_error = null
   where influencer_id = p_influencer_id;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (_tenant_id, p_ator,
          case when p_ator is null then 'instagram.atualizado_pela_rotina' else 'instagram.atualizado_pela_gestora' end,
          'influencers', p_influencer_id,
          jsonb_build_object('seguidores', p_followers, 'publicacoes', p_posts));
end
$$;

create or replace function public.instagram_erro_servico(p_influencer_id uuid, p_erro text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.instagram_connections
     set last_sync_at = now(), last_sync_error = left(p_erro, 500)
   where influencer_id = p_influencer_id
$$;

-- Troca o token renovado sem deixar o antigo órfão no Vault.
create or replace function public.instagram_renovar_token_servico(
  p_influencer_id uuid,
  p_token text,
  p_expira_em timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _antigo uuid;
  _novo uuid;
begin
  select token_secret_id into _antigo
    from public.instagram_connections
   where influencer_id = p_influencer_id;
  if _antigo is null then
    return;
  end if;

  _novo := vault.create_secret(
    p_token,
    'ig_token_' || p_influencer_id::text || '_' || extract(epoch from clock_timestamp())::bigint::text,
    'Token da Meta para a afiliada ' || p_influencer_id::text
  );
  update public.instagram_connections
     set token_secret_id = _novo, token_expires_at = p_expira_em
   where influencer_id = p_influencer_id;
  delete from vault.secrets where id = _antigo;
end
$$;

create or replace function public.instagram_segredo_da_rotina()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'MCB_ROTINA_INSTAGRAM'
$$;

revoke execute on function public.instagram_fila_de_atualizacao(integer) from public, anon, authenticated;
revoke execute on function public.instagram_token_servico(uuid) from public, anon, authenticated;
revoke execute on function public.instagram_gravar_servico(uuid, integer, integer, uuid) from public, anon, authenticated;
revoke execute on function public.instagram_erro_servico(uuid, text) from public, anon, authenticated;
revoke execute on function public.instagram_renovar_token_servico(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.instagram_segredo_da_rotina() from public, anon, authenticated;
grant execute on function public.instagram_fila_de_atualizacao(integer) to service_role;
grant execute on function public.instagram_token_servico(uuid) to service_role;
grant execute on function public.instagram_gravar_servico(uuid, integer, integer, uuid) to service_role;
grant execute on function public.instagram_erro_servico(uuid, text) to service_role;
grant execute on function public.instagram_renovar_token_servico(uuid, text, timestamptz) to service_role;
grant execute on function public.instagram_segredo_da_rotina() to service_role;

revoke execute on function public.instagram_definir_intervalo(uuid, integer) from public, anon;
revoke execute on function public.instagram_conexoes_do_ambiente(uuid) from public, anon;
grant execute on function public.instagram_definir_intervalo(uuid, integer) to authenticated;
grant execute on function public.instagram_conexoes_do_ambiente(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. A gestora desconecta
-- ---------------------------------------------------------------------------

create or replace function public.instagram_desconectar_pela_gestora(p_influencer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid;
  _secret_id uuid;
begin
  select tenant_id into _tenant_id from public.influencers where id = p_influencer_id;
  if _tenant_id is null
     or not public.has_tenant_role(_tenant_id, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role]) then
    raise exception 'Só a dona ou uma administradora do ambiente desconecta a conta.'
      using errcode = 'insufficient_privilege';
  end if;

  select token_secret_id into _secret_id
    from public.instagram_connections where influencer_id = p_influencer_id;
  delete from public.instagram_connections where influencer_id = p_influencer_id;
  if _secret_id is not null then
    delete from vault.secrets where id = _secret_id;
  end if;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id)
  values (_tenant_id, auth.uid(), 'instagram.desconectado_pela_gestora', 'influencers', p_influencer_id);
end
$$;

revoke execute on function public.instagram_desconectar_pela_gestora(uuid) from public, anon;
grant execute on function public.instagram_desconectar_pela_gestora(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Segredo e agendamento
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'MCB_ROTINA_INSTAGRAM') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'MCB_ROTINA_INSTAGRAM',
      'Autoriza o pg_cron a chamar a rotina de seguidores do app'
    );
  end if;
end
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'mcb-instagram-seguidores') then
    perform cron.unschedule('mcb-instagram-seguidores');
  end if;
  perform cron.schedule(
    'mcb-instagram-seguidores',
    '20 * * * *',
    $job$
      select net.http_post(
        url := 'https://mcblessing.com.br/api/rotinas/instagram',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-mcb-rotina', (select decrypted_secret from vault.decrypted_secrets where name = 'MCB_ROTINA_INSTAGRAM')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      )
    $job$
  );
end
$$;
