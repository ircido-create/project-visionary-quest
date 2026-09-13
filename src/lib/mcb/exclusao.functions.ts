/**
 * Fase 6 — Exclusão de dados a pedido (LGPD), na área de administração.
 *
 * QUEM: só a dona da plataforma (`platform_owner`). A exclusão usa o cliente de serviço,
 * sem RLS, porque apaga em ambientes dos quais ela não é membro e mexe no Storage, no
 * Vault e na conta de acesso — por isso o papel é conferido antes de qualquer leitura.
 *
 * ORDEM, e o que acontece se algo falhar no meio:
 *
 * 1. Arquivos no Storage. Se falhar, nada foi apagado.
 * 2. Banco, pela função `excluir_candidata`: token do Vault, candidata com a cascata e o
 *    registro no log, numa transação. Se falhar, os arquivos já foram — repetir a
 *    exclusão retoma daqui, porque a pasta estará vazia.
 * 3. Conta de acesso, só se pedida e se ela não serve a mais nada. Se falhar, os dados já
 *    foram; o aviso volta para a tela.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirSuperadmin } from "@/lib/mcb/admin.functions";
import { audit } from "@/lib/mcb/audit";
import { EVIDENCE_BUCKET } from "@/lib/mcb/evidence";
import {
  caminhosDeEvidencia,
  confirmacaoConfere,
  escaparIlike,
  motivoParaManterConta,
  type ContagemExclusao,
  type SituacaoConta,
} from "@/lib/mcb/exclusao";

type Cliente = Parameters<typeof audit>[0];

async function situacaoDaConta(
  admin: Cliente,
  usuarioId: string | null,
  influencerId: string,
): Promise<SituacaoConta> {
  if (!usuarioId) {
    return {
      temConta: false,
      outrasCandidaturas: 0,
      membroDeAmbiente: false,
      papelNaPlataforma: false,
    };
  }
  const [outras, membro, papel] = await Promise.all([
    admin
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", usuarioId)
      .neq("id", influencerId),
    admin
      .from("tenant_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", usuarioId),
    admin
      .from("platform_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", usuarioId),
  ]);
  for (const r of [outras, membro, papel]) if (r.error) throw new Error(r.error.message);
  return {
    temConta: true,
    outrasCandidaturas: outras.count ?? 0,
    membroDeAmbiente: (membro.count ?? 0) > 0,
    papelNaPlataforma: (papel.count ?? 0) > 0,
  };
}

export type CandidataParaExclusao = {
  id: string;
  nome: string;
  email: string;
  ambiente: string;
  criadaEm: string;
  temConta: boolean;
  /** Por que a conta de acesso não sai junto; `null` quando pode sair. */
  motivoParaManterConta: string | null;
  tarefas: number;
  arquivos: number;
};

/** Acha as candidaturas com aquele e-mail, em todos os ambientes. */
export const buscarParaExclusao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) =>
    z.object({ email: z.string().trim().toLowerCase().email().max(160) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<CandidataParaExclusao[]> => {
    await exigirSuperadmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: linhas, error } = await supabaseAdmin
      .from("influencers")
      .select("id, full_name, email, user_id, created_at, tenant_id")
      .ilike("email", escaparIlike(data.email))
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!linhas || linhas.length === 0) return [];

    const { data: ambientes, error: erroAmbientes } = await supabaseAdmin
      .from("tenants")
      .select("id, name")
      .in("id", [...new Set(linhas.map((l) => l.tenant_id))]);
    if (erroAmbientes) throw new Error(erroAmbientes.message);
    const nomeDoAmbiente = new Map((ambientes ?? []).map((a) => [a.id, a.name]));

    return Promise.all(
      linhas.map(async (l): Promise<CandidataParaExclusao> => {
        const [conta, tarefas, arquivos] = await Promise.all([
          situacaoDaConta(supabaseAdmin, l.user_id, l.id),
          supabaseAdmin
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("influencer_id", l.id),
          supabaseAdmin
            .from("files")
            .select("id", { count: "exact", head: true })
            .eq("influencer_id", l.id),
        ]);
        return {
          id: l.id,
          nome: l.full_name,
          email: l.email,
          ambiente: nomeDoAmbiente.get(l.tenant_id) ?? "—",
          criadaEm: l.created_at,
          temConta: conta.temConta,
          motivoParaManterConta: motivoParaManterConta(conta),
          tarefas: tarefas.count ?? 0,
          arquivos: arquivos.count ?? 0,
        };
      }),
    );
  });

