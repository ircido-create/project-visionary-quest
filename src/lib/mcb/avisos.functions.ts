/**
 * Fase 9 — Avisos dentro do app: ler e marcar como lido.
 *
 * Os avisos são criados só pelo banco (gatilhos). Pela API, a pessoa lê os dela e marca
 * como lido — a coluna `lido_em` é a única que ela pode mudar.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Aviso = {
  id: string;
  tipo: string;
  titulo: string;
  influencerId: string | null;
  quantidade: number;
  criadoEm: string;
  lido: boolean;
};

export const listarAvisos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ avisos: Aviso[]; naoLidos: number }> => {
    const { supabase, userId } = context;
    const [lista, naoLidos] = await Promise.all([
      supabase
        .from("avisos")
        .select("id, tipo, titulo, influencer_id, quantidade, criado_em, lido_em")
        .eq("user_id", userId)
        .order("criado_em", { ascending: false })
        .limit(20),
      supabase
        .from("avisos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("lido_em", null),
    ]);
    if (lista.error) throw new Error(lista.error.message);
    if (naoLidos.error) throw new Error(naoLidos.error.message);
    return {
      avisos: (lista.data ?? []).map((a) => ({
        id: a.id,
        tipo: a.tipo,
        titulo: a.titulo,
        influencerId: a.influencer_id,
        quantidade: a.quantidade,
        criadoEm: a.criado_em,
        lido: a.lido_em !== null,
      })),
      naoLidos: naoLidos.count ?? 0,
    };
  });

/** Sem `ids`, marca todos os não lidos. */
export const marcarAvisosComoLidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids?: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).max(50).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let consulta = context.supabase
      .from("avisos")
      .update({ lido_em: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("lido_em", null);
    if (data.ids && data.ids.length > 0) consulta = consulta.in("id", data.ids);
    const { error } = await consulta;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
