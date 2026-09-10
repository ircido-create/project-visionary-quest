-- Testes de integração das políticas de acesso.
--
-- COMO RODAR
--
-- Cole o arquivo inteiro no SQL editor e execute. Ele termina em `rollback`, então
-- **nada é gravado** — pode rodar em produção. A última consulta devolve uma linha por
-- verificação, com PASSOU ou FALHOU.
--
-- POR QUE EM SQL E NÃO EM VITEST
--
-- O que está sob teste é comportamento do Postgres: políticas de RLS e funções
-- `security definer`. Reproduzir isso em JavaScript exigiria um banco descartável e uma
-- imitação do schema `auth` do Supabase — mais peças para manter, e ainda assim sem
-- cobrir as políticas de Storage. Aqui a verificação roda contra o banco de verdade.
--
-- O preço, dito de frente: isto não roda no `bun run test`. É verificação sob demanda,
-- não rede de proteção automática.
--
-- COMO FUNCIONA A SIMULAÇÃO
--
-- `set local role authenticated` + `set local request.jwt.claims` fazem o Postgres
-- enxergar a sessão como o PostgREST a entregaria; `auth.uid()` lê o `sub` dali. Os
-- uuids são inventados: `tenant_memberships.user_id` não tem chave estrangeira para
-- `auth.users`, então não é preciso mexer em usuários reais.
--
-- DUAS ARMADILHAS QUE CUSTARAM TEMPO
--
-- 1. Inserção recusada por RLS levanta erro e **aborta a transação inteira**. Para
--    verificar uma recusa sem derrubar o resto, a tentativa vai dentro de um bloco que
--    captura `insufficient_privilege`.
-- 2. Um CTE que modifica dados não pode ficar dentro de subconsulta. Onde é preciso
--    contar linhas afetadas, o teste usa bloco `do` com `get diagnostics`.

begin;

create temporary table resultado (ordem serial, verificacao text, passou boolean) on commit drop;

create temporary table fixo on commit drop as
select
  '00000000-0000-4000-8000-00000000a001'::uuid as tenant_ativo,
  '00000000-0000-4000-8000-00000000a002'::uuid as tenant_suspenso,
  '00000000-0000-4000-8000-00000000b001'::uuid as gestora,
  '00000000-0000-4000-8000-00000000b002'::uuid as estranha,
  '00000000-0000-4000-8000-00000000b003'::uuid as candidata,
  '00000000-0000-4000-8000-00000000c001'::uuid as influencer_ativo,
  '00000000-0000-4000-8000-00000000c002'::uuid as tarefa_da_candidata,
  '00000000-0000-4000-8000-00000000c003'::uuid as tarefa_alheia;

-- O papel `authenticated` precisa de permissão explícita nas tabelas temporárias.
grant select on fixo to authenticated;
grant insert, select on resultado to authenticated;
grant usage on all sequences in schema pg_temp to authenticated;

insert into public.tenants (id, name, slug, status, is_demo, is_public_page_enabled, plan_id)
select tenant_ativo, 'Teste Ativo', 'teste-rls-ativo', 'ACTIVE', false, false,
       (select id from public.plans where code = 'premium') from fixo
union all
select tenant_suspenso, 'Teste Suspenso', 'teste-rls-suspenso', 'SUSPENDED', false, false,
       (select id from public.plans where code = 'premium') from fixo;

insert into public.tenant_memberships (tenant_id, user_id, role)
select tenant_ativo, gestora, 'manager_owner'::tenant_role from fixo
union all
select tenant_suspenso, gestora, 'manager_owner'::tenant_role from fixo;

insert into public.influencers (id, tenant_id, full_name, email, user_id)
select influencer_ativo, tenant_ativo, 'Candidata de Teste', 'candidata@teste.local', candidata
  from fixo;

insert into public.tasks (id, tenant_id, influencer_id, title, status)
select tarefa_da_candidata, tenant_ativo, influencer_ativo, 'Tarefa de teste',
       'PENDENTE'::task_status from fixo
union all
select tarefa_alheia, tenant_ativo, null, 'Tarefa alheia', 'PENDENTE'::task_status from fixo;

-- Texto reconhecível: serve para provar que o portal da candidata não o devolve.
insert into public.notes (tenant_id, influencer_id, body)
select tenant_ativo, influencer_ativo, 'SEGREDO_DA_GESTORA: avaliar com cuidado' from fixo;

-- ---------------------------------------------------------------------------
-- Gestora, ambiente ativo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-00000000b001","role":"authenticated"}';

insert into resultado (verificacao, passou)
select 'gestora lê o próprio ambiente', public.can_read_tenant((select tenant_ativo from fixo));

