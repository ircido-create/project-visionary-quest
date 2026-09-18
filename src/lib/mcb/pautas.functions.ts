import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { ANALYSIS_MODEL } from "@/lib/mcb/ai-prompt";
import { gerarAnalise } from "@/lib/mcb/ai-gateway";
import { audit } from "@/lib/mcb/audit";
import {
  SCHEMA_DA_PAUTA,
  VERSAO_DO_PROMPT,
  instrucaoDoSistema,
  instrucaoDoUsuario,
  pautaVazia,
  type Escopo,
  type Pauta,
  type Programa,
} from "@/lib/mcb/pautas";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Cliente = {
  from: (t: string) => any;
  rpc: (n: string, a?: Record<string, unknown>) => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const entrada = z.object({
  tenantId: z.string().uuid(),
  influencerId: z.string().uuid().nullable(),
  dias: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)]).default(30),
});

const pautaSchema = z.object({
  resumo_executivo: z.string(),
  conquistas: z.array(z.string()),
  pontos_de_atencao: z.array(z.string()),
  perguntas: z.array(z.string()),
  decisoes_necessarias: z.array(z.string()),
  proximos_passos: z.array(z.string()),
});

async function programaDoAmbiente(supabase: Cliente, tenantId: string): Promise<Programa> {
  const { data } = await supabase.from("tenants").select("module").eq("id", tenantId).maybeSingle();
  if (!data) throw new Error("Ambiente não encontrado.");
  return (data as { module: string }).module === "ONBIO" ? "ONBIO" : "YBERA";
}

const reais = (centavos: number | null) => (centavos === null ? null : centavos / 100);

/** Dados de uma afiliada. Só o que ajuda a conversar: nada de nota interna nem token. */
async function insumosIndividuais(
  supabase: Cliente,
  tenantId: string,
  influencerId: string,
  programa: Programa,
  desde: string,
) {
  const [afiliada, evolucao, tarefas, feedbacks, resultados] = await Promise.all([
    supabase
      .from("influencers")
      .select(
        "full_name, instagram_handle, status, level, progress_score, followers, posts_count, female_audience_pct, data_source, created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("id", influencerId)
      .maybeSingle(),
    supabase
      .from("metric_snapshots")
      .select("captured_at, followers, posts_count, source")
      .eq("influencer_id", influencerId)
      .gte("captured_at", desde)
      .order("captured_at"),
    supabase
      .from("tasks")
      .select("title, status, due_date, completed_at, priority")
      .eq("influencer_id", influencerId)
      .order("due_date", { nullsFirst: false }),
    supabase
      .from("feedbacks")
      .select("body, created_at")
      .eq("influencer_id", influencerId)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(5),
    programa === "ONBIO"
      ? supabase
          .from("commercial_results")
          .select(
            "period_start, period_end, revenue_cents, orders, commission_cents, goal_cents, campaign, notes",
          )
          .eq("tenant_id", tenantId)
          .eq("influencer_id", influencerId)
          .order("period_end", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: null }),
  ]);

  if (!afiliada.data) throw new Error("Afiliada não encontrada neste ambiente.");
  const pontos = (evolucao.data ?? []) as Array<{ captured_at: string; followers: number | null }>;
  const comNumero = pontos.filter((p) => p.followers !== null);
  const primeiro = comNumero[0]?.followers ?? null;
  const ultimo = comNumero[comNumero.length - 1]?.followers ?? null;

  return {
    afiliada: afiliada.data,
    seguidores: {
      no_inicio_do_periodo: primeiro,
      agora: ultimo,
      variacao: primeiro !== null && ultimo !== null ? ultimo - primeiro : null,
      leituras_no_periodo: comNumero.length,
    },
    tarefas: (tarefas.data ?? []).map(
      (t: { title: string; status: string; due_date: string | null }) => ({
        titulo: t.title,
        status: t.status,
        prazo: t.due_date,
      }),
    ),
    feedbacks: (feedbacks.data ?? []).map((f: { body: string; created_at: string }) => ({
      texto: f.body,
      data: f.created_at,
    })),
    ...(programa === "ONBIO"
      ? {
          resultados_comerciais: (resultados.data ?? []).map(
            (r: {
              period_start: string;
              period_end: string;
              revenue_cents: number;
              orders: number;
              commission_cents: number;
              goal_cents: number | null;
              campaign: string | null;
              notes: string | null;
            }) => ({
              periodo: { de: r.period_start, ate: r.period_end },
              faturamento_reais: reais(r.revenue_cents),
              pedidos: r.orders,
              comissao_reais: reais(r.commission_cents),
              meta_reais: reais(r.goal_cents),
              campanha: r.campaign,
              observacoes: r.notes,
            }),
          ),
        }
      : {}),
  };
}

