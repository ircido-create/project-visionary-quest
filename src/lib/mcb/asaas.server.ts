/**
 * Conversa com o Asaas, sempre pelo servidor.
 *
 * A chave vive no Vault e é lida pela função `segredos_do_asaas`, que só a chave de
 * serviço executa. Ela nunca chega ao navegador, nem a respostas, nem a logs: o que sai
 * daqui é o link de pagamento e o identificador da assinatura.
 *
 * Enquanto só houver a chave de sandbox, é com ela que se fala — é o que permite testar o
 * fluxo inteiro sem dinheiro real. Quando a chave de produção existir, ela passa na frente.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  FORMA_PADRAO,
  URL_DA_API,
  ambienteDaChave,
  primeiroVencimento,
  somenteDigitos,
  type Ambiente,
  type Ciclo,
} from "@/lib/mcb/asaas";

type Rpc = (
  nome: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

const rpc: Rpc = (nome, args) => (supabaseAdmin as unknown as { rpc: Rpc }).rpc(nome, args);

type Segredo = { nome: string; valor: string };

async function segredos(): Promise<Map<string, string>> {
  const { data, error } = await rpc("segredos_do_asaas");
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as Segredo[]).map((s) => [s.nome, s.valor]));
}

export async function chaveDoAsaas(): Promise<{ chave: string; ambiente: Ambiente }> {
  const guardados = await segredos();
  const chave = guardados.get("ASAAS_API_KEY") ?? guardados.get("ASAAS_API_KEY_SANDBOX");
  if (!chave?.trim()) {
    throw new Error(
      "A cobrança ainda não está configurada: falta a chave do Asaas no Vault do banco.",
    );
  }
  return { chave: chave.trim(), ambiente: ambienteDaChave(chave) };
}

/** Confere o cabeçalho do webhook contra o segredo do Vault, sem vazar tempo. */
export async function chamadaDoAsaasValida(recebido: string | null): Promise<boolean> {
  const esperado = (await segredos()).get("ASAAS_WEBHOOK_TOKEN");
  // Sem token cadastrado a porta fica fechada: é mais seguro recusar do que aceitar todos.
  if (!esperado?.trim() || !recebido) return false;
  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(esperado.trim());
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) diferenca |= a[i]! ^ b[i]!;
  return diferenca === 0;
}

async function pedir<T>(caminho: string, init: RequestInit & { corpo?: unknown } = {}): Promise<T> {
  const { chave, ambiente } = await chaveDoAsaas();
  const { corpo, ...resto } = init;
  const resposta = await fetch(`${URL_DA_API[ambiente]}${caminho}`, {
    ...resto,
    headers: {
      "content-type": "application/json",
      access_token: chave,
      "User-Agent": "MCB",
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    signal: AbortSignal.timeout(20_000),
  });

  const json: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    // O Asaas devolve { errors: [{ description }] }; a frase dele explica melhor que o número.
    const descricao = (json as { errors?: Array<{ description?: string }> })?.errors?.[0]
      ?.description;
    throw new Error(descricao ?? `O Asaas respondeu ${resposta.status}.`);
  }
  return json as T;
}

type Cliente = { id: string };

/** Cria a cliente no Asaas, ou reaproveita a que já existe para aquele CPF/CNPJ. */
export async function garantirCliente(dados: {
  nome: string;
  email: string;
  cpfCnpj: string;
  whatsapp?: string | null;
}): Promise<string> {
  const documento = somenteDigitos(dados.cpfCnpj);
  const existentes = await pedir<{ data?: Cliente[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(documento)}&limit=1`,
  );
  const jaExiste = existentes.data?.[0]?.id;
  if (jaExiste) return jaExiste;

  const criado = await pedir<Cliente>("/customers", {
    method: "POST",
    corpo: {
      name: dados.nome,
      email: dados.email,
      cpfCnpj: documento,
      mobilePhone: somenteDigitos(dados.whatsapp) || undefined,
      notificationDisabled: false,
    },
  });
  return criado.id;
}

export type AssinaturaCriada = {
  id: string;
  link: string | null;
};

/**
 * Cria a assinatura recorrente. A forma de pagamento fica em aberto: a gestora escolhe
 * Pix, boleto ou cartão na página do Asaas, e é o Asaas que cobra nos meses seguintes.
 */
export async function criarAssinatura(dados: {
  clienteId: string;
  valorCentavos: number;
  ciclo: Ciclo;
  descricao: string;
  referenciaExterna: string;
}): Promise<AssinaturaCriada> {
  const assinatura = await pedir<{ id: string }>("/subscriptions", {
    method: "POST",
    corpo: {
      customer: dados.clienteId,
      billingType: FORMA_PADRAO,
      value: dados.valorCentavos / 100,
      nextDueDate: primeiroVencimento(),
      cycle: dados.ciclo,
      description: dados.descricao,
      externalReference: dados.referenciaExterna,
    },
  });

  // A primeira cobrança nasce junto; é o link dela que a gestora abre para pagar.
  const cobrancas = await pedir<{ data?: Array<{ invoiceUrl?: string }> }>(
    `/subscriptions/${assinatura.id}/payments?limit=1`,
  );
  return { id: assinatura.id, link: cobrancas.data?.[0]?.invoiceUrl ?? null };
}

/** Ciclo da assinatura, para saber quantos meses cada pagamento compra. */
export async function cicloDaAssinatura(assinaturaId: string): Promise<string> {
  const assinatura = await pedir<{ cycle?: string }>(`/subscriptions/${assinaturaId}`);
  return assinatura.cycle ?? "MONTHLY";
}

export async function cancelarAssinaturaNoAsaas(assinaturaId: string): Promise<void> {
  await pedir(`/subscriptions/${assinaturaId}`, { method: "DELETE" });
}

/** Ambiente ligado àquela assinatura ou cliente, para o webhook saber de quem se trata. */
export async function ambienteDoPagamento(
  customer: string | null,
  subscription: string | null,
): Promise<string | null> {
  const { data, error } = await rpc("ambiente_do_asaas", {
    p_customer: customer,
    p_subscription: subscription,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function registrarPagamento(dados: {
  tenantId: string;
  centavos: number;
  meses: number;
  forma: string;
  referencia: string;
  observacao: string;
}): Promise<void> {
  const { error } = await rpc("registrar_pagamento_do_provedor", {
    p_tenant: dados.tenantId,
    p_valor_centavos: dados.centavos,
    p_meses: dados.meses,
    p_forma: dados.forma,
    p_referencia: dados.referencia,
    p_observacao: dados.observacao,
  });
  if (error) throw new Error(error.message);
}

export async function salvarVinculo(
  tenantId: string,
  clienteId: string | null,
  assinaturaId: string | null,
): Promise<void> {
  const { error } = await rpc("salvar_assinatura_externa", {
    p_tenant: tenantId,
    p_customer: clienteId,
    p_subscription: assinaturaId,
  });
  if (error) throw new Error(error.message);
}
