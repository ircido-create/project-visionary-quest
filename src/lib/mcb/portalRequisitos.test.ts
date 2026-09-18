import { describe, expect, it } from "vitest";

import { requisitosParaCandidata, resumoDosRequisitos } from "./portalRequisitos";
import { evaluateQualification } from "./qualification";

const avaliar = (entrada: Parameters<typeof evaluateQualification>[0]) =>
  requisitosParaCandidata(evaluateQualification(entrada).requirements);

describe("requisitos no portal da afiliada", () => {
  it("quem cumpre tudo vê os 5 cumpridos e nenhum próximo passo", () => {
    const itens = avaliar({
      followers: 4272,
      postsCount: 1021,
      recentPosts6m: "SIM",
      profileType: "CRIADOR",
      femaleAudiencePct: 84,
    });
    expect(itens).toHaveLength(5);
    expect(itens.every((i) => i.situacao === "cumprido" && i.proximoPasso === null)).toBe(true);
    expect(resumoDosRequisitos(itens)).toBe("Você cumpre os 5 requisitos do programa.");
  });

  it("o que falta vira um passo concreto, com quanto falta", () => {
    const itens = avaliar({
      followers: 412,
      postsCount: 30,
      recentPosts6m: "NAO",
      profileType: "PESSOAL",
      femaleAudiencePct: 48,
    });
    const por = (chave: string) => itens.find((i) => i.chave === chave)!;
    expect(por("followers").proximoPasso).toBe("Faltam 88 seguidores para chegar a 500.");
    expect(por("posts").proximoPasso).toBe("Falta 1 publicação no feed para passar de 30.");
    expect(por("recency").situacao).toBe("falta");
    expect(por("profile_type").proximoPasso).toContain("criadora de conteúdo");
    expect(por("female_audience").proximoPasso).toBe(
      "Seu público feminino está em 48%; precisa passar de 50%.",
    );
    expect(resumoDosRequisitos(itens)).toBe(
      "0 de 5 requisitos cumpridos. Veja abaixo o que falta.",
    );
  });

  it("dado que não se sabe pede para contar à gestora, sem dizer que falhou", () => {
    const itens = avaliar({
      followers: 912,
      postsCount: 182,
      recentPosts6m: "NAO_SEI",
      profileType: "NAO_SEI",
      femaleAudiencePct: null,
    });
    const publico = itens.find((i) => i.chave === "female_audience")!;
    expect(publico.situacao).toBe("a_confirmar");
    expect(publico.atual).toBeNull();
    expect(publico.proximoPasso).toContain("print do público");
    expect(resumoDosRequisitos(itens)).toBe(
      "2 de 5 requisitos cumpridos. Veja abaixo o que falta.",
    );
  });

  it("números saem no formato brasileiro", () => {
    const itens = avaliar({
      followers: 12400,
      postsCount: 40,
      recentPosts6m: "SIM",
      profileType: "CRIADOR",
      femaleAudiencePct: 72.5,
    });
    expect(itens.find((i) => i.chave === "followers")!.atual).toBe("12.400");
    expect(itens.find((i) => i.chave === "female_audience")!.atual).toBe("72,5%");
  });
});
