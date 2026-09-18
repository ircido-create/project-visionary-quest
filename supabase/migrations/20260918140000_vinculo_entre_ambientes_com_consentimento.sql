-- Vínculo entre ambientes com consentimento da afiliada (2026-09-18).
--
-- Até aqui a gestora vinculava sozinha o cadastro de uma pessoa nos dois ambientes, e o
-- nome, e-mail e WhatsApp passavam a ser compartilhados. Quem decide sobre os próprios
-- dados é a afiliada: a gestora passa a *pedir* o vínculo, e o compartilhamento só começa
-- depois do aceite dela no portal. A recusa também fica registrada.
--
-- O que o vínculo compartilha continua sendo só identidade e contato. Métricas, tarefas,
-- notas, arquivos, etapas e histórico seguem separados por ambiente.

create table if not exists public.vinculos_de_identidade (
  id uuid primary key default gen_random_uuid(),
  -- Cadastro que já existe e tem conta de acesso: é por ele que a pessoa confirma.
  origem_influencer_id uuid not null references public.influencers (id) on delete cascade,
  -- Cadastro novo, no outro ambiente.
  destino_influencer_id uuid not null references public.influencers (id) on delete cascade,
  destino_tenant_id uuid not null references public.tenants (id) on delete cascade,
  solicitado_por uuid not null,
  solicitado_em timestamptz not null default now(),
  situacao text not null default 'PENDENTE' check (situacao in ('PENDENTE', 'ACEITO', 'RECUSADO')),
  decidido_em timestamptz,
  -- O texto que a pessoa leu ao decidir, para a decisão ser auditável no futuro.
  texto_do_consentimento text,
  unique (origem_influencer_id, destino_influencer_id)
);

create index if not exists idx_vinculos_destino on public.vinculos_de_identidade (destino_tenant_id, situacao);

alter table public.vinculos_de_identidade enable row level security;
grant select on public.vinculos_de_identidade to authenticated;
grant all on public.vinculos_de_identidade to service_role;

-- A equipe do ambiente de destino acompanha o pedido; a afiliada vê os pedidos que a
-- envolvem. Escrever é só pelas funções abaixo, que checam quem é quem.
create policy vinculos_leitura on public.vinculos_de_identidade
  for select to authenticated
  using (
    public.can_read_tenant(destino_tenant_id)
    or public.is_influencer_owner(origem_influencer_id)
    or public.is_influencer_owner(destino_influencer_id)
  );

-- ---------------------------------------------------------------------------
-- A gestora pede
-- ---------------------------------------------------------------------------

create or replace function public.pedir_vinculo_de_identidade(
  p_destino_influencer_id uuid,
  p_origem_influencer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _destino_tenant uuid;
  _origem_tenant uuid;
  _id uuid;
begin
  select tenant_id into _destino_tenant from public.influencers where id = p_destino_influencer_id;
  select tenant_id into _origem_tenant from public.influencers where id = p_origem_influencer_id;

  if _destino_tenant is null or _origem_tenant is null then
    raise exception 'Cadastro não encontrado.' using errcode = 'no_data_found';
  end if;
  if _destino_tenant = _origem_tenant then
    raise exception 'Os dois cadastros estão no mesmo ambiente.' using errcode = '22023';
  end if;
  if not public.has_tenant_role(_destino_tenant, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role]) then
    raise exception 'Só a dona ou uma administradora do ambiente pede o vínculo.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.vinculos_de_identidade
    (origem_influencer_id, destino_influencer_id, destino_tenant_id, solicitado_por)
  values (p_origem_influencer_id, p_destino_influencer_id, _destino_tenant, auth.uid())
  on conflict (origem_influencer_id, destino_influencer_id) do update
     set situacao = 'PENDENTE',
         solicitado_em = now(),
         solicitado_por = auth.uid(),
         decidido_em = null,
         texto_do_consentimento = null
  returning id into _id;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (_destino_tenant, auth.uid(), 'vinculo.solicitado', 'vinculos_de_identidade', _id,
          jsonb_build_object('origem', p_origem_influencer_id, 'destino', p_destino_influencer_id));
  return _id;
end
$$;

-- ---------------------------------------------------------------------------
-- A afiliada decide
-- ---------------------------------------------------------------------------

