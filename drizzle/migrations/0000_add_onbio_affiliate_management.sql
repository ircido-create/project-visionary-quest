ALTER TABLE public.tenants
  ADD COLUMN module text NOT NULL DEFAULT 'YBERA'
  CHECK (module IN ('YBERA', 'ONBIO'));

ALTER TABLE public.influencers
  ADD COLUMN person_id uuid;

CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY people_read ON public.people FOR SELECT TO authenticated
USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.influencers i
    WHERE i.person_id = people.id AND public.can_read_tenant(i.tenant_id)
  )
);
CREATE POLICY people_insert ON public.people FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY people_update ON public.people FOR UPDATE TO authenticated
USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.influencers i
    WHERE i.person_id = people.id AND public.is_tenant_member(i.tenant_id)
  )
)
WITH CHECK (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.influencers i
    WHERE i.person_id = people.id AND public.is_tenant_member(i.tenant_id)
  )
);
CREATE POLICY people_delete ON public.people FOR DELETE TO authenticated
USING (created_by = auth.uid());
CREATE TRIGGER trg_people_touch BEFORE UPDATE ON public.people
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.influencers
  ADD CONSTRAINT influencers_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;
CREATE INDEX idx_influencers_person ON public.influencers(person_id) WHERE person_id IS NOT NULL;
CREATE UNIQUE INDEX idx_influencers_tenant_person
  ON public.influencers(tenant_id, person_id) WHERE person_id IS NOT NULL;

CREATE TABLE public.commercial_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  revenue_cents integer NOT NULL DEFAULT 0 CHECK (revenue_cents >= 0),
  orders integer NOT NULL DEFAULT 0 CHECK (orders >= 0),
  commission_cents integer NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
  goal_cents integer CHECK (goal_cents IS NULL OR goal_cents >= 0),
  campaign text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_results TO authenticated;
GRANT ALL ON public.commercial_results TO service_role;
ALTER TABLE public.commercial_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY commercial_results_read ON public.commercial_results FOR SELECT TO authenticated
USING (public.can_read_tenant(tenant_id));
CREATE POLICY commercial_results_insert ON public.commercial_results FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY commercial_results_update ON public.commercial_results FOR UPDATE TO authenticated
USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY commercial_results_delete ON public.commercial_results FOR DELETE TO authenticated
USING (public.is_tenant_member(tenant_id));
CREATE INDEX idx_commercial_results_affiliate
  ON public.commercial_results(tenant_id, influencer_id, period_end DESC);
CREATE TRIGGER trg_commercial_results_touch BEFORE UPDATE ON public.commercial_results
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.meeting_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  period_start date,
  period_end date,
  prompt_version text NOT NULL,
  model text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  status public.ai_analysis_status NOT NULL DEFAULT 'PENDENTE',
  error text,
  confirmed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_agendas TO authenticated;
GRANT ALL ON public.meeting_agendas TO service_role;
ALTER TABLE public.meeting_agendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY meeting_agendas_read ON public.meeting_agendas FOR SELECT TO authenticated
USING (public.can_read_tenant(tenant_id));
CREATE POLICY meeting_agendas_insert ON public.meeting_agendas FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY meeting_agendas_update ON public.meeting_agendas FOR UPDATE TO authenticated
USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY meeting_agendas_delete ON public.meeting_agendas FOR DELETE TO authenticated
USING (public.is_tenant_member(tenant_id));
CREATE INDEX idx_meeting_agendas_affiliate
  ON public.meeting_agendas(tenant_id, influencer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.proteger_colunas_de_plataforma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null
     or public.has_platform_role(auth.uid(), 'platform_owner')
     or coalesce(current_setting('mcb.assinatura', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_demo := false;
    new.status := 'ACTIVE';
    new.plan_id := (select id from public.plans where code = 'essencial');
    new.created_by := auth.uid();
    new.cobranca := 'AVALIACAO';
    new.vence_em := now() + interval '14 days';
    new.cancelada_em := null;
    new.suspensao_motivo := null;
    new.module := 'YBERA';
    return new;
  end if;

  if new.plan_id is distinct from old.plan_id
     or new.status is distinct from old.status
     or new.is_demo is distinct from old.is_demo
     or new.created_by is distinct from old.created_by
     or new.cobranca is distinct from old.cobranca
     or new.vence_em is distinct from old.vence_em
     or new.cancelada_em is distinct from old.cancelada_em
     or new.suspensao_motivo is distinct from old.suspensao_motivo
     or new.module is distinct from old.module then
    raise exception 'Plano, módulo, situação e assinatura do ambiente só mudam pela administração da plataforma.'
      using errcode = '42501';
  end if;
  return new;
end
$function$;