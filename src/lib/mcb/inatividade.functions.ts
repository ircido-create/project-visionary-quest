/**
 * Fase 6 — Exclusão por inatividade: o aviso da gestora e a lista da administração.
 *
 * A exclusão em si é do banco (limpeza diária). Aqui só se lê: quem está perto de ser
 * excluído, para a gestora poder agir, e quem já passou do prazo mas tem arquivos, para a
 * dona da plataforma excluir pela ferramenta que também apaga os arquivos.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirSuperadmin } from "@/lib/mcb/admin.functions";
import { DIAS_DE_AVISO, dataDaExclusao, diasSemAtividade } from "@/lib/mcb/inatividade";

export type CandidataPertoDaExclusao = {
  id: string;
  nome: string;
  diasSemAtividade: number;
  excluiEm: string;
};

export const candidatasPertoDaExclusao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<CandidataPertoDaExclusao[]> => {
    const { data: linhas, error } = await context.supabase.rpc("candidatas_perto_da_exclusao", {
      p_tenant: data.tenantId,
      p_dias_aviso: DIAS_DE_AVISO,
    });
    if (error) throw new Error(error.message);
    const agora = new Date();
    return (linhas ?? []).map((l) => ({
      id: l.influencer_id,
      nome: l.nome,
      diasSemAtividade: diasSemAtividade(l.ultima_atividade, agora),
      excluiEm: dataDaExclusao(l.ultima_atividade),
    }));
  });

export type CandidataInativaComArquivos = {
  id: string;
  nome: string;
  email: string;
  ambiente: string;
  diasSemAtividade: number;
  arquivos: number;
};

export const candidatasInativasComArquivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CandidataInativaComArquivos[]> => {
    await exigirSuperadmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("candidatas_inativas_com_arquivos");
    if (error) throw new Error(error.message);
    const agora = new Date();
    return (data ?? []).map((l) => ({
      id: l.influencer_id,
      nome: l.nome,
      email: l.email,
      ambiente: l.ambiente,
      diasSemAtividade: diasSemAtividade(l.ultima_atividade, agora),
      arquivos: Number(l.arquivos),
    }));
  });
