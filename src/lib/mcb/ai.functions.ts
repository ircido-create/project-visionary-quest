/**
 * Fase 2 (item 2) — Análise de perfil por IA, auditável.
 *
 * Toda análise grava entrada, saída, versão do prompt e modelo em `ai_analyses`.
 * A chamada acontece só no servidor: a chave nunca chega ao navegador.
 *
 * Como as evidências, a saída da IA **não vale sozinha** — uma pessoa precisa aceitar
 * (`confirmEvidence` tem o mesmo desenho). Ver docs/mcb-fase-1.md para o princípio.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAi, type AiAnalysisStatus } from "@/lib/mcb/ai-types";
import {
  ANALYSIS_MODEL,
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  analysisSchema,
  buildAnalysisPrompt,
} from "@/lib/mcb/ai-prompt";
import type { Json } from "@/integrations/supabase/types";

/**
 * A chave é variável de ambiente gerenciada pelo Lovable em produção e vive em
 * `.env.local` no desenvolvimento — nunca no `.env`, que é versionado num repo público.
 */
function getAnthropicClient() {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Em produção, cadastre o secret no Lovable; " +
        "localmente, use .env.local (nunca .env, que é versionado).",
    );
  }
  return new Anthropic({ apiKey });
}

/** Roda a análise e grava o resultado. A linha é criada antes da chamada, para que
 *  uma falha do modelo fique registrada em vez de sumir. */
export const createProfileAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; influencerId: string }) =>
    z.object({ tenantId: z.string().uuid(), influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = withAi(context.supabase);

    const { data: influencer, error: lookupError } = await supabase
      .from("influencers")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!influencer) throw new Error("Candidata não encontrada neste ambiente.");

    // Só entra o que uma pessoa confirmou. Print não conferido não alimenta a IA —
    // é a mesma regra que vale para a qualificação.
    const { data: confirmedFiles } = await supabase
      .from("files")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .eq("influencer_id", data.influencerId)
      .eq("kind", "insight")
      .eq("confirmed", true);

    const fileIds = (confirmedFiles ?? []).map((file) => file.id);
    let confirmedEvidence: string[] = [];
    if (fileIds.length > 0) {
      const { data: confirmations } = await supabase
        .from("audit_logs")
        .select("meta")
        .eq("tenant_id", data.tenantId)
        .eq("entity", "files")
        .eq("action", "evidence.confirmed")
        .in("entity_id", fileIds);
      confirmedEvidence = (confirmations ?? [])
        .map((row) => (row.meta as { caption?: unknown } | null)?.caption)
        .filter((caption): caption is string => typeof caption === "string" && caption.length > 0);
    }

    const metrics = {
      seguidores: influencer.followers,
      publicacoes: influencer.posts_count,
      publico_feminino_pct:
        influencer.female_audience_pct === null ? null : Number(influencer.female_audience_pct),
      publicacoes_recentes_6m: influencer.recent_posts_6m,
      tipo_de_perfil: influencer.profile_type,
      origem_dos_dados: influencer.data_source,
    };

    const profile = {
      cidade: influencer.city,
      estado: influencer.state,
      frequencia_stories: influencer.stories_frequency,
      frequencia_reels: influencer.reels_frequency,
      temas: influencer.topics,
      objetivo: influencer.profile_goal,
      principal_dificuldade: influencer.main_difficulty,
    };

    const promptInput = { metrics, profile, confirmedEvidence };

    const { data: analysis, error: insertError } = await supabase
      .from("ai_analyses")
      .insert({
        tenant_id: data.tenantId,
        influencer_id: data.influencerId,
        prompt_version: PROMPT_VERSION,
        model: ANALYSIS_MODEL,
        input: promptInput as unknown as Json,
        status: "PENDENTE" as AiAnalysisStatus,
        created_by: userId,
      })
      .select("id")
      .maybeSingle();
    if (insertError) throw new Error(insertError.message);
    if (!analysis) throw new Error("Não foi possível registrar a análise.");

    const finish = async (fields: {
      status: AiAnalysisStatus;
      output?: Json | null;
      error?: string | null;
    }) => {
      await supabase
        .from("ai_analyses")
        .update({ ...fields, completed_at: new Date().toISOString() })
        .eq("tenant_id", data.tenantId)
        .eq("id", analysis.id);
    };

    try {
      const client = getAnthropicClient();
      const response = await client.messages.parse({
        model: ANALYSIS_MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        thinking: { type: "adaptive" },
        output_config: { effort: "high", format: zodOutputFormat(analysisSchema) },
        messages: [{ role: "user", content: buildAnalysisPrompt(promptInput) }],
      });

      if (response.stop_reason === "refusal") {
        await finish({
          status: "ERRO",
          error: `O modelo recusou a solicitação (${response.stop_details?.category ?? "sem categoria"}).`,
        });
        return { id: analysis.id, status: "ERRO" as const };
      }

      const parsed = response.parsed_output;
      if (!parsed) {
        await finish({
          status: "ERRO",
          error: "A resposta do modelo não seguiu o formato esperado.",
        });
        return { id: analysis.id, status: "ERRO" as const };
      }

      await finish({ status: "CONCLUIDA", output: parsed as unknown as Json, error: null });

      await supabase.from("audit_logs").insert({
        tenant_id: data.tenantId,
        actor_id: userId,
        action: "analysis.created",
        entity: "ai_analyses",
        entity_id: analysis.id,
        meta: {
          influencer_id: data.influencerId,
          prompt_version: PROMPT_VERSION,
          model: ANALYSIS_MODEL,
        },
      });

      return { id: analysis.id, status: "CONCLUIDA" as const };
    } catch (error) {
      // A falha fica gravada na linha: análise que some não é auditável.
      const message = error instanceof Error ? error.message : String(error);
      await finish({ status: "ERRO", error: message.slice(0, 500) });
      throw new Error(message);
    }
  });

/** Histórico de análises da candidata, da mais recente para a mais antiga. */
export const listAnalyses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; influencerId: string }) =>
    z.object({ tenantId: z.string().uuid(), influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = withAi(context.supabase);

    const { data: rows, error } = await supabase
      .from("ai_analyses")
      .select(
        "id, prompt_version, model, output, status, error, confirmed, created_at, completed_at",
      )
      .eq("tenant_id", data.tenantId)
      .eq("influencer_id", data.influencerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return { analyses: rows ?? [] };
  });

/** Aceite humano: alguém leu a análise e assume a leitura. */
export const confirmAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; analysisId: string }) =>
    z.object({ tenantId: z.string().uuid(), analysisId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const supabase = withAi(context.supabase);

    const { data: updated, error } = await supabase
      .from("ai_analyses")
      .update({ confirmed: true })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.analysisId)
      .eq("status", "CONCLUIDA")
      .select("id, influencer_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Análise não encontrada ou ainda não concluída.");

    await supabase.from("audit_logs").insert({
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "analysis.confirmed",
      entity: "ai_analyses",
      entity_id: updated.id,
      meta: { influencer_id: updated.influencer_id },
    });

    return { ok: true };
  });
