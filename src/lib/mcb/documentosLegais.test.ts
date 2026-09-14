import { describe, expect, it } from "vitest";

import {
  CONTROLADOR,
  IDADE_MINIMA,
  VERSAO_POLITICA,
  VERSAO_ACEITE_EXIGIDO,
  VERSAO_TERMOS,
  aceiteEmDia,
  cnpjValido,
  dataPorExtenso,
  descreverVersao,
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
    expect(VERSAO_POLITICA).toMatch(/^\d{4}-\d{2}-\d{2}(\.\d+)?$/);
    expect(VERSAO_TERMOS).toMatch(/^\d{4}-\d{2}-\d{2}(\.\d+)?$/);
  });

  it("aparecem por extenso no texto", () => {
    expect(dataPorExtenso("2026-09-13")).toBe("13 de setembro de 2026");
    expect(descreverVersao("2026-09-13")).toBe("13 de setembro de 2026");
    expect(descreverVersao("2026-09-13.2")).toBe("13 de setembro de 2026, revisão 2");
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

  it("a política traz os papéis, as bases legais e o prazo de inatividade", () => {
    const texto = textoDe(politicaDePrivacidade());
    expect(texto).toContain("Cada gestora é a controladora");
    expect(texto).toContain("art. 7º, I");
    expect(texto).toContain("90 dias sem nenhuma atividade");
    expect(texto).not.toContain("REVISAR");
  });

  it("os termos trazem renovação, cancelamento e os 7 dias de arrependimento", () => {
    const texto = textoDe(termosDeUso());
    expect(texto).toContain("cobrança é mensal");
    expect(texto).toContain("cancelar a qualquer momento, sem multa");
    expect(texto).toContain("desistir em até 7 dias");
  });

  it("a política não fala mais de estatísticas de visita (desligadas na hospedagem)", () => {
    const texto = textoDe(politicaDePrivacidade());
    expect(texto).not.toContain("Tinybird");
    expect(texto).not.toContain("session-id");
    expect(texto).toContain("Não coletamos estatísticas de visita");
  });

  it("os termos trazem a avaliação de 14 dias e a tolerância de 3 dias", () => {
    const texto = textoDe(termosDeUso());
    expect(texto).toContain("14 dias de avaliação gratuita");
    expect(texto).toContain("mais 3 dias");
    expect(texto).toContain("5 dias antes do vencimento");
  });

  it("os termos dizem que a dona baixa os dados e exclui o ambiente", () => {
    const texto = textoDe(termosDeUso());
    expect(texto).toContain("baixar todos os dados");
    expect(texto).toContain("excluí-lo de vez");
  });

  it("os termos trazem a cláusula de operação de dados", () => {
    expect(termosDeUso().map((sec) => sec.id)).toContain("operacao");
  });

  it("a política diz o que não vai para a IA", () => {
    expect(textoDe(politicaDePrivacidade())).toMatch(
      /Não são enviados nome, e-mail, WhatsApp, cidade, estado nem o @/,
    );
  });
});

describe("aceite dos termos", () => {
  it("vale a versão exigida ou uma posterior", () => {
    expect(aceiteEmDia(["2026-09-13.4"], "2026-09-13.4")).toBe(true);
    expect(aceiteEmDia(["2026-09-13.10"], "2026-09-13.4")).toBe(true);
    expect(aceiteEmDia(["2026-10-01"], "2026-09-13.4")).toBe(true);
    expect(aceiteEmDia(["2026-09-13.3", "2026-09-13"], "2026-09-13.4")).toBe(false);
    expect(aceiteEmDia([], "2026-09-13.4")).toBe(false);
  });

  it("quem aceita a versão atual no cadastro não é barrado na entrada", () => {
    expect(aceiteEmDia([VERSAO_TERMOS], VERSAO_ACEITE_EXIGIDO)).toBe(true);
  });
});

describe("pontos validados na revisão jurídica", () => {
  it("a política traz encarregado, transferência, prazos e dados sensíveis", () => {
    const texto = textoDe(politicaDePrivacidade());
    expect(texto).toContain("agente de tratamento de pequeno porte");
    expect(texto).toContain("art. 33, II");
    expect(texto).toContain("Supabase — banco de dados, autenticação e arquivos: Estados Unidos.");
    expect(texto).toContain("declaração completa em até 15 dias");
    expect(texto).toContain("no prazo definido pela autoridade");
    expect(texto).toContain("Não pedimos dados sensíveis");
    expect(texto).toContain("15 dias de antecedência");
  });

  it("os termos avisam antes de suspender e antes de mudar, e registram o aceite", () => {
    const texto = textoDe(termosDeUso());
    expect(texto).toContain("Antes de suspender, a MCB avisa a gestora");
    expect(texto).toContain("15 dias de antecedência");
    expect(texto).toContain("registra a versão e a data do aceite");
  });
});
