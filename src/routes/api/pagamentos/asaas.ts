import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook do Asaas. O Asaas manda o token combinado no cabeçalho `asaas-access-token`;
 * sem ele, a porta fica fechada. Responder 200 a evento conhecido e ignorado é de
 * propósito: erro faz o Asaas reenviar em fila, e a fila trava a conta.
 */
export const Route = createFileRoute("/api/pagamentos/asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { chamadaDoAsaasValida, ambienteDoPagamento, registrarPagamento, cicloDaAssinatura } =
          await import("@/lib/mcb/asaas.server");
        const { lerEvento, mesesDoCiclo } = await import("@/lib/mcb/asaas");

        if (!(await chamadaDoAsaasValida(request.headers.get("asaas-access-token")))) {
          return Response.json({ erro: "não autorizado" }, { status: 401 });
        }

        const corpo = (await request.json().catch(() => null)) as Parameters<typeof lerEvento>[0];
        const acao = lerEvento(corpo);
        if (acao.tipo === "ignorar") {
          return Response.json({ ok: true, ignorado: acao.motivo });
        }

        try {
          const tenantId = await ambienteDoPagamento(acao.customer, acao.subscription);
          if (!tenantId) {
            // Cobrança de alguém que o sistema não conhece: registrar erro faria o Asaas
            // reenviar para sempre. Fica o aviso na resposta, que aparece no painel dele.
            return Response.json({ ok: true, ignorado: "assinatura sem ambiente no MCB" });
          }

          // O evento não diz quantos meses foram pagos; quem sabe é a assinatura.
          // Cobrança avulsa, sem assinatura, vale um mês.
          const ciclo = acao.subscription ? await cicloDaAssinatura(acao.subscription) : "MONTHLY";

          await registrarPagamento({
            tenantId,
            centavos: acao.centavos,
            meses: mesesDoCiclo(ciclo),
            forma: acao.forma,
            referencia: acao.referencia,
            observacao: `Asaas ${acao.forma}`,
          });
          return Response.json({ ok: true });
        } catch (erro) {
          const mensagem = erro instanceof Error ? erro.message : "falha ao registrar";
          return Response.json({ erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});
