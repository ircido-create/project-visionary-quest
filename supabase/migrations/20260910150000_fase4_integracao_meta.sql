-- Fase 4 — Integração oficial Meta/Instagram.
--
-- Roda inteira de uma vez no SQL editor: mexe só em `public` e no Vault.
--
-- QUEM CONECTA A CONTA
--
-- A candidata, não a gestora. A conta do Instagram é dela, o consentimento é dela, e
-- o token que a Meta devolve é uma credencial dela. A gestora vê o resultado
-- (seguidores, publicações, público feminino) e nunca o token.
--
-- ONDE FICA O TOKEN
--
-- No `supabase_vault`, cifrado. A tabela `instagram_connections` guarda só o uuid do
-- segredo. Isso importa porque RLS é por linha, não por coluna: se o token estivesse
-- numa coluna comum, qualquer política que deixasse a gestora ler o *status* da
-- conexão deixaria também ler o token. Guardando fora, a pergunta nem se coloca.
--
-- Por isso `instagram_connections` **não tem nenhuma política**. Com RLS ligada e
-- nenhuma policy, ninguém alcança a tabela direto — todo acesso passa pelas funções
-- abaixo, que decidem caso a caso quem pode o quê. Mesmo desenho do portal da fase 2.
--
-- POR QUE A CANDIDATA NÃO ESCREVE DIRETO EM metric_snapshots
--
-- As políticas da fase 1 exigem `is_tenant_member(tenant_id)` para inserir, e a
-- candidata deliberadamente não é membro do ambiente. Então a gravação do resultado
-- do sync passa por `instagram_record_sync`, que roda com privilégio elevado.
--
-- POR QUE A FUNÇÃO RECEBE nível E pontuação PRONTOS
--
-- O motor de qualificação vive em `src/lib/mcb/qualification.ts`, em TypeScript, e é
-- a mesma regra usada em toda a aplicação. Reimplementá-la em SQL criaria duas
-- verdades que iriam divergir na primeira mudança de critério. A função aqui grava o
-- que o servidor calculou; ela não julga candidata.

create table if not exists public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Uma conexão por candidata: reconectar substitui a anterior.
  influencer_id uuid not null unique references public.influencers (id) on delete cascade,
  ig_user_id text not null,
  username text,
  -- Aponta para `vault.secrets`. O token em si nunca fica aqui.
  token_secret_id uuid not null,
  token_expires_at timestamptz,
  scopes text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  -- Guarda o motivo da última falha para a candidata saber que precisa reconectar,
  -- em vez de ver "sem dados" sem explicação.
  last_sync_error text,
  revoked_at timestamptz
);

alter table public.instagram_connections enable row level security;

-- Sem policies de propósito: ver o cabeçalho.

-- ---------------------------------------------------------------------------
-- Quem é a dona da candidatura
-- ---------------------------------------------------------------------------

