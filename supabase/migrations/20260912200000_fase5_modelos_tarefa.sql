-- Fase 5 — Modelos de tarefa por nível.
--
-- Roda inteira de uma vez no SQL editor: mexe só no schema `public`. É aditiva — as
-- colunas novas têm padrão ou aceitam nulo, e `task_templates` está vazia.
--
-- O QUE MUDA
--
-- - `task_templates` ganha prazo padrão em dias, prioridade e ordem dentro do nível.
-- - `tasks.template_id` liga a tarefa ao modelo que a gerou. É o que permite sugerir só
--   o que a candidata ainda não tem sem depender de comparar títulos. Se o modelo for
--   removido, a tarefa continua e perde só o vínculo.
--
-- O QUE NÃO MUDA
--
-- As políticas de acesso. Os modelos são de cada ambiente (decisão de 2026-09-12); os de
-- `tenant_id` nulo, "gerais do método", continuam invisíveis para as gestoras e ficam
-- para depois. Quem edita — dona e administradora — é conferido no servidor, como na
-- auditoria.

alter table public.task_templates
  add column if not exists due_in_days integer check (due_in_days between 0 and 90),
  add column if not exists priority public.task_priority not null default 'MEDIA',
  add column if not exists sort_order integer not null default 0;

create index if not exists task_templates_tenant_level_idx
  on public.task_templates (tenant_id, level, sort_order);

alter table public.tasks
  add column if not exists template_id uuid
    references public.task_templates (id) on delete set null;

create index if not exists tasks_influencer_template_idx
  on public.tasks (influencer_id, template_id)
  where template_id is not null;
