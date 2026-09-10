# MCB — Método Criadora Blessing (Fase 1)

## Arquitetura

- TanStack Start (React 19 + Vite) com rotas em `src/routes`.
- Backend Lovable Cloud (Postgres + Auth + Storage), acessado por server functions
  (`src/lib/mcb/app.functions.ts` autenticadas, `src/lib/mcb/public.functions.ts` públicas).
- Multi-tenant: toda tabela de dados tem `tenant_id` e políticas RLS baseadas em
  `is_tenant_member`, `has_tenant_role`, `can_read_tenant` e `tenant_is_demo`.
- Ambientes de demonstração (`tenants.is_demo = true`) são somente leitura na interface.

## Regras determinísticas de qualificação (v1)

Definidas em `src/lib/mcb/qualification.ts` e cobertas por testes em
`qualification.test.ts`:

| Critério | Regra |
| --- | --- |
| Seguidores | maior ou igual a 500 |
| Publicações | mais de 30 (31+) |
| Publicações recentes | pelo menos 12 nos últimos 6 meses |
| Tipo de perfil | Criador de conteúdo |
| Público feminino | estritamente acima de 50% |

Dado ausente nunca qualifica: gera pendência (`NEEDS_EVIDENCE`) e não falha a candidata.
Resultados possíveis: `QUALIFIED`, `NOT_QUALIFIED`, `NEEDS_EVIDENCE`, `MANUAL_REVIEW`.
O progresso (0–100) soma pesos de dados objetivos e de sinais de estruturação do perfil.

## Fluxos entregues

1. Landing pública `/` com método, critérios e planos.
2. Página pública por gestora `/g/:slug` com o formulário Porta de Entrada e consentimento LGPD.
3. Autenticação em `/auth` (e-mail/senha e Google) com área protegida em `_authenticated`.
4. Visão geral, candidatas (lista e detalhe), tarefas e configurações.
5. Histórico de status, snapshots de métricas, notas, feedbacks e trilha de auditoria.

## Dados do Instagram

Nesta fase os números são informados manualmente ou por print, com confirmação humana e
registro da fonte (`data_source`). A estrutura (`metric_snapshots`, `files`) já está pronta
para a integração oficial da Meta.

A integração chegou na fase 4 e usa o mesmo `data_source`, agora com `META_API` — ver
`docs/integracao-meta.md`. Ela **não substitui** o print: a Meta só informa a divisão de
público por gênero a partir de 100 seguidores, e abaixo disso o print continua sendo o
único caminho.

## LGPD

- Consentimento versionado registrado em `consent_logs` a cada candidatura.
- Aviso explícito de que a plataforma não garante aprovação em nenhum programa.
- `audit_logs` guarda quem fez o quê, quando e em qual ambiente.

## Próximas fases

Ver `roadmap.md`.

## Funções auxiliares de permissão

`is_tenant_member`, `has_tenant_role`, `tenant_is_demo`, `has_platform_role`,
`can_read_tenant` e `shares_tenant_with` são `security definer` por necessidade, não por
descuido: sem isso, uma política em `tenant_memberships` que consulta
`tenant_memberships` entraria em recursão infinita. É o padrão recomendado para
funções usadas dentro de políticas RLS.

Revisadas em 2026-09-10: todas com `search_path=public` fixo, nenhuma executável por
`anon`, todas concedidas a `authenticated`. As do portal
(`link_influencer_account`, `get_portal_data`, `influencer_set_task_status`) seguem a
mesma regra.

Ao criar uma função nova nesse formato, repetir os três cuidados:
`set search_path = public`, `revoke execute ... from anon, public` e
`grant execute ... to authenticated`.
