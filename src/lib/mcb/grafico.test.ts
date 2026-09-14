import { describe, expect, it } from "vitest";

import { desenharLinha, escalaBonita, rotulosVisiveis } from "./grafico";

describe("gráfico de seguidores", () => {
  it("a escala usa marcas redondas que cobrem os valores", () => {
    const marcas = escalaBonita(412, 912);
    expect(marcas[0]).toBeLessThanOrEqual(412);
    expect(marcas[marcas.length - 1]).toBeGreaterThanOrEqual(912);
    expect(marcas.every((m) => Number.isInteger(m))).toBe(true);
    const passos = new Set(marcas.slice(1).map((m, i) => m - marcas[i]!));
    expect(passos.size).toBe(1);
  });

  it("valor único ainda tem eixo, e seguidores nunca ficam negativos", () => {
    const marcas = escalaBonita(3, 3);
    expect(marcas.length).toBeGreaterThan(1);
    expect(marcas[0]).toBeGreaterThanOrEqual(0);
  });

  it("o primeiro ponto fica na esquerda e o último na direita; mais seguidores, mais alto", () => {
    const margem = { topo: 8, direita: 16, base: 24, esquerda: 56 };
    const linha = desenharLinha(
      [
        { data: "01/09", seguidores: 400 },
        { data: "08/09", seguidores: 600 },
      ],
      600,
      224,
      margem,
    );
    expect(linha.pontos[0]!.x).toBe(56);
    expect(linha.pontos[1]!.x).toBe(600 - 16);
    expect(linha.pontos[1]!.y).toBeLessThan(linha.pontos[0]!.y);
    expect(linha.caminho.startsWith("M56.0,")).toBe(true);
  });

  it("com muitos pontos, mostra no máximo 8 rótulos e sempre o último", () => {
    const visiveis = rotulosVisiveis(30);
    expect(visiveis.size).toBeLessThanOrEqual(9);
    expect(visiveis.has(0)).toBe(true);
    expect(visiveis.has(29)).toBe(true);
    expect(rotulosVisiveis(5).size).toBe(5);
  });
});