insert into resultado (verificacao, passou)
select 'gestora pode escrever no ambiente ativo',
       public.is_tenant_member((select tenant_ativo from fixo));

insert into resultado (verificacao, passou)
select 'gestora enxerga a candidata do próprio ambiente',
       exists (select 1 from public.influencers where id = (select influencer_ativo from fixo));

do $$
declare _n integer;
begin
  insert into public.audit_logs (tenant_id, actor_id, action)
  select tenant_ativo, gestora, 'teste.proprio' from fixo;
  get diagnostics _n = row_count;
  insert into resultado (verificacao, passou)
  values ('gestora registra auditoria em seu próprio nome', _n = 1);
exception when others then
  insert into resultado (verificacao, passou)
  values ('gestora registra auditoria em seu próprio nome', false);
end $$;

do $$
declare _recusou boolean;
begin
  begin
    insert into public.audit_logs (tenant_id, actor_id, action)
    select tenant_ativo, estranha, 'teste.forjado' from fixo;
    _recusou := false;
  exception when insufficient_privilege then
    _recusou := true;
  end;
  insert into resultado (verificacao, passou)
  values ('gestora NÃO forja auditoria em nome de outra', _recusou);
end $$;

-- ---------------------------------------------------------------------------
-- Gestora, ambiente suspenso: lê, mas não escreve nem se reativa
-- ---------------------------------------------------------------------------
insert into resultado (verificacao, passou)
select 'ambiente suspenso continua legível',
       public.can_read_tenant((select tenant_suspenso from fixo));

insert into resultado (verificacao, passou)
select 'ambiente suspenso bloqueia escrita',
       not public.is_tenant_member((select tenant_suspenso from fixo));

insert into resultado (verificacao, passou)
select 'dona de ambiente suspenso não o reativa sozinha',
       not public.has_tenant_role((select tenant_suspenso from fixo),
                                  ARRAY['manager_owner'::tenant_role]);

-- ---------------------------------------------------------------------------
-- Alguém sem vínculo nenhum
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-00000000b002","role":"authenticated"}';

insert into resultado (verificacao, passou)
select 'estranha não lê ambiente alheio',
       not public.can_read_tenant((select tenant_ativo from fixo));

insert into resultado (verificacao, passou)
select 'estranha não enxerga candidata alheia',
       not exists (select 1 from public.influencers where id = (select influencer_ativo from fixo));

do $$
declare _n integer;
begin
  update public.tenants set name = 'invadido' where id = (select tenant_ativo from fixo);
  get diagnostics _n = row_count;
  insert into resultado (verificacao, passou)
  values ('estranha não altera ambiente alheio', _n = 0);
end $$;

-- ---------------------------------------------------------------------------
-- Candidata: sem membresia, enxerga só o que é dela — e só pelo portal
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-00000000b003","role":"authenticated"}';

insert into resultado (verificacao, passou)
select 'candidata não vira membro do ambiente',
       not public.is_tenant_member((select tenant_ativo from fixo));

-- Isto é o desenho funcionando, não uma limitação: a candidata alcança as próprias
-- tarefas apenas pelas funções `security definer`, nunca pela tabela.
insert into resultado (verificacao, passou)
select 'candidata NÃO lê a tabela de tarefas diretamente',
       not exists (select 1 from public.tasks where id = (select tarefa_da_candidata from fixo));

insert into resultado (verificacao, passou)
select 'portal devolve exatamente a candidatura dela',
       jsonb_array_length(public.get_portal_data()) = 1;

insert into resultado (verificacao, passou)
select 'portal não vaza a nota interna da gestora',
       public.get_portal_data()::text not like '%SEGREDO_DA_GESTORA%';

insert into resultado (verificacao, passou)
select 'candidata conclui a própria tarefa',
       public.influencer_set_task_status((select tarefa_da_candidata from fixo),
                                         'CONCLUIDA'::task_status);

insert into resultado (verificacao, passou)
select 'a conclusão aparece no portal dela',
       exists (
         select 1
           from jsonb_array_elements(public.get_portal_data()) c,
                jsonb_array_elements(c -> 'tarefas') t
          where t ->> 'id' = (select tarefa_da_candidata from fixo)::text
            and t ->> 'status' = 'CONCLUIDA'
       );

insert into resultado (verificacao, passou)
select 'candidata não conclui tarefa que não é dela',
       not public.influencer_set_task_status((select tarefa_alheia from fixo),
                                             'CONCLUIDA'::task_status);

-- ---------------------------------------------------------------------------
reset role;

select
  case when passou then 'PASSOU' else '>>> FALHOU' end as situacao,
  verificacao
  from resultado
 order by ordem;

rollback;