export type ResultadoExclusao = {
  contagem: ContagemExclusao;
  arquivosNoArmazenamento: number;
  conta: "excluida" | "mantida" | "sem_conta";
  aviso: string | null;
};

export const excluirCandidata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { influencerId: string; confirmacao: string; excluirConta: boolean }) =>
    z
      .object({
        influencerId: z.string().uuid(),
        confirmacao: z.string().max(200),
        excluirConta: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ResultadoExclusao> => {
    const { userId } = context;
    await exigirSuperadmin(context.supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: candidata, error } = await supabaseAdmin
      .from("influencers")
      .select("id, tenant_id, email, user_id")
      .eq("id", data.influencerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!candidata) throw new Error("Candidata não encontrada — talvez já tenha sido excluída.");
    if (!confirmacaoConfere(data.confirmacao, candidata.email)) {
      throw new Error("A confirmação não confere com o e-mail da candidata. Nada foi apagado.");
    }

    // A conta é avaliada antes: depois da exclusão, esta candidatura some da contagem.
    const contaId = candidata.user_id;
    const situacao = await situacaoDaConta(supabaseAdmin, contaId, candidata.id);

    // 1. Arquivos: o que está na pasta e o que está registrado, para não sobrar nada.
    const [listagem, registros] = await Promise.all([
      supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .list(`${candidata.tenant_id}/${candidata.id}`, { limit: 1000 }),
      supabaseAdmin.from("files").select("storage_path").eq("influencer_id", candidata.id),
    ]);
    if (listagem.error) {
      throw new Error(
        `Não foi possível listar os arquivos (${listagem.error.message}). Nada foi apagado.`,
      );
    }
    if (registros.error) throw new Error(registros.error.message);
    const caminhos = [
      ...new Set([
        ...caminhosDeEvidencia(
          candidata.tenant_id,
          candidata.id,
          (listagem.data ?? []).map((o) => o.name),
        ),
        ...(registros.data ?? []).map((r) => r.storage_path),
      ]),
    ];
    if (caminhos.length > 0) {
      const { error: erroArquivos } = await supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .remove(caminhos);
      if (erroArquivos) {
        throw new Error(
          `Não foi possível apagar os arquivos (${erroArquivos.message}). Nada foi apagado do banco; tente de novo.`,
        );
      }
    }

    // 2. Banco: token do Vault, candidata com a cascata e o registro no log.
    const { data: contagem, error: erroBanco } = await supabaseAdmin.rpc("excluir_candidata", {
      p_influencer_id: candidata.id,
      p_actor: userId,
    });
    if (erroBanco) {
      throw new Error(
        `Os arquivos foram apagados, mas o banco recusou a exclusão (${erroBanco.message}). Tente de novo: a exclusão retoma de onde parou.`,
      );
    }

    // 3. Conta de acesso, se pedida e se ela não serve a mais nada.
    let conta: ResultadoExclusao["conta"] = situacao.temConta ? "mantida" : "sem_conta";
    let aviso: string | null = null;
    if (data.excluirConta && contaId) {
      const motivo = motivoParaManterConta(situacao);
      if (motivo) {
        aviso = `A conta de acesso foi mantida: ${motivo}`;
      } else {
        const { error: erroConta } = await supabaseAdmin.auth.admin.deleteUser(contaId);
        if (erroConta) {
          aviso = `Os dados foram apagados, mas a conta de acesso não (${erroConta.message}).`;
        } else {
          conta = "excluida";
          // `profiles` não tem chave estrangeira para a conta: não some sozinho.
          const { error: erroPerfil } = await supabaseAdmin
            .from("profiles")
            .delete()
            .eq("id", contaId);
          if (erroPerfil) aviso = `A conta foi apagada, mas o perfil não (${erroPerfil.message}).`;
          await audit(supabaseAdmin, {
            tenant_id: candidata.tenant_id,
            actor_id: userId,
            action: "candidata.conta_excluida",
            entity: "influencers",
            entity_id: candidata.id,
          });
        }
      }
    }

    return {
      contagem: contagem as unknown as ContagemExclusao,
      arquivosNoArmazenamento: caminhos.length,
      conta,
      aviso,
    };
  });
