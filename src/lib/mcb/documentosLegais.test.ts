import { describe, expect, it } from "vitest";

import {
  CONTROLADOR,
  IDADE_MINIMA,
  VERSAO_POLITICA,
  VERSAO_TERMOS,
  cnpjValido,
  dataPorExtenso,
  pendenciasDosDocumentos,
  politicaDePrivacidade,
  termosDeUso,
  type Secao,
} from "./documentosLegais";

const textoDe = (secoes: Secao[]) =>
  secoes
    .flatMap((s) => [s.titulo, ...s.blocos.flatMap((b) => (b.tipo === "p" ? [b.texto] : b.itens))])
    .join("\n");

describe("dados do responsável", () => {
  it("não há dado obrigatório em branco: as páginas não vão ao ar com lacuna", () => {
    expect(pendenciasDosDocumentos()).toEqual([]);
  });

  it("o CNPJ informado tem dígitos verificadores válidos", () => {
    expect(cnpjValido(CONTROLADOR.cnpj)).toBe(true);
  });

  it("o validador recusa dígito errado e sequência repetida", () => {
    expect(cnpjValido("31.293.212/0001-39")).toBe(false);
    expect(cnpjValido("11.111.111/1111-11")).toBe(false);
    expect(cnpjValido("123")).toBe(false);
  });

  it("o e-mail de contato tem formato de e-mail", () => {
    expect(CONTROLADOR.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });
});

describe("versões", () => {
  it("são datas no formato ano-mês-dia", () => {
    expect(VERSAO_POLITICA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(VERSAO_TERMOS).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("aparecem por extenso no texto", () => {
    expect(dataPorExtenso("2026-09-13")).toBe("13 de setembro de 2026");
  });
});

describe("conteúdo", () => {
  for (const [nome, secoes] of [
    ["política", politicaDePrivacidade()],
    ["termos", termosDeUso()],
  ] as const) {
    it(`${nome}: toda seção tem título, id único e texto`, () => {
      const ids = secoes.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const s of secoes) {
        expect(s.titulo.length).toBeGreaterThan(0);
        expect(s.blocos.length).toBeGreaterThan(0);
        for (const b of s.blocos) {
          if (b.tipo === "p") expect(b.texto.trim().length).toBeGreaterThan(0);
          else expect(b.itens.every((i) => i.trim().length > 0)).toBe(true);
        }
      }
    });

    it(`${nome}: traz o CNPJ, o e-mail e a idade mínima`, () => {
      const texto = textoDe(secoes);
      expect(texto).toContain(CONTROLADOR.cnpj);
      expect(texto).toContain(CONTROLADOR.email);
      expect(texto).toContain(`${IDADE_MINIMA} anos`);
    });
  }

  it("a política diz o que não vai para a IA", () => {
    expect(textoDe(politicaDePrivacidade())).toMatch(
      /Não são enviados nome, e-mail, WhatsApp, cidade, estado nem o @/,
    );
  });
});
