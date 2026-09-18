import { describe, expect, it } from "vitest";

import { instrucaoDoSistema, pautaEmTexto, pautaVazia, type Pauta } from "./pautas";

const pauta: Pauta = {
  resumo_executivo: "A equipe cresceu 8% no mês.",
  conquistas: ["Três afiliadas passaram de mil seguidores"],
  pontos_de_atencao: ["Duas contas sem atualização há 20 dias"],
  perguntas: [],
  decisoes_necessarias: ["Definir a meta do próximo mês"],
  proximos_passos: ["Agendar conversa individual com quem está parada"],
};

describe("instrução por programa", () => {
  it("na ONBIO fala de resultado e proíbe linguagem de qualificação", () => {
    const texto = instrucaoDoSistema("ONBIO", "INDIVIDUAL");
    expect(texto).toContain("comercial");
    expect(texto).toContain("nunca fale em qualificação");
  });

  it("na Ybera fala de requisitos e não promete aprovação", () => {
    const texto = instrucaoDoSistema("YBERA", "EQUIPE");
    expect(texto).toContain("requisitos");
    expect(texto).toContain("não garante aprovação");
  });

  it("separa reunião de equipe da individual", () => {
    expect(instrucaoDoSistema("ONBIO", "EQUIPE")).toContain("reunião de equipe");
    expect(instrucaoDoSistema("ONBIO", "INDIVIDUAL")).toContain("reunião individual");
  });
});

describe("pauta em texto", () => {
  it("monta o texto na ordem da reunião e pula seções vazias", () => {
    const texto = pautaEmTexto(pauta, "Pauta da equipe — 18/09");
    expect(texto.startsWith("Pauta da equipe — 18/09")).toBe(true);
    expect(texto).toContain("Conquistas:\n- Três afiliadas passaram de mil seguidores");
    expect(texto).not.toContain("Perguntas para a conversa");
    expect(texto.indexOf("Conquistas")).toBeLessThan(texto.indexOf("Próximos passos"));
  });
});

describe("pauta vazia", () => {
  it("reconhece resposta sem conteúdo", () => {
    expect(pautaVazia(pauta)).toBe(false);
    expect(
      pautaVazia({
        resumo_executivo: "  ",
        conquistas: [],
        pontos_de_atencao: [],
        perguntas: [],
        decisoes_necessarias: [],
        proximos_passos: [],
      }),
    ).toBe(true);
  });
});
