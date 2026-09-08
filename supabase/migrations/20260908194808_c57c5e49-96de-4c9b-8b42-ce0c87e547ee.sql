-- ============ ENUMS ============
create type public.platform_role as enum ('platform_owner','platform_admin','support_agent');
create type public.tenant_role as enum ('manager_owner','manager_admin','manager_member','influencer');
create type public.influencer_status as enum (
  'NOVA_INSCRICAO','AGUARDANDO_DIAGNOSTICO','AGUARDANDO_EVIDENCIAS','EM_ESTRUTURACAO','EM_PRODUCAO',
  'EM_CRESCIMENTO','PRONTA_AUDITORIA','QUALIFICADA','ENVIADA_ANALISE','APROVADA','NAO_APROVADA','PAUSADA','ARQUIVADA');
create type public.qualification_status as enum ('QUALIFIED','NOT_QUALIFIED','NEEDS_EVIDENCE','MANUAL_REVIEW');
create type public.tri_state as enum ('SIM','NAO','NAO_SEI');
create type public.ig_profile_type as enum ('PESSOAL','CRIADOR','COMERCIAL','NAO_SEI');
create type public.data_source as enum ('META_API','MANUAL','SCREENSHOT','INTERNAL');
create type public.task_status as enum ('PENDENTE','EM_ANDAMENTO','CONCLUIDA','CANCELADA');
create type public.task_priority as enum ('BAIXA','MEDIA','ALTA');

-- ============ CORE ============
create table public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.platform_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'BRL',
  max_candidates integer not null default 25,
  max_members integer not null default 2,
  max_ai_analyses integer not null default 20,
  storage_mb integer not null default 512,
  custom_branding boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan_id uuid references public.plans(id),
  status text not null default 'ACTIVE',
  is_demo boolean not null default false,
  is_public_page_enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  role public.tenant_role not null default 'manager_member',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index idx_memberships_user on public.tenant_memberships(user_id);

create table public.tenant_branding (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  manager_name text,
  headline text,
  subheadline text,
  authority_quote text,
  bio text,
  whatsapp text,
  instagram_handle text,
  hero_image_url text,
  avatar_url text,
  accent_color text default '#C5A15A',
  updated_at timestamptz not null default now()
);

create table public.qualification_rule_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  version text not null default 'v1',
  is_active boolean not null default true,
  requirements jsonb not null,
  weights jsonb not null,
  created_at timestamptz not null default now()
);

create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid,
  full_name text not null,
  email text not null,
  whatsapp text,
  city text,
  state text,
  instagram_handle text,
  instagram_url text,
  avatar_url text,
  followers integer,
  posts_count integer,
  recent_posts_6m public.tri_state,
  female_audience_pct numeric(5,2),
  profile_type public.ig_profile_type,
  stories_frequency text,
  reels_frequency text,
  topics text,
  asked_about text,
  profile_goal text,
  main_difficulty text,
  daily_time text,
  instagram_goal text,
  initial_followers integer,
  initial_posts_count integer,
  status public.influencer_status not null default 'NOVA_INSCRICAO',
  level text not null default 'Nível 1 — Estruturar',
  progress_score numeric(5,2) not null default 0,
  assigned_to uuid,
  data_source public.data_source not null default 'MANUAL',
  consent_at timestamptz,
  origin text default 'landing',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_influencers_tenant_status on public.influencers(tenant_id, status);
create index idx_influencers_tenant_created on public.influencers(tenant_id, created_at desc);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid references public.influencers(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  consent_version text not null default 'v1',
  submitted_at timestamptz not null default now()
);
create index idx_applications_tenant on public.applications(tenant_id, submitted_at desc);

create table public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  followers integer,
  posts_count integer,
  female_audience_pct numeric(5,2),
  source public.data_source not null default 'MANUAL',
  captured_at timestamptz not null default now(),
  created_by uuid
);
create index idx_snapshots_tenant_infl on public.metric_snapshots(tenant_id, influencer_id, captured_at desc);

create table public.qualification_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  rule_set_version text not null default 'v1',
  status public.qualification_status not null,
  requirements jsonb not null default '[]'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  manual_decision text,
  manual_decision_by uuid,
  manual_decision_note text,
  computed_at timestamptz not null default now()
);
create index idx_qual_tenant_infl on public.qualification_results(tenant_id, influencer_id, computed_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid references public.influencers(id) on delete cascade,
  title text not null,
  description text,
  level text,
  due_date date,
  priority public.task_priority not null default 'MEDIA',
  status public.task_status not null default 'PENDENTE',
  evidence_url text,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_tenant_status on public.tasks(tenant_id, status, due_date);

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  level text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  author_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_notes_tenant_infl on public.notes(tenant_id, influencer_id, created_at desc);

create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  author_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_feedbacks_tenant_infl on public.feedbacks(tenant_id, influencer_id, created_at desc);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid references public.influencers(id) on delete cascade,
  storage_path text not null,
  kind text not null default 'insight',
  mime_type text,
  size_bytes integer,
  confirmed boolean not null default false,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index idx_files_tenant_infl on public.files(tenant_id, influencer_id, created_at desc);

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  from_status public.influencer_status,
  to_status public.influencer_status not null,
  changed_by uuid,
  note text,
  created_at timestamptz not null default now()
);
create index idx_status_hist on public.status_history(tenant_id, influencer_id, created_at desc);

create table public.consent_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  influencer_id uuid references public.influencers(id) on delete cascade,
  purpose text not null,
  version text not null default 'v1',
  accepted_at timestamptz not null default now(),
  source text
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_tenant on public.audit_logs(tenant_id, created_at desc);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role public.tenant_role not null default 'manager_member',
  invited_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

