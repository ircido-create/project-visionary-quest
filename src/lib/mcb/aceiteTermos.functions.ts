/**
 * Fase 6 — Aceite dos Termos de Uso e da Política de Privacidade (revisão jurídica, T1).
 *
 * O aceite do cadastro por e-mail é gravado pelo banco na criação da conta (migração
 * `20260913160000_fase6_aceite_dos_termos`). Aqui ficam a consulta que a área logada faz
 * e o aceite de quem entrou pelo Google, pelo Lovable ou tem conta anterior ao registro.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  VERSAO_ACEITE_EXIGIDO,
  VERSAO_POLITICA,
  VERSAO_TERMOS,
  aceiteEmDia,
} from "@/lib/mcb/documentosLegais";

export const situacaoDoAceite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ emDia: boolean }> => {
    const { data, error } = await context.supabase
      .from("aceites_de_termos")
      .select("versao_termos")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return {
      emDia: aceiteEmDia(
        (data ?? []).map((linha) => linha.versao_termos),
        VERSAO_ACEITE_EXIGIDO,
      ),
    };
  });

export const aceitarTermos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("aceitar_termos", {
      p_versao_termos: VERSAO_TERMOS,
      p_versao_politica: VERSAO_POLITICA,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
