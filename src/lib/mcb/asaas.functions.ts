import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "@/lib/mcb/audit";
import { somenteDigitos, type Ciclo } from "@/lib/mcb/asaas";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Cliente = {
  from: (t: string) => any;
  rpc: (n: string, a?: Record<string, unknown>) => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Cria (ou reaproveita) a assinatura no Asaas e devolve o link de pagamento.
 *
 * O documento vem da gestora porque o Asaas exige CPF ou CNPJ de quem paga; nada disso é
 * guardado aqui, só enviado ao provedor. O que fica no banco é o vínculo: qual cliente e
 * qual assinatura pertencem a este ambiente.
 */
export const assinarPeloAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        nome: z.string().trim().min(3).max(120),
        email: z.string().trim().email(),
        cpfCnpj: z.string().trim().min(11).max(20),
        whatsapp: z.string().trim().max(30).nullable(),
        ciclo: z.enum(["MONTHLY", "QUARTERLY", "SEMIANNUALLY", "YEARLY"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;

    const documento = somenteDigitos(data.cpfCnpj);
    if (documento.length !== 11 && documento.length !== 14) {
      throw new Error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
    }

    // Só a dona assina, e a leitura do plano passa pela RLS dela.
    const { data: dona } = await supabase.rpc("has_tenant_role", {
      _tenant: data.tenantId,
      _roles: ["manager_owner"],
    });
    if (!dona) throw new Error("Só a dona do ambiente assina o plano.");

    const { data: ambiente, error } = await supabase
      .from("tenants")
      .select(
        "id, name, cobranca, asaas_customer_id, asaas_subscription_id, plans(name, price_cents)",
      )
      .eq("id", data.tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ambiente) throw new Error("Ambiente não encontrado.");

    const registro = ambiente as {
      id: string;
      name: string;
      cobranca: string;
      asaas_customer_id: string | null;
      asaas_subscription_id: string | null;
      plans: { name: string; price_cents: number } | null;
    };
    if (registro.cobranca === "ISENTA") {
      throw new Error("Este ambiente é isento de cobrança.");
    }
    const precoCentavos = registro.plans?.price_cents ?? 0;
    if (precoCentavos <= 0) {
      throw new Error("O plano deste ambiente não tem preço definido.");
    }

    const { cancelarAssinaturaNoAsaas, criarAssinatura, garantirCliente, salvarVinculo } =
      await import("@/lib/mcb/asaas.server");

    // Trocar de ciclo é assinar de novo: a anterior sai para não cobrar duas vezes.
    if (registro.asaas_subscription_id) {
      try {
        await cancelarAssinaturaNoAsaas(registro.asaas_subscription_id);
      } catch {
        // Assinatura já removida no Asaas: seguir é o certo, não travar a nova.
      }
    }

    const clienteId = await garantirCliente({
      nome: data.nome,
      email: data.email,
      cpfCnpj: documento,
      whatsapp: data.whatsapp,
    });

    const assinatura = await criarAssinatura({
      clienteId,
      valorCentavos: precoCentavos,
      ciclo: data.ciclo as Ciclo,
      descricao: `MCB — plano ${registro.plans?.name ?? "Essencial"} (${registro.name})`,
      referenciaExterna: registro.id,
    });

    await salvarVinculo(registro.id, clienteId, assinatura.id);
    await audit(context.supabase, {
      tenant_id: registro.id,
      actor_id: context.userId,
      action: "assinatura.criada_no_provedor",
      entity: "tenants",
      entity_id: registro.id,
      meta: { provedor: "asaas", ciclo: data.ciclo, valor_centavos: precoCentavos },
    });

    return { link: assinatura.link, valorCentavos: precoCentavos };
  });

/** Se a cobrança automática está configurada, e se este ambiente já assinou. */
export const situacaoDaCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    const { data: ambiente } = await supabase
      .from("tenants")
      .select("asaas_subscription_id")
      .eq("id", data.tenantId)
      .maybeSingle();

    let disponivel = false;
    try {
      const { chaveDoAsaas } = await import("@/lib/mcb/asaas.server");
      await chaveDoAsaas();
      disponivel = true;
    } catch {
      disponivel = false;
    }

    return {
      disponivel,
      assinada: Boolean(
        (ambiente as { asaas_subscription_id: string | null } | null)?.asaas_subscription_id,
      ),
    };
  });
