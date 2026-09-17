import { describe, expect, it } from "vitest";

import {
  crescimentoNoPeriodo,
  historicoDeCrescimento,
  intervaloDoPeriodo,
  resumoDoPainel,
  situacaoDaIntegracao,
  variacao,
  type Registro,
} from "./seguidores";

const r = (
  capturedAt: string,
  followers: number | null,
  source: Registro["source"] = "META_API",
) => ({
  capturedAt,
  followers,
  source,
});

describe("variação de seguidores", () => {
  it("calcula diferença e percentual com uma casa", () => {
    expect(variacao(1000, 1200)).toEqual({ absoluta: 200, percentual: 20 });
    expect(variacao(3000, 2900)).toEqual({ absoluta: -100, percentual: -3.3 });
  });

  it("sem número anterior ou atual não há variação; base zero não tem percentual", () => {
    expect(variacao(null, 500)).toEqual({ absoluta: null, percentual: null });
    expect(variacao(500, undefined)).toEqual({ absoluta: null, percentual: null });
    expect(variacao(0, 40)).toEqual({ absoluta: 40, percentual: null });
  });
});

describe("situação da integração", () => {
  it("pendente sem conexão, erro quando a última consulta falhou", () => {
    expect(situacaoDaIntegracao(null)).toBe("PENDENTE");
    expect(situacaoDaIntegracao({ ultimoErro: null })).toBe("CONECTADO");
    expect(situacaoDaIntegracao({ ultimoErro: "token expirado" })).toBe("ERRO");
  });
});

describe("histórico de crescimento", () => {
  it("compara cada registro com o anterior, ignora registros sem número e mostra o mais recente primeiro", () => {
    const linhas = historicoDeCrescimento([
      r("2026-09-10T10:00:00Z", 1100),
      r("2026-09-01T10:00:00Z", 1000, "MANUAL"),
      r("2026-09-05T10:00:00Z", null),
    ]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ anterior: 1000, atual: 1100, absoluta: 100, percentual: 10 });
    expect(linhas[1]).toMatchObject({
      anterior: null,
      atual: 1000,
      absoluta: null,
      fonte: "MANUAL",
    });
  });
});

describe("crescimento no período", () => {
  const registros = [
    r("2026-08-01T12:00:00Z", 900),
    r("2026-09-01T12:00:00Z", 1000),
    r("2026-09-15T12:00:00Z", 1250),
  ];

  it("usa o último registro antes do início como base", () => {
    const c = crescimentoNoPeriodo(
      registros,
      new Date("2026-08-15T00:00:00Z"),
      new Date("2026-09-16T00:00:00Z"),
    );
    expect(c).toMatchObject({ inicio: 900, atual: 1250, absoluta: 350, percentual: 38.9 });
    expect(c.atualizadoEm).toBe("2026-09-15T12:00:00Z");
  });

  it("afiliada que entrou no meio do período parte do primeiro registro dele", () => {
    const c = crescimentoNoPeriodo(
      registros,
      new Date("2026-07-01T00:00:00Z"),
      new Date("2026-09-02T00:00:00Z"),
    );
    expect(c).toMatchObject({ inicio: 900, atual: 1000, absoluta: 100 });
  });

  it("sem registros não inventa zero", () => {
    expect(crescimentoNoPeriodo([], new Date(), new Date())).toMatchObject({
      inicio: null,
      atual: null,
      absoluta: null,
      percentual: null,
    });
  });
});

describe("resumo do painel", () => {
  it("soma só as contas consultadas na Meta e separa as sem dados autorizados", () => {
    const resumo = resumoDoPainel([
      {
        situacao: "CONECTADO",
        seguidores: 1000,
        fonte: "META_API",
        crescimento: 50,
        atualizadoEm: "2026-09-15T10:00:00Z",
      },
      {
        situacao: "ERRO",
        seguidores: 2000,
        fonte: "META_API",
        crescimento: null,
        atualizadoEm: "2026-09-10T10:00:00Z",
      },
      {
        situacao: "PENDENTE",
        seguidores: 5000,
        fonte: "MANUAL",
        crescimento: 100,
        atualizadoEm: "2026-09-16T10:00:00Z",
      },
      {
        situacao: "PENDENTE",
        seguidores: null,
        fonte: null,
        crescimento: null,
        atualizadoEm: null,
      },
    ]);
    expect(resumo).toMatchObject({
      total: 4,
      conectadas: 1,
      pendentes: 2,
      comErro: 1,
      seguidoresConsultados: 3000,
      contasConsultadas: 2,
      semDadosAutorizados: 2,
      crescimentoTotal: 150,
      contasComCrescimento: 2,
      ultimaAtualizacao: "2026-09-16T10:00:00Z",
    });
  });
});

describe("período", () => {
  it("últimos N dias ou datas escolhidas no horário de Brasília", () => {
    const agora = new Date("2026-09-17T12:00:00Z");
    expect(intervaloDoPeriodo({ dias: 30 }, agora).inicio.toISOString()).toBe(
      "2026-08-18T12:00:00.000Z",
    );
    const p = intervaloDoPeriodo({ de: "2026-09-01", ate: "2026-09-16" });
    expect(p.inicio.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(p.fim.toISOString()).toBe("2026-09-17T02:59:59.000Z");
  });
});
