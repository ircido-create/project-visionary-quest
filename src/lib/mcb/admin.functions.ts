/**
 * Fase 3 — Superadministração.
 *
 * Quem é `platform_owner` enxerga todos os ambientes (o `can_read_tenant` já concedia
 * isso desde a fase 1) e passa a poder trocar o plano e suspender.
 *
 * A checagem de papel é feita aqui **além** da política de RLS. A política é a garantia
 * de verdade; esta é a que produz uma mensagem compreensível em vez de um erro cru de
 * violação de política.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "@/lib/mcb/audit";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient<Database>;

export async function exigirSuperadmin(supabase: Db, userId: string) {
  const { data } = await supabase
    .from("platform_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_owner")
    .maybeSingle();

  if (!data) throw new Error("Esta área é restrita à administração da plataforma.");
}

export type AmbienteNaVisaoGeral = {
  id: string;
  nome: string;
  slug: string;
  status: string;
  isDemo: boolean;
  criadoEm: string;
  plano: { id: string; nome: string } | null;
  cobranca: string;
  venceEm: string | null;
  suspensaoMotivo: string | null;
  precoCentavos: number | null;
  dona: { nome: string | null; email: string | null } | null;
  uso: {
    candidatas: number;
    membros: number;
    analisesNoMes: number;
    armazenamentoMb: number;
  };
  limites: {
    candidatas: number;
    membros: number;
    analises: number;
    armazenamentoMb: number;
  } | null;
};

/**
 * Uma consulta por tabela, agrupando em memória — e não uma consulta por ambiente.
 * A plataforma tem dezenas de gestoras, não milhares; se um dia tiver, isto vira uma
 * view materializada em vez de crescer em número de idas ao banco.
 */
export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await exigirSuperadmin(supabase, userId);

    const inicioDoMes = (() => {
      const agora = new Date();
      return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
    })();

    const [tenants, planos, influencers, memberships, analises, arquivos, contatos] =
      await Promise.all([
        supabase.from("tenants").select("*").order("created_at"),
        supabase
          .from("plans")
          .select(
            "id, name, max_candidates, max_members, max_ai_analyses, storage_mb, price_cents",
          ),
        supabase.from("influencers").select("tenant_id"),
        supabase.from("tenant_memberships").select("tenant_id"),
        supabase.from("ai_analyses").select("tenant_id").gte("created_at", inicioDoMes),
        supabase.from("files").select("tenant_id, size_bytes"),
        // A administração não é membro dos ambientes: o contato vem de uma função própria.
        supabase.rpc("plataforma_contatos_das_donas"),
      ]);

    const contar = (linhas: Array<{ tenant_id: string }> | null) => {
      const mapa = new Map<string, number>();
      for (const linha of linhas ?? []) {
        mapa.set(linha.tenant_id, (mapa.get(linha.tenant_id) ?? 0) + 1);
      }
      return mapa;
    };

    const porCandidatas = contar(influencers.data);
    const porMembros = contar(memberships.data);
    const porAnalises = contar(analises.data);

    const porBytes = new Map<string, number>();
    for (const arquivo of arquivos.data ?? []) {
      porBytes.set(
        arquivo.tenant_id,
        (porBytes.get(arquivo.tenant_id) ?? 0) + (arquivo.size_bytes ?? 0),
      );
    }

    const planoPorId = new Map((planos.data ?? []).map((p) => [p.id, p]));
    const donaPorAmbiente = new Map(
      (contatos.data ?? []).map((c) => [c.tenant_id, { nome: c.nome, email: c.email }]),
    );

    const ambientes: AmbienteNaVisaoGeral[] = (tenants.data ?? []).map((t) => {
      const plano = t.plan_id ? (planoPorId.get(t.plan_id) ?? null) : null;
      return {
        id: t.id,
        nome: t.name,
        slug: t.slug,
        status: t.status,
        isDemo: t.is_demo,
        criadoEm: t.created_at,
        plano: plano ? { id: plano.id, nome: plano.name } : null,
        cobranca: t.cobranca,
        venceEm: t.vence_em,
        suspensaoMotivo: t.suspensao_motivo,
        precoCentavos: plano ? plano.price_cents : null,
        dona: donaPorAmbiente.get(t.id) ?? null,
        uso: {
          candidatas: porCandidatas.get(t.id) ?? 0,
          membros: porMembros.get(t.id) ?? 0,
          analisesNoMes: porAnalises.get(t.id) ?? 0,
          armazenamentoMb: Math.round(((porBytes.get(t.id) ?? 0) / (1024 * 1024)) * 10) / 10,
        },
        limites: plano
          ? {
              candidatas: plano.max_candidates,
              membros: plano.max_members,
              analises: plano.max_ai_analyses,
              armazenamentoMb: plano.storage_mb,
            }
          : null,
      };
    });

    return {
      ambientes,
      planos: (planos.data ?? []).map((p) => ({ id: p.id, nome: p.name })),
    };
  });

export const setTenantPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; planId: string }) =>
    z.object({ tenantId: z.string().uuid(), planId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirSuperadmin(supabase, userId);

    const { error } = await supabase
      .from("tenants")
      .update({ plan_id: data.planId })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "platform.plan_changed",
      entity: "tenants",
      entity_id: data.tenantId,
      meta: { plan_id: data.planId },
    });

    return { ok: true };
  });

/**
 * Suspender é somente leitura, não bloqueio: a gestora continua vendo os dados dela.
 * A regra vive no banco — `is_tenant_member` exige ambiente ativo, e toda política de
 * escrita passa por ela.
 */
export const setTenantStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; status: "ACTIVE" | "SUSPENDED" }) =>
    z.object({ tenantId: z.string().uuid(), status: z.enum(["ACTIVE", "SUSPENDED"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirSuperadmin(supabase, userId);

    const { error } = await supabase
      .from("tenants")
      // O motivo separa a suspensão manual da por vencimento: só esta o pagamento desfaz.
      .update({
        status: data.status,
        suspensao_motivo: data.status === "SUSPENDED" ? "ADMINISTRACAO" : null,
      })
      .eq("id", data.tenantId);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action:
        data.status === "SUSPENDED" ? "platform.tenant_suspended" : "platform.tenant_reactivated",
      entity: "tenants",
      entity_id: data.tenantId,
    });

    return { ok: true };
  });

/** Usado pela navegação para decidir se mostra o acesso à área de administração. */
export const amISuperadmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("platform_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "platform_owner")
      .maybeSingle();
    return { superadmin: Boolean(data) };
  });