/** Retrato do ambiente para a reunião de equipe. */
async function insumosDaEquipe(
  supabase: Cliente,
  tenantId: string,
  programa: Programa,
  desde: string,
) {
  const [afiliadas, registros, tarefas, resultados] = await Promise.all([
    supabase
      .from("influencers")
      .select("id, full_name, status, level, progress_score, followers, created_at, data_source")
      .eq("tenant_id", tenantId)
      .is("archived_at", null),
    supabase
      .from("metric_snapshots")
      .select("influencer_id, captured_at, followers")
      .eq("tenant_id", tenantId)
      .gte("captured_at", desde)
      .order("captured_at"),
    supabase
      .from("tasks")
      .select("influencer_id, title, status, due_date")
      .eq("tenant_id", tenantId)
      .neq("status", "CANCELADA"),
    programa === "ONBIO"
      ? supabase
          .from("commercial_results")
          .select("influencer_id, period_end, revenue_cents, orders, commission_cents, campaign")
          .eq("tenant_id", tenantId)
          .gte("period_end", desde.slice(0, 10))
      : Promise.resolve({ data: null }),
  ]);

  const lista = (afiliadas.data ?? []) as Array<{
    id: string;
    full_name: string;
    status: string;
    level: string | null;
    progress_score: number | null;
    followers: number | null;
    created_at: string;
    data_source: string;
  }>;
  const porAfiliada = new Map<string, number[]>();
  for (const r of (registros.data ?? []) as Array<{
    influencer_id: string;
    followers: number | null;
  }>) {
    if (r.followers === null) continue;
    const atual = porAfiliada.get(r.influencer_id) ?? [];
    atual.push(r.followers);
    porAfiliada.set(r.influencer_id, atual);
  }

  const crescimento = lista
    .map((a) => {
      const pontos = porAfiliada.get(a.id) ?? [];
      const variacao = pontos.length > 1 ? pontos[pontos.length - 1]! - pontos[0]! : null;
      return { nome: a.full_name, seguidores: a.followers, variacao };
    })
    .sort((a, b) => (b.variacao ?? -Infinity) - (a.variacao ?? -Infinity));

  const hoje = new Date().toISOString().slice(0, 10);
  const listaTarefas = (tarefas.data ?? []) as Array<{
    status: string;
    due_date: string | null;
    title: string;
  }>;

  const comuns = {
    total_de_afiliadas: lista.length,
    novas_no_periodo: lista.filter((a) => a.created_at >= desde).length,
    seguidores_somados: lista.reduce((s, a) => s + (a.followers ?? 0), 0),
    sem_numero_de_seguidores: lista.filter((a) => a.followers === null).length,
    maiores_crescimentos: crescimento.filter((c) => c.variacao !== null).slice(0, 5),
    sem_leitura_no_periodo: crescimento.filter((c) => c.variacao === null).length,
    tarefas: {
      abertas: listaTarefas.filter((t) => t.status !== "CONCLUIDA").length,
      atrasadas: listaTarefas.filter(
        (t) => t.status !== "CONCLUIDA" && t.due_date !== null && t.due_date < hoje,
      ).length,
      concluidas_no_periodo: listaTarefas.filter((t) => t.status === "CONCLUIDA").length,
    },
  };

  if (programa === "YBERA") {
    const porEtapa = lista.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {});
    return { ...comuns, afiliadas_por_etapa: porEtapa };
  }

  const linhas = (resultados.data ?? []) as Array<{
    revenue_cents: number;
    orders: number;
    commission_cents: number;
    campaign: string | null;
  }>;
  return {
    ...comuns,
    resultados_no_periodo: {
      faturamento_reais: reais(linhas.reduce((s, r) => s + r.revenue_cents, 0)),
      pedidos: linhas.reduce((s, r) => s + r.orders, 0),
      comissao_reais: reais(linhas.reduce((s, r) => s + r.commission_cents, 0)),
      lancamentos: linhas.length,
      campanhas: [...new Set(linhas.map((r) => r.campaign).filter(Boolean))].slice(0, 10),
    },
  };
}

