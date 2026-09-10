/**
 * Fase 3 — Exportações.
 *
 * O servidor devolve o cabeçalho e as linhas já ordenados; o navegador só transforma
 * em CSV e baixa. Assim a definição das colunas mora num lugar só, e mudar uma coluna
 * não exige mexer em dois arquivos.
 *
 * Toda exportação é registrada em `audit_logs`. O CSV de candidatas leva nome, e-mail e
 * WhatsApp para fora do sistema — dado pessoal de terceiro. Saber quem levou, quando e
 * quantos registros é parte da postura de LGPD que o projeto assume desde a fase 1.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "@/lib/mcb/audit";
import { evaluateInfluencer } from "@/lib/mcb/app.functions";
import { QUALIFICATION_LABELS } from "@/lib/mcb/qualification";
import { STATUS_LABELS, type InfluencerStatus } from "@/lib/mcb/labels";
import { dataBr, numeroBr } from "@/lib/mcb/csv";

const entrada = (input: { tenantId: string }) =>
  z.object({ tenantId: z.string().uuid() }).parse(input);

const PERFIL: Record<string, string> = {
  PESSOAL: "Pessoal",
  CRIADOR: "Criadora de conteúdo",
  COMERCIAL: "Comercial",
  NAO_SEI: "Não sei",
};

const TRI: Record<string, string> = { SIM: "Sim", NAO: "Não", NAO_SEI: "Não sei" };

const PRIORIDADE: Record<string, string> = { ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };

const TAREFA: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

/** Nome de arquivo com a data, para não sobrescrever a exportação da semana passada. */
function nomeDoArquivo(prefixo: string, slug: string) {
  const hoje = new Date().toISOString().slice(0, 10);
  return `${prefixo}-${slug}-${hoje}.csv`;
}

export const exportarCandidatas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(entrada)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: tenant }, { data: linhas, error }] = await Promise.all([
      supabase.from("tenants").select("slug").eq("id", data.tenantId).maybeSingle(),
      supabase
        .from("influencers")
        .select("*")
        .eq("tenant_id", data.tenantId)
        .order("created_at", { ascending: false }),
    ]);
    if (error) throw new Error(error.message);

    const cabecalho = [
      "Nome",
      "E-mail",
      "WhatsApp",
      "Cidade",
      "UF",
      "Instagram",
      "Seguidores",
      "Publicações",
      "Público feminino (%)",
      "Publicações recentes (6 meses)",
      "Tipo de perfil",
      "Status",
      "Qualificação",
      "Nível",
      "Progresso (%)",
      "Requisitos pendentes",
      "Origem",
      "Consentimento em",
      "Candidatura em",
    ];

    const registros = (linhas ?? []).map((i) => {
      const avaliacao = evaluateInfluencer(i);
      return [
        i.full_name,
        i.email,
        i.whatsapp,
        i.city,
        i.state,
        i.instagram_handle ? `@${i.instagram_handle}` : "",
        i.followers,
        i.posts_count,
        numeroBr(i.female_audience_pct === null ? null : Number(i.female_audience_pct), 1),
        TRI[i.recent_posts_6m ?? ""] ?? "",
        PERFIL[i.profile_type ?? ""] ?? "",
        STATUS_LABELS[i.status as InfluencerStatus] ?? i.status,
        QUALIFICATION_LABELS[avaliacao.status],
        avaliacao.progress.level,
        numeroBr(avaliacao.progress.score),
        avaliacao.requirements.filter((r) => r.status !== "PASS").length,
        i.origin,
        dataBr(i.consent_at),
        dataBr(i.created_at),
      ];
    });

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "candidates.exported",
      entity: "influencers",
      meta: { registros: registros.length },
    });

    return {
      nomeDoArquivo: nomeDoArquivo("candidatas", tenant?.slug ?? "ambiente"),
      cabecalho,
      linhas: registros,
    };
  });

export const exportarTarefas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(entrada)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: tenant }, { data: tarefas, error }, { data: candidatas }] = await Promise.all([
      supabase.from("tenants").select("slug").eq("id", data.tenantId).maybeSingle(),
      supabase
        .from("tasks")
        .select("*")
        .eq("tenant_id", data.tenantId)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("influencers").select("id, full_name").eq("tenant_id", data.tenantId),
    ]);
    if (error) throw new Error(error.message);

    const nomePorId = new Map((candidatas ?? []).map((c) => [c.id, c.full_name]));

    const registros = (tarefas ?? []).map((t) => [
      t.influencer_id ? (nomePorId.get(t.influencer_id) ?? "") : "",
      t.title,
      TAREFA[t.status] ?? t.status,
      PRIORIDADE[t.priority] ?? t.priority,
      dataBr(t.due_date),
      dataBr(t.created_at),
    ]);

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "tasks.exported",
      entity: "tasks",
      meta: { registros: registros.length },
    });

    return {
      nomeDoArquivo: nomeDoArquivo("tarefas", tenant?.slug ?? "ambiente"),
      cabecalho: ["Candidata", "Tarefa", "Status", "Prioridade", "Prazo", "Criada em"],
      linhas: registros,
    };
  });
