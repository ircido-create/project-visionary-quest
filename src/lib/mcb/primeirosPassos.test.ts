import { describe, expect, it } from "vitest";

import {
  linkDeCandidatura,
  montarPassos,
  paginaFoiAjustada,
  progresso,
  roteiroConcluido,
} from "./primeirosPassos";

const nada = {
  paginaAjustada: false,
  modelosCarregados: false,
  primeiraCandidata: false,
  equipeConvidada: false,
};

describe("roteiro de primeiros passos", () => {
  it("começa com os três passos obrigatórios por fazer", () => {
    const passos = montarPassos(nada);
    expect(progresso(passos)).toEqual({ feitos: 0, total: 3 });
    expect(roteiroConcluido(passos)).toBe(false);
  });

  it("conclui sem o passo opcional da equipe", () => {
    const passos = montarPassos({
      ...nada,
      paginaAjustada: true,
      modelosCarregados: true,
      primeiraCandidata: true,
    });
    expect(roteiroConcluido(passos)).toBe(true);
    expect(progresso(passos)).toEqual({ feitos: 3, total: 3 });
  });

  it("o passo opcional feito não conta no progresso nem conclui sozinho", () => {
    const passos = montarPassos({ ...nada, equipeConvidada: true });
    expect(progresso(passos)).toEqual({ feitos: 0, total: 3 });
    expect(roteiroConcluido(passos)).toBe(false);
  });
});

describe("página ajustada", () => {
  const criado = "2026-09-13T10:00:00Z";

  it("não conta a marca gravada junto com a criação do ambiente", () => {
    expect(paginaFoiAjustada(criado, "2026-09-13T10:00:01Z")).toBe(false);
  });

  it("conta a marca salva depois pela gestora", () => {
    expect(paginaFoiAjustada(criado, "2026-09-13T10:05:00Z")).toBe(true);
  });

  it("sem marca, não está ajustada", () => {
    expect(paginaFoiAjustada(criado, null)).toBe(false);
  });
});

describe("link de inscrição", () => {
  it("monta o endereço completo, com ou sem barra no fim da origem", () => {
    expect(linkDeCandidatura("https://mcblessing.com.br", "blessing")).toBe(
      "https://mcblessing.com.br/g/blessing",
    );
    expect(linkDeCandidatura("https://mcblessing.com.br/", "blessing")).toBe(
      "https://mcblessing.com.br/g/blessing",
    );
  });
});
