import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { COMISSAO_PADRAO, NIVEIS_DE_COMISSAO, type SituacaoMeta } from "@/lib/onbio/rede";

const tenantInput = z.object({ tenantId: z.string().uuid() });

const situacao = z.enum(["BATEU", "NAO_BATEU", "SEM_VENDAS"]);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const linhaSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email().max(160).nullable(),
  indicada_por: z.string().trim().min(3).max(120).nullable(),
  vendas_centavos: z.number().int().min(0).max(2_000_000_000).nullable(),
  pedidos: z.number().int().min(0).max(10_000_000).nullable(),
  periodo_inicio: dia.nullable(),
  periodo_fim: dia.nullable(),
  metas: z.record(dia, situacao),
});

export type ResultadoDaImportacao = {
  criadas: number;
  encontradas: number;
  emails_atualizados: number;
  ligacoes: number;
  resultados: number;
  metas: number;
};

/** Grava a rede lida da planilha. Tudo ou nada: um erro desfaz a importação inteira. */
export const importarRedeOnbio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    tenantInput
      .extend({
        origem: z.string().trim().min(1).max(80),
        linhas: z.array(linhaSchema).min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: resultado, error } = await context.supabase.rpc("onbio_importar_rede", {
      p_tenant: data.tenantId,
      p_linhas: data.linhas as unknown as Json,
      p_origem: data.origem,
    });
    if (error) throw new Error(error.message);
    return resultado as unknown as ResultadoDaImportacao;
  });

/** Dados crus da rede. A árvore é montada no navegador com `montarRede`. */
export const getRedeOnbio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tenantInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [pessoas, resultados, metas, ambiente] = await Promise.all([
      supabase
        .from("influencers")
        .select("id, full_name, indicada_por, email")
        .eq("tenant_id", data.tenantId)
        .is("archived_at", null),
      supabase
        .from("commercial_results")
        .select("influencer_id, revenue_cents, orders, period_start, period_end")
        .eq("tenant_id", data.tenantId),
      supabase
        .from("onbio_metas_mensais")
        .select("influencer_id, mes, situacao")
        .eq("tenant_id", data.tenantId),
      supabase
        .from("tenants")
        .select("onbio_comissao_percentuais")
        .eq("id", data.tenantId)
        .maybeSingle(),
    ]);
    const erro = pessoas.error ?? resultados.error ?? metas.error ?? ambiente.error;
    if (erro) throw new Error(erro.message);
    return {
      pessoas: (pessoas.data ?? []).map((p) => ({
        id: p.id,
        nome: p.full_name,
        indicadaPor: p.indicada_por,
        email: p.email,
      })),
      resultados: (resultados.data ?? []).map((r) => ({
        influencerId: r.influencer_id,
        centavos: r.revenue_cents,
        // Mês do resultado quando o período cabe num mês só; senão, null.
        mes:
          r.period_start.slice(0, 7) === r.period_end.slice(0, 7)
            ? r.period_start.slice(0, 7)
            : null,
        pedidos: r.orders,
      })),
      metas: (metas.data ?? []).map((m) => ({
        influencerId: m.influencer_id,
        mes: m.mes,
        situacao: m.situacao as SituacaoMeta,
      })),
      // numeric chega como texto ou número, conforme o driver.
      percentuais: (ambiente.data?.onbio_comissao_percentuais ?? [...COMISSAO_PADRAO]).map(Number),
    };
  });

export const definirComissoesOnbio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    tenantInput
      .extend({
        percentuais: z
          .array(z.number().min(0).max(100))
          .length(NIVEIS_DE_COMISSAO + 1)
          .refine((p) => p.reduce((s, v) => s + v, 0) <= 100, "A soma não pode passar de 100%."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("onbio_definir_comissoes", {
      p_tenant: data.tenantId,
      p_percentuais: data.percentuais,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const definirIndicacaoOnbio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    tenantInput
      .extend({
        influencerId: z.string().uuid(),
        indicadaPor: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("onbio_definir_indicacao", {
      p_influencer: data.influencerId,
      // A função aceita null (remove a indicação); o tipo gerado não reflete isso.
      p_indicada_por: data.indicadaPor as string,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
