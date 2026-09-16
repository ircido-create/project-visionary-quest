import { describe, expect, it } from "vitest";

import {
  GATEWAY_URL,
  NOME_DA_FERRAMENTA,
  extrairJson,
  gerarAnalise,
  mensagemDeErro,
  montarCorpo,
} from "./ai-gateway";

const pedido = {
  modelo: "google/gemini-2.5-flash",
  sistema: "instruções",
  usuario: "dados do perfil",
  schema: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object" },
};

const respostaComFerramenta = (argumentos: string) => ({
  choices: [
    {
      message: { tool_calls: [{ function: { name: NOME_DA_FERRAMENTA, arguments: argumentos } }] },
    },
  ],
});

function falso(respostas: Array<{ status: number; corpo: unknown }>) {
  const chamadas: Array<{ url: string; init: RequestInit | undefined }> = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init });
    const r = respostas.shift()!;
    return new Response(typeof r.corpo === "string" ? r.corpo : JSON.stringify(r.corpo), {
      status: r.status,
    });
  }) as unknown as typeof fetch;
  return { buscar, chamadas };
}

describe("gateway de IA do Lovable", () => {
  it("pede a análise por chamada de ferramenta, sem o metadado $schema", () => {
    const corpo = montarCorpo(pedido);
    expect(corpo.model).toBe("google/gemini-2.5-flash");
    expect(corpo.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(corpo.tools[0]!.function.parameters).toEqual({ type: "object" });
    expect(corpo.tool_choice.function.name).toBe(NOME_DA_FERRAMENTA);
  });

  it("lê o JSON dos argumentos da ferramenta e, na falta, do texto sem cercas", () => {
    expect(extrairJson(respostaComFerramenta('{"a":1}'))).toBe('{"a":1}');
    expect(extrairJson({ choices: [{ message: { content: '```json\n{"a":2}\n```' } }] })).toBe(
      '{"a":2}',
    );
    expect(extrairJson({ choices: [{ message: { content: "  " } }] })).toBeNull();
    expect(extrairJson(null)).toBeNull();
  });

  it("repete em falha passageira e envia a chave no cabeçalho", async () => {
    const { buscar, chamadas } = falso([
      { status: 503, corpo: "ocupado" },
      { status: 200, corpo: respostaComFerramenta('{"ok":true}') },
    ]);
    const esperas: number[] = [];
    const texto = await gerarAnalise(
      { ...pedido, apiKey: "chave-de-teste" },
      { buscar, esperar: async (ms) => void esperas.push(ms) },
    );
    expect(texto).toBe('{"ok":true}');
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0]!.url).toBe(GATEWAY_URL);
    expect((chamadas[0]!.init?.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer chave-de-teste",
    );
    expect(esperas).toEqual([2000]);
  });

  it("créditos esgotados não repetem e explicam o que fazer", async () => {
    const { buscar, chamadas } = falso([{ status: 402, corpo: "payment required" }]);
    await expect(
      gerarAnalise({ ...pedido, apiKey: "x" }, { buscar, esperar: async () => undefined }),
    ).rejects.toThrow("créditos de IA");
    expect(chamadas).toHaveLength(1);
  });

  it("mensagens de erro em português, sem vazar corpo longo", () => {
    expect(mensagemDeErro(429, "")).toContain("Aguarde um minuto");
    expect(mensagemDeErro(401, "")).toContain("LOVABLE_API_KEY");
    expect(mensagemDeErro(500, "x".repeat(500)).length).toBeLessThan(260);
  });
});
