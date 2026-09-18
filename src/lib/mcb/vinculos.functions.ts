import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEXTO_DO_CONSENTIMENTO_DE_VINCULO } from "@/lib/mcb/vinculos";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Cliente = {
  from: (t: string) => any;
  rpc: (n: string, a?: Record<string, unknown>) => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * A gestora pede para vincular um cadastro do ambiente dela ao cadastro que a mesma
 * pessoa já tem em outro ambiente. Nada é compartilhado até a afiliada aceitar no portal.
 */
export const pedirVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        influencerId: z.string().uuid(),
        email: z.string().trim().email(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // A busca pelo cadastro de origem passa pela chave de serviço porque a gestora não
    // enxerga o outro ambiente. Daqui só sai o id: nenhum dado do outro ambiente vaza.
    const { data: origens, error } = await supabaseAdmin
      .from("influencers")
      .select("id, tenant_id, user_id")
      .ilike("email", data.email)
      .neq("tenant_id", data.tenantId)
      .is("archived_at", null)
      .limit(2);
    if (error) throw new Error(error.message);

    const comConta = (origens ?? []).filter((o) => o.user_id !== null);
    if (comConta.length === 0) {
      throw new Error(
        (origens ?? []).length > 0
          ? "A pessoa existe em outro ambiente, mas ainda não criou a conta de acesso. Sem conta ela não tem como autorizar o vínculo."
          : "Não encontramos ninguém com este e-mail em outro ambiente.",
      );
    }
    if (comConta.length > 1) {
      throw new Error("Este e-mail aparece em mais de um ambiente. Resolva com a plataforma.");
    }

    const { error: erroPedido } = await supabase.rpc("pedir_vinculo_de_identidade", {
      p_destino_influencer_id: data.influencerId,
      p_origem_influencer_id: comConta[0]!.id,
    });
    if (erroPedido) throw new Error(erroPedido.message);
    return { ok: true };
  });

export const situacaoDoVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid(), influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    const { data: linha, error } = await supabase
      .from("vinculos_de_identidade")
      .select("id, situacao, solicitado_em, decidido_em")
      .eq("destino_influencer_id", data.influencerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (linha ?? null) as {
      id: string;
      situacao: "PENDENTE" | "ACEITO" | "RECUSADO";
      solicitado_em: string;
      decidido_em: string | null;
    } | null;
  });

export const desfazerVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ vinculoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    const { error } = await supabase.rpc("desfazer_vinculo_de_identidade", {
      p_vinculo_id: data.vinculoId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pedidos esperando a decisão de quem está logada no portal. */
export const meusVinculosPendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as Cliente;
    const { data, error } = await supabase.rpc("vinculos_pendentes_da_afiliada");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      ambiente: string;
      gestora: string;
      solicitado_em: string;
    }>;
  });

/** A afiliada decide. O texto que ela leu vai junto, para a decisão ficar auditável. */
export const responderVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ vinculoId: z.string().uuid(), aceitar: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    const { error } = await supabase.rpc("responder_vinculo_de_identidade", {
      p_vinculo_id: data.vinculoId,
      p_aceitar: data.aceitar,
      p_texto: TEXTO_DO_CONSENTIMENTO_DE_VINCULO,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
