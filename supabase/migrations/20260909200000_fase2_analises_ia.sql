-- Fase 2 (item 2) — Análises de perfil por IA, auditáveis.
--
-- Ao contrário da migração das evidências, esta roda inteira de uma vez no SQL editor:
-- mexe só no schema `public`, onde o papel do editor é dono. Não precisa da UI.
--
-- O que a tabela existe para garantir: toda análise guarda o que entrou, o que saiu,
-- com qual prompt e com qual modelo. Sem isso não dá para explicar meses depois por que
-- uma candidata recebeu determinada leitura, nem comparar versões de prompt.

create type public.ai_analysis_status as enum ('PENDENTE', 'CONCLUIDA', 'ERRO');

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,

  -- Rastreabilidade do que produziu o resultado. Ambos obrigatórios de propósito:
  -- uma análise sem prompt e sem modelo é um número sem procedência.
  prompt_version text not null,
  model text not null,

  -- Provedor-agnóstico. `input` guarda o que foi enviado (incluindo quais evidências
  -- entraram); `output` guarda a resposta como veio, antes de qualquer interpretação.
  input jsonb not null default '{}'::jsonb,
  output jsonb,

  status public.ai_analysis_status not null default 'PENDENTE',
  error text,

  -- Mesma regra das evidências: o que a IA devolve não vale sozinho. Uma pessoa
  -- precisa aceitar antes de a leitura ser tratada como boa. Espelha files.confirmed.
  confirmed boolean not null default false,

  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.ai_analyses is
  'Analises de perfil por IA. Guarda entrada, saida, versao do prompt e modelo para auditoria.';
comment on column public.ai_analyses.confirmed is
  'Uma pessoa revisou a saida da IA e aceitou. Saida nao confirmada nao vale como leitura.';

-- Listagem por candidata (a tela de detalhe) segue o mesmo formato do indice de files.
create index idx_ai_analyses_tenant_infl
  on public.ai_analyses(tenant_id, influencer_id, created_at desc);

-- `plans.max_ai_analyses` limita por ambiente, então a contagem por tenant e periodo
-- precisa ser barata.
create index idx_ai_analyses_tenant_created
  on public.ai_analyses(tenant_id, created_at desc);

alter table public.ai_analyses enable row level security;

-- Mesmos nomes e mesmas regras que o bloco da fase 1 gera para as demais tabelas do
-- tenant: leitura para membros e ambientes de demonstração, escrita só para membros.
create policy "ai_analyses_member_read" on public.ai_analyses
  for select to authenticated using (public.can_read_tenant(tenant_id));

create policy "ai_analyses_member_write" on public.ai_analyses
  for insert to authenticated with check (public.is_tenant_member(tenant_id));

create policy "ai_analyses_member_update" on public.ai_analyses
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "ai_analyses_member_delete" on public.ai_analyses
  for delete to authenticated using (public.is_tenant_member(tenant_id));
