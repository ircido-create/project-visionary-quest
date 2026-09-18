-- Pautas de reunião: individuais e de equipe, nos dois programas (2026-09-18).
--
-- A tabela `meeting_agendas` nasceu presa a uma afiliada e ao ambiente ONBIO. A pauta de
-- equipe fala do ambiente inteiro, então `influencer_id` passa a aceitar nulo e um campo
-- de escopo diz qual é qual. As políticas continuam as mesmas: quem lê o ambiente lê as
-- pautas dele.

alter table public.meeting_agendas
  alter column influencer_id drop not null;

alter table public.meeting_agendas
  add column if not exists escopo text not null default 'INDIVIDUAL'
  check (escopo in ('INDIVIDUAL', 'EQUIPE'));

-- Pauta individual sem afiliada não faz sentido, e pauta de equipe com afiliada também não.
alter table public.meeting_agendas
  drop constraint if exists meeting_agendas_escopo_coerente;
alter table public.meeting_agendas
  add constraint meeting_agendas_escopo_coerente check (
    (escopo = 'INDIVIDUAL' and influencer_id is not null)
    or (escopo = 'EQUIPE' and influencer_id is null)
  );

create index if not exists idx_meeting_agendas_equipe
  on public.meeting_agendas (tenant_id, created_at desc)
  where escopo = 'EQUIPE';