/**
 * Gera a pauta e guarda entrada, saída, modelo, versão do prompt e autoria. A linha é
 * gravada antes da chamada: se a IA falhar, fica o registro do erro em vez de silêncio.
 */
export const gerarPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entrada.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    const programa = await programaDoAmbiente(supabase, data.tenantId);
    const escopo: Escopo = data.influencerId ? "INDIVIDUAL" : "EQUIPE";
    const desde = new Date(Date.now() - data.dias * 86_400_000).toISOString();

    const insumos = data.influencerId
      ? await insumosIndividuais(supabase, data.tenantId, data.influencerId, programa, desde)
      : await insumosDaEquipe(supabase, data.tenantId, programa, desde);

    const pautaId = crypto.randomUUID();
    const { error: erroInsert } = await supabase.from("meeting_agendas").insert({
      id: pautaId,
      tenant_id: data.tenantId,
      influencer_id: data.influencerId,
      escopo,
      period_start: desde.slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      prompt_version: `${VERSAO_DO_PROMPT}-${programa.toLowerCase()}-${escopo.toLowerCase()}`,
      model: ANALYSIS_MODEL,
      input: insumos as unknown as Json,
      created_by: context.userId,
    });
    if (erroInsert) throw new Error(erroInsert.message);

    try {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) {
        throw new Error("A inteligência artificial não está configurada neste projeto.");
      }
      const texto = await gerarAnalise({
        apiKey,
        modelo: ANALYSIS_MODEL,
        sistema: instrucaoDoSistema(programa, escopo),
        usuario: instrucaoDoUsuario(data.dias, insumos),
        schema: SCHEMA_DA_PAUTA as unknown as Record<string, unknown>,
      });
      if (!texto) throw new Error("A inteligência artificial não devolveu uma pauta.");
      const pauta = pautaSchema.parse(JSON.parse(texto)) as Pauta;
      if (pautaVazia(pauta)) {
        throw new Error("A pauta veio vazia. Registre dados do período e tente de novo.");
      }

      await supabase
        .from("meeting_agendas")
        .update({
          status: "CONCLUIDA",
          output: pauta as unknown as Json,
          completed_at: new Date().toISOString(),
        })
        .eq("id", pautaId);
      await audit(context.supabase, {
        tenant_id: data.tenantId,
        actor_id: context.userId,
        action: escopo === "EQUIPE" ? "pauta.equipe_gerada" : "pauta.individual_gerada",
        entity: "meeting_agendas",
        entity_id: pautaId,
        meta: { programa, dias: data.dias },
      });
      return { id: pautaId, escopo, pauta };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      await supabase
        .from("meeting_agendas")
        .update({
          status: "ERRO",
          error: mensagem.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", pautaId);
      throw new Error(mensagem);
    }
  });

export const listarPautas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ tenantId: z.string().uuid(), influencerId: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    let consulta = supabase
      .from("meeting_agendas")
      .select("id, escopo, status, output, error, created_at, period_start, period_end")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false })
      .limit(10);
    consulta = data.influencerId
      ? consulta.eq("influencer_id", data.influencerId)
      : consulta.eq("escopo", "EQUIPE");
    const { data: linhas, error } = await consulta;
    if (error) throw new Error(error.message);
    return (linhas ?? []) as Array<{
      id: string;
      escopo: Escopo;
      status: string;
      output: Pauta | null;
      error: string | null;
      created_at: string;
      period_start: string | null;
      period_end: string | null;
    }>;
  });
