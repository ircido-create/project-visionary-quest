/**
 * Fase 7 — Assinatura sem cobrança online: o que a gestora vê e faz, e o registro de
 * pagamento pela administração.
 *
 * As regras de verdade estão no banco (migração `20260914100000_fase7_assinatura_e_
 * convites`): só a dona cancela, só a administração registra pagamento, e as colunas da
 * assinatura não mudam pela API. Aqui ficam a leitura e as chamadas.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirSuperadmin } from "@/lib/mcb/admin.functions";
import type { DadosDaAssinatura } from "@/lib/mcb/assinatura";

export type ResumoDaAssinatura = {
  dados: DadosDaAssinatura;
  plano: { nome: string; precoCentavos: number } | null;
  souDona: boolean;
  pagamentos: Array<{
    id: string;
    valorCentavos: number;
    periodoInicio: string;
    periodoFim: string;
    forma: string;
    registradoEm: string;
  }>;
};

export const resumoDaAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ResumoDaAssinatura> => {
    const { supabase, userId } = context;
    const [ambiente, pagamentos, papel] = await Promise.all([
      supabase
        .from("tenants")
        .select("cobranca, vence_em, status, suspensao_motivo, is_demo, plan_id")
        .eq("id", data.tenantId)
        .maybeSingle(),
      supabase
        .from("pagamentos")
        .select("id, valor_centavos, periodo_inicio, periodo_fim, forma, registrado_em")
        .eq("tenant_id", data.tenantId)
        .order("registrado_em", { ascending: false }),
      supabase
        .from("tenant_memberships")
        .select("role")
        .eq("tenant_id", data.tenantId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (ambiente.error) throw new Error(ambiente.error.message);
    if (pagamentos.error) throw new Error(pagamentos.error.message);
    if (!ambiente.data) throw new Error("Ambiente não encontrado.");

    let plano: ResumoDaAssinatura["plano"] = null;
    if (ambiente.data.plan_id) {
      const { data: linha } = await supabase
        .from("plans")
        .select("name, price_cents")
        .eq("id", ambiente.data.plan_id)
        .maybeSingle();
      if (linha) plano = { nome: linha.name, precoCentavos: linha.price_cents };
    }

    return {
      dados: {
        cobranca: ambiente.data.cobranca,
        venceEm: ambiente.data.vence_em,
        status: ambiente.data.status,
        suspensaoMotivo: ambiente.data.suspensao_motivo,
        isDemo: ambiente.data.is_demo,
      },
      plano,
      souDona: papel.data?.role === "manager_owner",
      pagamentos: (pagamentos.data ?? []).map((p) => ({
        id: p.id,
        valorCentavos: p.valor_centavos,
        periodoInicio: p.periodo_inicio,
        periodoFim: p.periodo_fim,
        forma: p.forma,
        registradoEm: p.registrado_em,
      })),
    };
  });

export const cancelarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: resultado, error } = await context.supabase.rpc("cancelar_assinatura", {
      p_tenant: data.tenantId,
    });
    if (error) throw new Error(error.message);
    const r = (resultado ?? {}) as { arrependimento?: boolean; vale_ate?: string };
    return {
      arrependimento: Boolean(r.arrependimento),
      valeAte: r.vale_ate ?? new Date().toISOString(),
    };
  });

export const registrarPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      valorCentavos: number;
      meses: number;
      forma: string;
      observacao: string;
    }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          valorCentavos: z.number().int().min(0).max(10_000_000),
          meses: z.number().int().min(1).max(12),
          forma: z.string().trim().max(40),
          observacao: z.string().trim().max(300),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirSuperadmin(context.supabase, context.userId);
    const { data: venceEm, error } = await context.supabase.rpc("registrar_pagamento", {
      p_tenant: data.tenantId,
      p_valor_centavos: data.valorCentavos,
      p_meses: data.meses,
      p_forma: data.forma,
      p_observacao: data.observacao,
    });
    if (error) throw new Error(error.message);
    return { venceEm: String(venceEm) };
  });
