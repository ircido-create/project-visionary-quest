/**
 * Chamada ao gateway de IA do Lovable (formato de chat do OpenAI).
 *
 * Substitui a chamada direta ao Gemini: os secrets cadastrados à mão no Lovable (como a
 * antiga `GEMINI_API_KEY`) nunca chegaram ao servidor publicado, e a `LOVABLE_API_KEY` é
 * provisionada pelo próprio Lovable. O modelo continua sendo do Google (Gemini).
 *
 * A saída estruturada vem por chamada de ferramenta com o schema da análise — é o jeito
 * que o gateway garante JSON. A validação com zod continua em `ai.functions.ts`: o schema
 * é uma instrução ao modelo, não uma garantia.
 *
 * Só roda no servidor (a chave nunca chega ao navegador).
 */

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const NOME_DA_FERRAMENTA = "registrar_analise";

export type PedidoDeAnalise = {
  modelo: string;
  sistema: string;
  usuario: string;
  schema: Record<string, unknown>;
};

export function montarCorpo(pedido: PedidoDeAnalise) {
  // `$schema` é metadado do JSON Schema; os parâmetros de ferramenta não o aceitam.
  const { $schema: _metadado, ...parametros } = pedido.schema;
  return {
    model: pedido.modelo,
    messages: [
      { role: "system", content: pedido.sistema },
      { role: "user", content: pedido.usuario },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: NOME_DA_FERRAMENTA,
          description: "Registra a análise do perfil no formato pedido.",
          parameters: parametros,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: NOME_DA_FERRAMENTA } },
  };
}

type Resposta = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
    };
  }>;
};

/** O JSON da análise: dos argumentos da ferramenta ou, na falta, do texto da resposta. */
export function extrairJson(corpo: unknown): string | null {
  const mensagem = (corpo as Resposta | null)?.choices?.[0]?.message;
  const argumentos = mensagem?.tool_calls?.[0]?.function?.arguments;
  if (typeof argumentos === "string" && argumentos.trim()) return argumentos;
  const conteudo = mensagem?.content;
  if (typeof conteudo !== "string" || !conteudo.trim()) return null;
  return conteudo
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

export function falhaPassageira(status: number): boolean {
  return status === 429 || status >= 500;
}

export function mensagemDeErro(status: number, detalhe: string): string {
  if (status === 402) {
    return "Os créditos de IA do workspace no Lovable acabaram. Adicione créditos no Lovable e tente de novo.";
  }
  if (status === 429) return "Muitas análises em pouco tempo. Aguarde um minuto e tente de novo.";
  if (status === 401 || status === 403) {
    return "O serviço de IA do Lovable recusou a chave do projeto (LOVABLE_API_KEY).";
  }
  const resumo = detalhe.trim().slice(0, 200);
  return `O serviço de IA respondeu ${status}${resumo ? `: ${resumo}` : ""}.`;
}

/** Chama o gateway, repetindo em falha passageira (429 e 5xx) com espera crescente. */
export async function gerarAnalise(
  pedido: PedidoDeAnalise & { apiKey: string },
  opcoes: {
    tentativas?: number;
    esperar?: (ms: number) => Promise<void>;
    buscar?: typeof fetch;
  } = {},
): Promise<string | null> {
  const tentativas = opcoes.tentativas ?? 3;
  const esperar = opcoes.esperar ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const buscar = opcoes.buscar ?? fetch;
  const corpo = JSON.stringify(montarCorpo(pedido));

  for (let i = 0; ; i += 1) {
    const resposta = await buscar(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pedido.apiKey}`,
        "Content-Type": "application/json",
      },
      body: corpo,
    });
    if (resposta.ok) return extrairJson(await resposta.json());
    const detalhe = await resposta.text().catch(() => "");
    if (!falhaPassageira(resposta.status) || i >= tentativas - 1) {
      throw new Error(mensagemDeErro(resposta.status, detalhe));
    }
    await esperar(2000 * (i + 1));
  }
}
