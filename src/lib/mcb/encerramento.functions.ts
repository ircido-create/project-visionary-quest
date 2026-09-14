/**
 * Fase 10 — Encerrar o ambiente: baixar todos os dados e excluir de vez.
 *
 * BAIXAR: dona e administradora. A leitura usa o cliente da própria pessoa, com as
 * regras de sempre — só sai o que ela já enxerga. Fica registrado no log.
 *
 * EXCLUIR: só a dona, com o nome do ambiente digitado de novo. Ordem, e o que acontece se
 * algo falhar no meio (a mesma da exclusão de candidata, Fase 6):
 * 1. arquivos no Storage — se falhar, nada foi apagado;
 * 2. banco, pela função `excluir_ambiente` (só a chave de serviço executa): confere de
 *    novo o papel, apaga os tokens do Vault e o ambiente em cascata, e registra no log da
 *    plataforma — se falhar, repetir retoma daqui, porque a pasta estará vazia.
 * As contas de acesso das pessoas continuam existindo.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "@/lib/mcb/audit";
import { EVIDENCE_BUCKET } from "@/lib/mcb/evidence";
import { caminhosDeEvidencia } from "@/lib/mcb/exclusao";
import { confirmacaoDoAmbienteConfere, nomeDoArquivoDeExportacao } from "@/lib/mcb/encerramento";

type Cliente = Parameters<typeof audit>[0];

async function papelNoAmbiente(supabase: Cliente, tenantId: string, userId: string) {
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.role ?? null;
}

export const exportarTudo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const papel = await papelNoAmbiente(supabase, data.tenantId, userId);
    if (papel !== "manager_owner" && papel !== "manager_admin") {
      throw new Error("Só a dona e a administradora do ambiente baixam todos os dados.");
    }

    const id = data.tenantId;
    const [
      ambiente,
      pagina,
      candidatas,
      inscricoes,
      tarefas,
      notas,
      feedbacks,
      numeros,
      avaliacoes,
      historico,
      consentimentos,
      arquivos,
      pagamentos,
      modelos,
    ] = await Promise.all([
      supabase
        .from("tenants")
        .select("name, slug, created_at, cobranca, vence_em, plan_id")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("tenant_branding").select("*").eq("tenant_id", id).maybeSingle(),
      supabase.from("influencers").select("*").eq("tenant_id", id),
      supabase.from("applications").select("*").eq("tenant_id", id),
      supabase.from("tasks").select("*").eq("tenant_id", id),
      supabase.from("notes").select("*").eq("tenant_id", id),
      supabase.from("feedbacks").select("*").eq("tenant_id", id),
      supabase.from("metric_snapshots").select("*").eq("tenant_id", id),
      supabase.from("qualification_results").select("*").eq("tenant_id", id),
      supabase.from("status_history").select("*").eq("tenant_id", id),
      supabase.from("consent_logs").select("*").eq("tenant_id", id),
      supabase
        .from("files")
        .select("id, influencer_id, kind, mime_type, size_bytes, confirmed, created_at")
        .eq("tenant_id", id),
      supabase.from("pagamentos").select("*").eq("tenant_id", id),
      supabase.from("task_templates").select("*").eq("tenant_id", id),
    ]);
    for (const r of [
      ambiente,
      pagina,
      candidatas,
      inscricoes,
      tarefas,
      notas,
      feedbacks,
      numeros,
      avaliacoes,
      historico,
      consentimentos,
      arquivos,
      pagamentos,
      modelos,
    ]) {
      if (r.error) throw new Error(r.error.message);
    }
    if (!ambiente.data) throw new Error("Ambiente não encontrado.");

    const dados = {
      candidatas: candidatas.data ?? [],
      inscricoes: inscricoes.data ?? [],
      tarefas: tarefas.data ?? [],
      notas: notas.data ?? [],
      feedbacks: feedbacks.data ?? [],
      registros_de_numeros: numeros.data ?? [],
      avaliacoes: avaliacoes.data ?? [],
      historico_de_etapas: historico.data ?? [],
      consentimentos: consentimentos.data ?? [],
      arquivos: arquivos.data ?? [],
      pagamentos: pagamentos.data ?? [],
      modelos_de_tarefa: modelos.data ?? [],
    };

    await audit(supabase, {
      tenant_id: id,
      actor_id: userId,
      action: "ambiente.exportado",
      entity: "tenants",
      entity_id: id,
      meta: Object.fromEntries(
        Object.entries(dados).map(([chave, linhas]) => [chave, linhas.length]),
      ),
    });

    return {
      nomeDoArquivo: nomeDoArquivoDeExportacao(ambiente.data.slug),
      conteudo: JSON.stringify(
        {
          geradoEm: new Date().toISOString(),
          aviso:
            "Dados pessoais de candidatas. Guarde com cuidado e apague quando não precisar mais (LGPD). Os prints ficam na página de cada candidata; aqui vai só a lista deles.",
          ambiente: ambiente.data,
          pagina: pagina.data,
          ...dados,
        },
        null,
        2,
      ),
    };
  });

export const excluirAmbiente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; confirmacao: string }) =>
    z.object({ tenantId: z.string().uuid(), confirmacao: z.string().max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const papel = await papelNoAmbiente(context.supabase, data.tenantId, userId);
    if (papel !== "manager_owner") throw new Error("Só a dona do ambiente pode excluí-lo.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ambiente, error } = await supabaseAdmin
      .from("tenants")
      .select("id, name, is_demo")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ambiente) throw new Error("Ambiente não encontrado — talvez já tenha sido excluído.");
    if (ambiente.is_demo) throw new Error("Ambiente de demonstração não é excluído por aqui.");
    if (!confirmacaoDoAmbienteConfere(data.confirmacao, ambiente.name)) {
      throw new Error("O nome digitado não confere com o do ambiente. Nada foi apagado.");
    }

    // 1. Arquivos: o que está registrado e o que está em cada pasta de candidata.
    const [pastas, registros] = await Promise.all([
      supabaseAdmin.storage.from(EVIDENCE_BUCKET).list(ambiente.id, { limit: 1000 }),
      supabaseAdmin.from("files").select("storage_path").eq("tenant_id", ambiente.id),
    ]);
    if (pastas.error) {
      throw new Error(
        `Não foi possível listar os arquivos (${pastas.error.message}). Nada foi apagado.`,
      );
    }
    if (registros.error) throw new Error(registros.error.message);
    const caminhos = new Set((registros.data ?? []).map((r) => r.storage_path));
    for (const pasta of pastas.data ?? []) {
      if (!pasta.name) continue;
      const dentro = await supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .list(`${ambiente.id}/${pasta.name}`, { limit: 1000 });
      if (dentro.error) {
        throw new Error(
          `Não foi possível listar os arquivos (${dentro.error.message}). Nada foi apagado.`,
        );
      }
      for (const caminho of caminhosDeEvidencia(
        ambiente.id,
        pasta.name,
        (dentro.data ?? []).map((o) => o.name),
      )) {
        caminhos.add(caminho);
      }
    }
    const lista = [...caminhos];
    for (let i = 0; i < lista.length; i += 100) {
      const { error: erroArquivos } = await supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .remove(lista.slice(i, i + 100));
      if (erroArquivos) {
        throw new Error(
          `Não foi possível apagar os arquivos (${erroArquivos.message}). O ambiente continua; tente de novo.`,
        );
      }
    }

    // 2. Banco: confere de novo, apaga tokens e ambiente, registra no log da plataforma.
    const { data: contagem, error: erroBanco } = await supabaseAdmin.rpc("excluir_ambiente", {
      p_tenant: ambiente.id,
      p_actor: userId,
    });
    if (erroBanco) {
      throw new Error(
        `Os arquivos foram apagados, mas o banco recusou a exclusão (${erroBanco.message}). Tente de novo: a exclusão retoma de onde parou.`,
      );
    }
    return { contagem: (contagem ?? {}) as Record<string, number>, arquivos: lista.length };
  });