-- Usada por todas as funções abaixo. Separada para a regra existir num lugar só.
create or replace function public.is_influencer_owner(p_influencer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.influencers i
     where i.id = p_influencer_id
       and i.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Conectar
-- ---------------------------------------------------------------------------

create or replace function public.instagram_connect(
  p_influencer_id uuid,
  p_ig_user_id text,
  p_username text,
  p_token text,
  p_expires_at timestamptz,
  p_scopes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid;
  _antigo uuid;
  _novo uuid;
begin
  if not public.is_influencer_owner(p_influencer_id) then
    raise exception 'Só a própria candidata pode conectar o Instagram dela.'
      using errcode = 'insufficient_privilege';
  end if;

  select tenant_id into _tenant_id from public.influencers where id = p_influencer_id;

  -- Reconexão: o segredo antigo sai do Vault em vez de ficar órfão lá dentro.
  select token_secret_id into _antigo
    from public.instagram_connections
   where influencer_id = p_influencer_id;

  _novo := vault.create_secret(
    p_token,
    'ig_token_' || p_influencer_id::text || '_' || extract(epoch from now())::bigint::text,
    'Token da Meta para a candidata ' || p_influencer_id::text
  );

  insert into public.instagram_connections
    (tenant_id, influencer_id, ig_user_id, username, token_secret_id, token_expires_at, scopes)
  values
    (_tenant_id, p_influencer_id, p_ig_user_id, p_username, _novo, p_expires_at, p_scopes)
  on conflict (influencer_id) do update
     set ig_user_id      = excluded.ig_user_id,
         username        = excluded.username,
         token_secret_id = excluded.token_secret_id,
         token_expires_at= excluded.token_expires_at,
         scopes          = excluded.scopes,
         connected_at    = now(),
         last_sync_error = null,
         revoked_at      = null;

  if _antigo is not null then
    delete from vault.secrets where id = _antigo;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Ler o token (só a dona) — é o que o servidor usa para chamar a Meta
-- ---------------------------------------------------------------------------

create or replace function public.instagram_token(p_influencer_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _secret_id uuid;
  _token text;
begin
  if not public.is_influencer_owner(p_influencer_id) then
    raise exception 'Só a própria candidata pode usar o token dela.'
      using errcode = 'insufficient_privilege';
  end if;

  select token_secret_id into _secret_id
    from public.instagram_connections
   where influencer_id = p_influencer_id
     and revoked_at is null;

  if _secret_id is null then
    return null;
  end if;

  select decrypted_secret into _token
    from vault.decrypted_secrets
   where id = _secret_id;

  return _token;
end
$$;

-- ---------------------------------------------------------------------------
-- Status da conexão — sem segredo nenhum, por isso a gestora também vê
-- ---------------------------------------------------------------------------

create or replace function public.instagram_status(p_influencer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid;
  _r public.instagram_connections%rowtype;
begin
  select tenant_id into _tenant_id from public.influencers where id = p_influencer_id;
  if _tenant_id is null then
    return null;
  end if;

  -- A candidata vê a própria; quem é do ambiente vê a das candidatas dele.
  if not (public.is_influencer_owner(p_influencer_id) or public.can_read_tenant(_tenant_id)) then
    raise exception 'Sem acesso a esta candidata.' using errcode = 'insufficient_privilege';
  end if;

  select * into _r from public.instagram_connections where influencer_id = p_influencer_id;

  if not found then
    return jsonb_build_object('conectado', false);
  end if;

  return jsonb_build_object(
    'conectado', _r.revoked_at is null,
    'usuario', _r.username,
    'conectado_em', _r.connected_at,
    'expira_em', _r.token_expires_at,
    'ultimo_sync', _r.last_sync_at,
    'ultimo_erro', _r.last_sync_error
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Insumos da qualificação
-- ---------------------------------------------------------------------------

-- Devolve só o que o motor de qualificação precisa, e só para a dona.
--
-- Existe porque a Meta **não fornece** `recent_posts_6m` nem `profile_type`. Sem ler
-- os valores atuais, cada sync recalcularia a pontuação com dois requisitos em branco
-- e rebaixaria a candidata sem que nada tivesse piorado — o oposto do que a
-- integração deveria fazer.
create or replace function public.instagram_qualification_input(p_influencer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _r jsonb;
begin
  if not public.is_influencer_owner(p_influencer_id) then
    raise exception 'Sem acesso.' using errcode = 'insufficient_privilege';
  end if;

  -- Devolve o mesmo conjunto de campos que `evaluateInfluencer` lê no TypeScript,
  -- com os nomes de coluna do banco. Assim o servidor sobrepõe só o que veio da Meta
  -- e chama a função de qualificação já existente, em vez de recriar a regra aqui.
  select jsonb_build_object(
           'followers', i.followers,
           'posts_count', i.posts_count,
           'female_audience_pct', i.female_audience_pct,
           'recent_posts_6m', i.recent_posts_6m,
           'profile_type', i.profile_type,
           'data_source', i.data_source,
           'updated_at', i.updated_at,
           'topics', i.topics,
           'profile_goal', i.profile_goal,
           'stories_frequency', i.stories_frequency,
           'reels_frequency', i.reels_frequency
         )
    into _r
    from public.influencers i
   where i.id = p_influencer_id;

  return _r;
end
$$;

-- ---------------------------------------------------------------------------
-- Gravar o resultado do sync
-- ---------------------------------------------------------------------------

-- `p_female` chega nulo quando a conta tem menos de 100 seguidores: abaixo disso a
-- Meta não devolve `follower_demographics`. Nesse caso o valor que já estava lá é
-- preservado — normalmente veio de um print confirmado por uma pessoa, e apagá-lo
-- seria perder informação boa em troca de nada.
create or replace function public.instagram_record_sync(
  p_influencer_id uuid,
  p_followers integer,
  p_posts integer,
  p_female numeric,
  p_level text,
  p_score numeric,
  p_status text,
  p_rule_set_version text,
  p_requirements jsonb,
  p_progress jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid;
  _female numeric;
begin
  if not public.is_influencer_owner(p_influencer_id) then
    raise exception 'Só a própria candidata pode sincronizar o Instagram dela.'
      using errcode = 'insufficient_privilege';
  end if;

  select tenant_id, coalesce(p_female, female_audience_pct)
    into _tenant_id, _female
    from public.influencers
   where id = p_influencer_id;

  update public.influencers
     set followers           = p_followers,
         posts_count         = p_posts,
         female_audience_pct = _female,
         data_source         = 'META_API',
         level               = p_level,
         progress_score      = p_score
   where id = p_influencer_id;

  insert into public.metric_snapshots
    (tenant_id, influencer_id, followers, posts_count, female_audience_pct, source, created_by)
  values
    (_tenant_id, p_influencer_id, p_followers, p_posts, _female, 'META_API', auth.uid());

  insert into public.qualification_results
    (tenant_id, influencer_id, rule_set_version, status, requirements, progress)
  values
    (_tenant_id, p_influencer_id, p_rule_set_version, p_status::qualification_status,
     p_requirements, p_progress);

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (_tenant_id, auth.uid(), 'instagram.sincronizado', 'influencers', p_influencer_id,
          jsonb_build_object('seguidores', p_followers, 'publicacoes', p_posts,
                             'publico_feminino', _female));

  update public.instagram_connections
     set last_sync_at = now(), last_sync_error = null
   where influencer_id = p_influencer_id;
end
$$;

-- Registra a falha sem derrubar nada: a candidata precisa saber que a conexão caiu.
create or replace function public.instagram_record_error(p_influencer_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_influencer_owner(p_influencer_id) then
    raise exception 'Sem acesso.' using errcode = 'insufficient_privilege';
  end if;

  update public.instagram_connections
     set last_sync_at = now(), last_sync_error = left(p_error, 500)
   where influencer_id = p_influencer_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Desconectar — LGPD: a candidata retira o acesso quando quiser
-- ---------------------------------------------------------------------------

create or replace function public.instagram_disconnect(p_influencer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _tenant_id uuid;
  _secret_id uuid;
begin
  if not public.is_influencer_owner(p_influencer_id) then
    raise exception 'Só a própria candidata pode desconectar o Instagram dela.'
      using errcode = 'insufficient_privilege';
  end if;

  select tenant_id into _tenant_id from public.influencers where id = p_influencer_id;

  select token_secret_id into _secret_id
    from public.instagram_connections
   where influencer_id = p_influencer_id;

  delete from public.instagram_connections where influencer_id = p_influencer_id;

  if _secret_id is not null then
    delete from vault.secrets where id = _secret_id;
  end if;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id)
  values (_tenant_id, auth.uid(), 'instagram.desconectado', 'influencers', p_influencer_id);
end
$$;

-- ---------------------------------------------------------------------------
-- Permissões: as funções são a porta; a tabela não é alcançável.
-- ---------------------------------------------------------------------------

grant execute on function public.instagram_connect(uuid, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.instagram_token(uuid) to authenticated;
grant execute on function public.instagram_status(uuid) to authenticated;
grant execute on function public.instagram_record_sync(uuid, integer, integer, numeric, text, numeric, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.instagram_record_error(uuid, text) to authenticated;
grant execute on function public.instagram_disconnect(uuid) to authenticated;
grant execute on function public.is_influencer_owner(uuid) to authenticated;
grant execute on function public.instagram_qualification_input(uuid) to authenticated;