create or replace function public.responder_vinculo_de_identidade(
  p_vinculo_id uuid,
  p_aceitar boolean,
  p_texto text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _v public.vinculos_de_identidade%rowtype;
  _person uuid;
  _nome text;
  _email text;
  _whatsapp text;
begin
  select * into _v from public.vinculos_de_identidade where id = p_vinculo_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  -- Só a dona dos dados decide. Nem a gestora, nem a administração da plataforma.
  if not public.is_influencer_owner(_v.origem_influencer_id) then
    raise exception 'Só a própria afiliada responde a este pedido.'
      using errcode = 'insufficient_privilege';
  end if;
  if _v.situacao <> 'PENDENTE' then
    raise exception 'Este pedido já foi respondido.' using errcode = '22023';
  end if;

  update public.vinculos_de_identidade
     set situacao = case when p_aceitar then 'ACEITO' else 'RECUSADO' end,
         decidido_em = now(),
         texto_do_consentimento = left(p_texto, 2000)
   where id = p_vinculo_id;

  if p_aceitar then
    select person_id, full_name, email, whatsapp
      into _person, _nome, _email, _whatsapp
      from public.influencers where id = _v.origem_influencer_id;

    if _person is null then
      insert into public.people (full_name, email, whatsapp, created_by)
      values (_nome, _email, _whatsapp, auth.uid())
      returning id into _person;
      update public.influencers set person_id = _person where id = _v.origem_influencer_id;
    end if;

    update public.influencers
       set person_id = _person,
           full_name = _nome,
           email = _email,
           whatsapp = coalesce(_whatsapp, whatsapp)
     where id = _v.destino_influencer_id;
  end if;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (_v.destino_tenant_id, auth.uid(),
          case when p_aceitar then 'vinculo.aceito' else 'vinculo.recusado' end,
          'vinculos_de_identidade', p_vinculo_id,
          jsonb_build_object('origem', _v.origem_influencer_id, 'destino', _v.destino_influencer_id));
end
$$;

-- ---------------------------------------------------------------------------
-- Desfazer: some o compartilhamento, ficam os registros
-- ---------------------------------------------------------------------------

create or replace function public.desfazer_vinculo_de_identidade(p_vinculo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _v public.vinculos_de_identidade%rowtype;
begin
  select * into _v from public.vinculos_de_identidade where id = p_vinculo_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'no_data_found';
  end if;
  if not (public.is_influencer_owner(_v.origem_influencer_id)
          or public.has_tenant_role(_v.destino_tenant_id,
               array['manager_owner'::tenant_role, 'manager_admin'::tenant_role])) then
    raise exception 'Sem permissão para desfazer este vínculo.' using errcode = 'insufficient_privilege';
  end if;

  update public.influencers set person_id = null where id = _v.destino_influencer_id;
  delete from public.vinculos_de_identidade where id = p_vinculo_id;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (_v.destino_tenant_id, auth.uid(), 'vinculo.desfeito', 'vinculos_de_identidade', p_vinculo_id,
          jsonb_build_object('destino', _v.destino_influencer_id));
end
$$;

-- ---------------------------------------------------------------------------
-- Pedidos pendentes de quem está logada, para o portal
-- ---------------------------------------------------------------------------

create or replace function public.vinculos_pendentes_da_afiliada()
returns table (
  id uuid,
  ambiente text,
  gestora text,
  solicitado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, t.name, coalesce(b.manager_name, t.name), v.solicitado_em
    from public.vinculos_de_identidade v
    join public.influencers i on i.id = v.origem_influencer_id
    join public.tenants t on t.id = v.destino_tenant_id
    left join public.tenant_branding b on b.tenant_id = t.id
   where v.situacao = 'PENDENTE'
     and i.user_id = auth.uid()
$$;

revoke execute on function public.pedir_vinculo_de_identidade(uuid, uuid) from public, anon;
revoke execute on function public.responder_vinculo_de_identidade(uuid, boolean, text) from public, anon;
revoke execute on function public.desfazer_vinculo_de_identidade(uuid) from public, anon;
revoke execute on function public.vinculos_pendentes_da_afiliada() from public, anon;
grant execute on function public.pedir_vinculo_de_identidade(uuid, uuid) to authenticated;
grant execute on function public.responder_vinculo_de_identidade(uuid, boolean, text) to authenticated;
grant execute on function public.desfazer_vinculo_de_identidade(uuid) to authenticated;
grant execute on function public.vinculos_pendentes_da_afiliada() to authenticated;
