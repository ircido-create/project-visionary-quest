import { describe, expect, it } from "vitest";

import {
  ETAPA_DEVOLUCAO_PADRAO,
  NOTA_MINIMA,
  etapasPermitidasNoSeletor,
  motivoBloqueioSeletor,
  tituloTarefaDevolucao,
  validarDecisao,
} from "./auditoria";
import type { RequirementResult } from "./qualification";

const requisito = (status: RequirementResult["status"], key = "followers"): RequirementResult => ({
  key,
  label: key,
  status,
  currentValue: 1,
  targetValue: 2,
  targetLabel: "2",
  gap: null,
  source: "MANUAL",
  updatedAt: null,
});

const todosCumpridos = [requisito("PASS", "a"), requisito("PASS", "b")];
const umPendente = [requisito("PASS", "a"), requisito("FAIL", "b")];
const justificativa = "Conferido pessoalmente com a candidata.";

describe("decisão de auditoria", () => {
  it("só vale para candidata em Pronta para auditoria", () => {
    const r = validarDecisao({
      etapaAtual: "EM_CRESCIMENTO",
      decisao: "APROVAR",
      nota: "",
      requisitos: todosCumpridos,
    });
    expect(r.ok).toBe(false);
  });

  it("aprova sem justificativa quando todos os requisitos estão cumpridos", () => {
    const r = validarDecisao({
      etapaAtual: "PRONTA_AUDITORIA",
      decisao: "APROVAR",
      nota: "",
      requisitos: todosCumpridos,
    });
    expect(r).toMatchObject({ ok: true, registro: "APROVADA", proximaEtapa: "QUALIFICADA" });
  });

  it("recusa aprovar com requisito pendente sem justificativa", () => {
    const r = validarDecisao({
      etapaAtual: "PRONTA_AUDITORIA",
      decisao: "APROVAR",
      nota: "ok",
      requisitos: umPendente,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/justificativa/);
  });

  it("aprova com requisito pendente como exceção, quando justificado", () => {
    const r = validarDecisao({
      etapaAtual: "PRONTA_AUDITORIA",
      decisao: "APROVAR",
      nota: justificativa,
      requisitos: umPendente,
    });
    expect(r).toMatchObject({ ok: true, registro: "APROVADA_COM_EXCECAO" });
    if (r.ok) expect(r.pendentes.map((p) => p.key)).toEqual(["b"]);
  });

  it("trata requisito sem dado como pendente, não como cumprido", () => {
    const r = validarDecisao({
      etapaAtual: "PRONTA_AUDITORIA",
      decisao: "APROVAR",
      nota: "",
      requisitos: [requisito("UNKNOWN")],
    });
    expect(r.ok).toBe(false);
  });

  it("não aceita justificativa feita só de espaços", () => {
    const r = validarDecisao({
      etapaAtual: "PRONTA_AUDITORIA",
      decisao: "APROVAR",
      nota: " ".repeat(NOTA_MINIMA + 5),
      requisitos: umPendente,
    });
    expect(r.ok).toBe(false);
  });

  it("exige motivo para devolver", () => {
    const r = validarDecisao({
      etapaAtual: "PRONTA_AUDITORIA",
      decisao: "DEVOLVER",
      nota: "",
      requisitos: umPendente,
    });
    expect(r.ok).toBe(false);
  });

  it("devolve para a etapa padrão quando nenhuma é escolhida", () => {
    const r = validarDecisao({
      etapaAtual: "PRONTA_AUDITORIA",
      decisao: "DEVOLVER",
      nota: justificativa,
      requisitos: umPendente,
    });
    expect(r).toMatchObject({
      ok: true,
      registro: "DEVOLVIDA",
      proximaEtapa: ETAPA_DEVOLUCAO_PADRAO,
    });
  });

  it("não devolve para frente na jornada", () => {
    const r = validarDecisao({
      etapaAtual: "PRONTA_AUDITORIA",
      decisao: "DEVOLVER",
      nota: justificativa,
      etapaDevolucao: "APROVADA",
      requisitos: umPendente,
    });
    expect(r.ok).toBe(false);
  });
});

describe("tarefa gerada pela devolução", () => {
  it("usa o motivo numa linha só", () => {
    expect(tituloTarefaDevolucao("  Falta o print\n do público  ")).toBe(
      "Pendências da auditoria: Falta o print do público",
    );
  });

  it("corta motivos longos em 120 caracteres", () => {
    const t = tituloTarefaDevolucao("x".repeat(300));
    expect(t.length).toBe(120);
    expect(t.endsWith("...")).toBe(true);
  });
});

describe("seletor comum de etapa", () => {
  it("não leva a Qualificada sem auditoria", () => {
    expect(motivoBloqueioSeletor("PRONTA_AUDITORIA", "QUALIFICADA")).toMatch(/auditoria/);
    expect(motivoBloqueioSeletor("EM_ESTRUTURACAO", "QUALIFICADA")).not.toBeNull();
  });

  it("não leva a Aprovada, Não aprovada ou Enviada antes da auditoria", () => {
    expect(motivoBloqueioSeletor("EM_CRESCIMENTO", "APROVADA")).not.toBeNull();
    expect(motivoBloqueioSeletor("EM_CRESCIMENTO", "NAO_APROVADA")).not.toBeNull();
    expect(motivoBloqueioSeletor("PRONTA_AUDITORIA", "ENVIADA_ANALISE")).not.toBeNull();
  });

  it("segue livre depois da auditoria", () => {
    expect(motivoBloqueioSeletor("QUALIFICADA", "ENVIADA_ANALISE")).toBeNull();
    expect(motivoBloqueioSeletor("ENVIADA_ANALISE", "APROVADA")).toBeNull();
    expect(motivoBloqueioSeletor("APROVADA", "NAO_APROVADA")).toBeNull();
  });

  it("deixa voltar para etapas de antes, pausar e arquivar", () => {
    expect(motivoBloqueioSeletor("QUALIFICADA", "EM_CRESCIMENTO")).toBeNull();
    expect(motivoBloqueioSeletor("EM_CRESCIMENTO", "PAUSADA")).toBeNull();
    expect(motivoBloqueioSeletor("APROVADA", "ARQUIVADA")).toBeNull();
    expect(motivoBloqueioSeletor("EM_CRESCIMENTO", "EM_CRESCIMENTO")).toBeNull();
  });

  it("não usa Pausada como atalho para Qualificada", () => {
    expect(motivoBloqueioSeletor("PAUSADA", "QUALIFICADA")).not.toBeNull();
  });

  it("oferece no seletor só o que é permitido", () => {
    const opcoes = etapasPermitidasNoSeletor("PRONTA_AUDITORIA");
    expect(opcoes).toContain("EM_CRESCIMENTO");
    expect(opcoes).toContain("PRONTA_AUDITORIA");
    expect(opcoes).not.toContain("QUALIFICADA");
    expect(opcoes).not.toContain("APROVADA");
  });
});
