/**
 * Fase 5 — Fluxo de auditoria: gravação da decisão.
 *
 * QUEM DECIDE
 *
 * A dona e a administradora do ambiente. A membro vê, mas não decide. As políticas do
 * banco deixam qualquer membro gravar em `qualification_results` e mudar a etapa — o
 * mesmo vale hoje para `changeInfluencerStatus` —, então a regra de papel mora aqui,
 * conferida por `has_tenant_role` a cada decisão, e não só escondendo botão na tela.
 *
 * O QUE CADA DECISÃO GRAVA
 *
 * - `qualification_results`: a avaliação daquele momento (requisitos e progresso), mais
 *   `manual_decision`, `manual_decision_by` e `manual_decision_note`. É o registro que
 *   responde "quem aprovou, com base em quê" depois que os números mudarem.
 * - `influencers.status`: a próxima etapa. A atualização só acontece se a candidata
 *   ainda estiver em "Pronta para auditoria" — se duas pessoas decidirem ao mesmo tempo,
 *   só a primeira vale.
 * - `status_history`, com a decisão e a nota.
 * - Na devolução, uma tarefa com o motivo, prazo de 7 dias.
 * - `audit_logs`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { evaluateInfluencer } from "@/lib/mcb/app.functions";
import { audit } from "@/lib/mcb/audit";
import {
  ETAPA_EM_AUDITORIA,
  REGISTRO_LABELS,
  tituloTarefaDevolucao,
  validarDecisao,
  type RegistroDecisao,
} from "@/lib/mcb/auditoria";
import { STATUS_LABELS, type InfluencerStatus } from "@/lib/mcb/labels";

const PAPEIS_QUE_AUDITAM = ["manager_owner", "manager_admin"] as const;

async function podeDecidir(
  supabase: Parameters<typeof audit>[0],
  tenantId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_tenant_role", {
    _tenant: tenantId,
    _roles: [...PAPEIS_QUE_AUDITAM],
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/** A tela usa isto para mostrar ou esconder a decisão. A recusa real é no `decidir`. */
export const podeAuditar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => ({
    pode: await podeDecidir(context.supabase, data.tenantId),
  }));

export const decidirAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      influencerId: string;
      decisao: "APROVAR" | "DEVOLVER";
      nota: string;
      etapaDevolucao?: string | undefined;
    }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          influencerId: z.string().uuid(),
          decisao: z.enum(["APROVAR", "DEVOLVER"]),
          nota: z.string().max(1000),
          etapaDevolucao: z.string().max(40).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!(await podeDecidir(supabase, data.tenantId))) {
      throw new Error("Só a dona ou a administradora do ambiente decide a auditoria.");
    }

    const { data: influencer, error: erroLeitura } = await supabase
      .from("influencers")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .maybeSingle();
    if (erroLeitura) throw new Error(erroLeitura.message);
    if (!influencer) throw new Error("Candidata não encontrada neste ambiente.");

    const avaliacao = evaluateInfluencer(influencer);
    const resultado = validarDecisao({
      etapaAtual: influencer.status,
      decisao: data.decisao,
      nota: data.nota,
      etapaDevolucao: data.etapaDevolucao as InfluencerStatus | undefined,
      requisitos: avaliacao.requirements,
    });
    if (!resultado.ok) throw new Error(resultado.erro);

    // Primeiro a etapa, com a guarda: se outra pessoa já decidiu, nada é gravado.
    const { data: atualizadas, error: erroEtapa } = await supabase
      .from("influencers")
      .update({ status: resultado.proximaEtapa })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .eq("status", ETAPA_EM_AUDITORIA)
      .select("id");
    if (erroEtapa) throw new Error(erroEtapa.message);
    if (!atualizadas || atualizadas.length === 0) {
      throw new Error("A etapa da candidata mudou enquanto você auditava. Recarregue a página.");
    }

    const nota = data.nota.trim();
    const prazo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const gravacoes: Array<PromiseLike<unknown>> = [
      supabase.from("qualification_results").insert({
        tenant_id: data.tenantId,
        influencer_id: data.influencerId,
        rule_set_version: avaliacao.ruleSetVersion,
        status: avaliacao.status,
        requirements: avaliacao.requirements as unknown as Json,
        progress: avaliacao.progress as unknown as Json,
        manual_decision: resultado.registro,
        manual_decision_by: userId,
        manual_decision_note: nota || null,
      }),
      supabase.from("status_history").insert({
        tenant_id: data.tenantId,
        influencer_id: data.influencerId,
        from_status: ETAPA_EM_AUDITORIA,
        to_status: resultado.proximaEtapa,
        changed_by: userId,
        note: `Auditoria: ${REGISTRO_LABELS[resultado.registro]}${nota ? ` — ${nota}` : ""}`,
      }),
      audit(supabase, {
        tenant_id: data.tenantId,
        actor_id: userId,
        action: "influencer.auditoria_decidida",
        entity: "influencers",
        entity_id: data.influencerId,
        meta: {
          decisao: resultado.registro,
          para: resultado.proximaEtapa,
          pendentes: resultado.pendentes.map((p) => p.key),
        },
      }),
    ];
    if (resultado.registro === "DEVOLVIDA") {
      gravacoes.push(
        supabase.from("tasks").insert({
          tenant_id: data.tenantId,
          influencer_id: data.influencerId,
          title: tituloTarefaDevolucao(nota),
          status: "PENDENTE",
          priority: "ALTA",
          due_date: prazo,
        }),
      );
    }
    await Promise.all(gravacoes);

    return {
      registro: resultado.registro,
      proximaEtapa: resultado.proximaEtapa,
      proximaEtapaLabel: STATUS_LABELS[resultado.proximaEtapa],
    };
  });

export type DecisaoRegistrada = {
  id: string;
  quando: string;
  registro: RegistroDecisao;
  nota: string | null;
  quem: string | null;
};

export const listarDecisoesAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; influencerId: string }) =>
    z.object({ tenantId: z.string().uuid(), influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: linhas, error } = await supabase
      .from("qualification_results")
      .select("id, computed_at, manual_decision, manual_decision_note, manual_decision_by")
      .eq("tenant_id", data.tenantId)
      .eq("influencer_id", data.influencerId)
      .not("manual_decision", "is", null)
      .order("computed_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    const ids = [
      ...new Set((linhas ?? []).map((l) => l.manual_decision_by).filter(Boolean)),
    ] as string[];
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      for (const p of perfis ?? []) if (p.full_name) nomes.set(p.id, p.full_name);
    }

    return (linhas ?? []).map((l): DecisaoRegistrada => ({
      id: l.id,
      quando: l.computed_at,
      registro: l.manual_decision as RegistroDecisao,
      nota: l.manual_decision_note,
      quem: l.manual_decision_by ? (nomes.get(l.manual_decision_by) ?? null) : null,
    }));
  });
