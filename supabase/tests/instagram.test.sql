-- Testes de integração da integração Meta/Instagram (fase 4).
--
-- COMO RODAR
--
-- Igual ao `rls.test.sql`: cole inteiro no SQL editor e execute. Termina em `rollback`,
-- então nada é gravado — pode rodar em produção. Cada linha do resultado é uma
-- verificação, com PASSOU ou FALHOU.
--
-- O QUE ESTÁ SOB TESTE
--
-- Uma afirmação só, mas a que sustenta o desenho todo: **o token da candidata não é
-- alcançável por mais ninguém** — nem pela gestora do ambiente, nem por outra
-- candidata, nem pela própria dona por fora das funções.
--
-- O teste tem controle embutido, e é isso que o torna informativo: a dona e a gestora
-- chamam a MESMA função, com o mesmo acesso ao Vault. A dona recebe o token; a gestora
-- recebe exceção. A única diferença entre os dois casos é a checagem de dono, então é
-- ela que está segurando — e não algum acidente de permissão do Vault.

begin;

create temporary table r (ordem serial, verificacao text, passou boolean) on commit drop;
create temporary table f on commit drop as
select '00000000-0000-4000-8000-0000000ff001'::uuid as tenant,
       '00000000-0000-4000-8000-0000000ff002'::uuid as gestora,
       '00000000-0000-4000-8000-0000000ff003'::uuid as candidata_a,
       '00000000-0000-4000-8000-0000000ff004'::uuid as candidata_b,
       '00000000-0000-4000-8000-0000000ff005'::uuid as inf_a,
       '00000000-0000-4000-8000-0000000ff006'::uuid as inf_b;

grant select on f to authenticated;
grant insert, select on r to authenticated;
grant usage on all sequences in schema pg_temp to authenticated;

insert into public.tenants (id, name, slug, status, is_demo, is_public_page_enabled, plan_id)
select tenant, 'Teste Meta', 'teste-meta-rls', 'ACTIVE', false, false,
       (select id from public.plans where code='premium') from f;
insert into public.tenant_memberships (tenant_id, user_id, role)
select tenant, gestora, 'manager_owner'::tenant_role from f;
insert into public.influencers (id, tenant_id, full_name, email, user_id)
select inf_a, tenant, 'Candidata A', 'a@teste.local', candidata_a from f
union all
select inf_b, tenant, 'Candidata B', 'b@teste.local', candidata_b from f;

-- ---------------------------------------------------------------------------
-- A dona da conta
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000ff003","role":"authenticated"}';

do $$
begin
  perform public.instagram_connect((select inf_a from f), '17841400000000000', 'candidata.a',
                                   'TOKEN-SECRETO-XYZ', now() + interval '60 days',
                                   'instagram_business_basic');
  insert into r (verificacao, passou) values ('candidata conecta a própria conta', true);
exception when others then
  insert into r (verificacao, passou) values ('candidata conecta a própria conta: '||sqlerrm, false);
end $$;

insert into r (verificacao, passou)
select 'dona lê o próprio token', public.instagram_token((select inf_a from f)) = 'TOKEN-SECRETO-XYZ';

-- RLS ligada e zero policies: a tabela existe mas não é alcançável por ninguém.
insert into r (verificacao, passou)
select 'tabela é inalcançável mesmo para a dona',
       not exists (select 1 from public.instagram_connections);

-- ---------------------------------------------------------------------------
-- Outra candidata do mesmo ambiente
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000ff004","role":"authenticated"}';

do $$
declare _t text; _recusou boolean := false;
begin
  begin
    _t := public.instagram_token((select inf_a from f));
  exception when insufficient_privilege then _recusou := true;
  end;
  insert into r (verificacao, passou) values ('outra candidata NÃO lê o token alheio', _recusou);
end $$;

-- ---------------------------------------------------------------------------
-- A gestora: vê o status, nunca o segredo
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000ff002","role":"authenticated"}';

do $$
declare _t text; _recusou boolean := false;
begin
  begin
    _t := public.instagram_token((select inf_a from f));
  exception when insufficient_privilege then _recusou := true;
  end;
  insert into r (verificacao, passou) values ('gestora NÃO lê o token da candidata', _recusou);
end $$;

insert into r (verificacao, passou)
select 'gestora VÊ o status da conexão',
       (public.instagram_status((select inf_a from f)) ->> 'usuario') = 'candidata.a';

insert into r (verificacao, passou)
select 'status não devolve o token em lugar nenhum',
       public.instagram_status((select inf_a from f))::text not like '%TOKEN-SECRETO%';

do $$
declare _recusou boolean := false;
begin
  begin
    perform public.instagram_disconnect((select inf_a from f));
  exception when insufficient_privilege then _recusou := true;
  end;
  insert into r (verificacao, passou) values ('gestora NÃO desconecta pela candidata', _recusou);
end $$;

-- ---------------------------------------------------------------------------
reset role;

select case when passou then 'PASSOU' else '>>> FALHOU' end as situacao, verificacao
  from r order by ordem;

rollback;
