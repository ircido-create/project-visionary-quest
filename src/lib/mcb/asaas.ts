/**
 * Cobrança pelo Asaas — o que é puro: endereços, ciclos e leitura do webhook.
 *
 * POR QUE ASSINATURA, E NÃO COBRANÇA AVULSA
 *
 * A gestora assina uma vez e o Asaas gera a cobrança de cada mês. O sistema não precisa
 * lembrar de cobrar ninguém: quando o dinheiro entra, chega um webhook, e é ele que
 * empurra o vencimento que a rotina diária de suspensão já olha.
 *
 * O QUE O WEBHOOK PODE DIZER
 *
 * O Asaas manda muitos eventos. Aqui só três importam: pagamento recebido, pagamento
 * confirmado e cobrança estornada. Todo o resto é reconhecido e ignorado de propósito —
 * responder 200 a um evento conhecido evita que o Asaas fique reenviando.
 */

export type Ambiente = "sandbox" | "producao";

export const URL_DA_API: Record<Ambiente, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
};

/** A chave do sandbox tem prefixo próprio; é ela que diz em qual ambiente falamos. */
export function ambienteDaChave(chave: string): Ambiente {
  return chave.includes("_hmlg_") ? "sandbox" : "producao";
}

export type Ciclo = "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";

export const CICLOS: Array<{ ciclo: Ciclo; meses: number; rotulo: string }> = [
  { ciclo: "MONTHLY", meses: 1, rotulo: "Mensal" },
  { ciclo: "QUARTERLY", meses: 3, rotulo: "Trimestral" },
  { ciclo: "SEMIANNUALLY", meses: 6, rotulo: "Semestral" },
  { ciclo: "YEARLY", meses: 12, rotulo: "Anual" },
];

export function mesesDoCiclo(ciclo: string): number {
  return CICLOS.find((c) => c.ciclo === ciclo)?.meses ?? 1;
}

/**
 * Formas de pagamento oferecidas. `UNDEFINED` deixa a escolha com a gestora na tela do
 * Asaas — Pix, boleto ou cartão —, que é o que evita perder uma assinatura por causa de
 * quem não usa cartão.
 */
export const FORMA_PADRAO = "UNDEFINED" as const;

export type EventoDoWebhook = {
  event?: string;
  payment?: {
    id?: string;
    customer?: string;
    subscription?: string;
    value?: number;
    billingType?: string;
    description?: string;
  };
};

export type AcaoDoWebhook =
  | {
      tipo: "registrar";
      referencia: string;
      centavos: number;
      forma: string;
      customer: string | null;
      subscription: string | null;
    }
  | { tipo: "ignorar"; motivo: string };

const EVENTOS_DE_ENTRADA = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];

/** Reais com centavos viram centavos inteiros, sem erro de ponto flutuante. */
export function emCentavos(valor: number | null | undefined): number {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return 0;
  return Math.round(valor * 100);
}

export function lerEvento(corpo: EventoDoWebhook | null | undefined): AcaoDoWebhook {
  const evento = corpo?.event;
  if (!evento) return { tipo: "ignorar", motivo: "evento sem nome" };
  if (!EVENTOS_DE_ENTRADA.includes(evento)) {
    return { tipo: "ignorar", motivo: `evento ${evento} não movimenta assinatura` };
  }

  const pagamento = corpo?.payment;
  if (!pagamento?.id) return { tipo: "ignorar", motivo: "pagamento sem identificador" };
  const centavos = emCentavos(pagamento.value);
  if (centavos <= 0) return { tipo: "ignorar", motivo: "pagamento sem valor" };

  return {
    tipo: "registrar",
    referencia: pagamento.id,
    centavos,
    forma: pagamento.billingType ?? "ASAAS",
    customer: pagamento.customer ?? null,
    subscription: pagamento.subscription ?? null,
  };
}

/** CPF ou CNPJ só com dígitos, como o Asaas espera. */
export function somenteDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Primeiro vencimento: alguns dias à frente, para dar tempo de pagar o boleto. */
export function primeiroVencimento(dias = 3, agora = new Date()): string {
  const data = new Date(agora.getTime() + dias * 86_400_000);
  return data.toISOString().slice(0, 10);
}