-- ============ HELPERS ============
create or replace function public.is_tenant_member(_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenant_memberships m where m.tenant_id = _tenant and m.user_id = auth.uid())
$$;

create or replace function public.has_tenant_role(_tenant uuid, _roles public.tenant_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenant_memberships m
    where m.tenant_id = _tenant and m.user_id = auth.uid() and m.role = any(_roles))
$$;

create or replace function public.tenant_is_demo(_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select t.is_demo from public.tenants t where t.id = _tenant), false)
$$;

create or replace function public.has_platform_role(_user_id uuid, _role public.platform_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_roles r where r.user_id = _user_id and r.role = _role)
$$;

create or replace function public.can_read_tenant(_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_tenant_member(_tenant)
     or public.tenant_is_demo(_tenant)
     or public.has_platform_role(auth.uid(), 'platform_owner')
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_tenants_touch before update on public.tenants for each row execute function public.touch_updated_at();
create trigger trg_influencers_touch before update on public.influencers for each row execute function public.touch_updated_at();
create trigger trg_tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ============ GRANTS ============
grant select, insert, update, delete on public.profiles, public.tenants, public.tenant_memberships,
  public.tenant_branding, public.influencers, public.applications, public.metric_snapshots,
  public.qualification_results, public.tasks, public.task_templates, public.notes, public.feedbacks,
  public.files, public.status_history, public.consent_logs, public.invitations,
  public.qualification_rule_sets to authenticated;
grant select on public.plans, public.platform_roles, public.audit_logs to authenticated;
grant select on public.tenants, public.tenant_branding, public.plans to anon;
grant all on public.profiles, public.tenants, public.tenant_memberships, public.tenant_branding,
  public.influencers, public.applications, public.metric_snapshots, public.qualification_results,
  public.tasks, public.task_templates, public.notes, public.feedbacks, public.files,
  public.status_history, public.consent_logs, public.invitations, public.audit_logs,
  public.plans, public.platform_roles, public.qualification_rule_sets to service_role;

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.platform_roles enable row level security;
alter table public.plans enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_branding enable row level security;
alter table public.qualification_rule_sets enable row level security;
alter table public.influencers enable row level security;
alter table public.applications enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.qualification_results enable row level security;
alter table public.tasks enable row level security;
alter table public.task_templates enable row level security;
alter table public.notes enable row level security;
alter table public.feedbacks enable row level security;
alter table public.files enable row level security;
alter table public.status_history enable row level security;
alter table public.consent_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.invitations enable row level security;

create policy "profiles_self_read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_self_write" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_self_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "platform_roles_self_read" on public.platform_roles for select to authenticated using (user_id = auth.uid());

create policy "plans_public_read" on public.plans for select to anon, authenticated using (is_active);

create policy "tenants_public_pages" on public.tenants for select to anon using (is_public_page_enabled);
create policy "tenants_member_read" on public.tenants for select to authenticated using (public.can_read_tenant(id));
create policy "tenants_create_own" on public.tenants for insert to authenticated with check (created_by = auth.uid());
create policy "tenants_admin_update" on public.tenants for update to authenticated
  using (public.has_tenant_role(id, array['manager_owner','manager_admin']::public.tenant_role[]))
  with check (public.has_tenant_role(id, array['manager_owner','manager_admin']::public.tenant_role[]));

create policy "memberships_read" on public.tenant_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_tenant_member(tenant_id));
create policy "memberships_self_insert" on public.tenant_memberships for insert to authenticated
  with check (user_id = auth.uid() or public.has_tenant_role(tenant_id, array['manager_owner','manager_admin']::public.tenant_role[]));
create policy "memberships_admin_delete" on public.tenant_memberships for delete to authenticated
  using (public.has_tenant_role(tenant_id, array['manager_owner','manager_admin']::public.tenant_role[]));

create policy "branding_public_read" on public.tenant_branding for select to anon using (true);
create policy "branding_member_read" on public.tenant_branding for select to authenticated using (public.can_read_tenant(tenant_id));
create policy "branding_admin_write" on public.tenant_branding for all to authenticated
  using (public.has_tenant_role(tenant_id, array['manager_owner','manager_admin']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['manager_owner','manager_admin']::public.tenant_role[]));

create policy "rulesets_read" on public.qualification_rule_sets for select to authenticated
  using (tenant_id is null or public.can_read_tenant(tenant_id));
create policy "rulesets_write" on public.qualification_rule_sets for all to authenticated
  using (tenant_id is not null and public.has_tenant_role(tenant_id, array['manager_owner','manager_admin']::public.tenant_role[]))
  with check (tenant_id is not null and public.has_tenant_role(tenant_id, array['manager_owner','manager_admin']::public.tenant_role[]));

-- tenant-scoped tables: read for members/demo, write for members only
do $$
declare t text;
begin
  foreach t in array array['influencers','applications','metric_snapshots','qualification_results',
    'tasks','notes','feedbacks','files','status_history','consent_logs','invitations','task_templates']
  loop
    execute format('create policy "%1$s_member_read" on public.%1$s for select to authenticated using (public.can_read_tenant(tenant_id))', t);
    execute format('create policy "%1$s_member_write" on public.%1$s for insert to authenticated with check (public.is_tenant_member(tenant_id))', t);
    execute format('create policy "%1$s_member_update" on public.%1$s for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id))', t);
    execute format('create policy "%1$s_member_delete" on public.%1$s for delete to authenticated using (public.is_tenant_member(tenant_id))', t);
  end loop;
end $$;

create policy "audit_member_read" on public.audit_logs for select to authenticated using (tenant_id is not null and public.is_tenant_member(tenant_id));