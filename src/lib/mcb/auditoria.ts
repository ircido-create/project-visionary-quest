/**
 * Fase 5 — Fluxo de auditoria: as regras da decisão, sem rede nem banco.
 *
 * A etapa "Pronta para auditoria" é onde a gestora confere os requisitos antes de a
 * candidata seguir para a análise oficial. Até aqui ela só tinha um contador no painel,
 * e as candidatas paravam ali. As regras abaixo decidem o que cada decisão faz; quem
 * pode decidir é conferido no servidor (`auditoria.functions.ts`).
 *
 * APROVAR COM REQUISITO PENDENTE
 *
 * O método promete "auditoria dos requisitos com critérios explícitos". Aprovar com
 * requisito não cumprido é permitido — a gestora pode ter informação que o sistema não
 * tem —, mas exige justificativa e fica gravado como exceção, com autor e data. O que
 * não pode é uma exceção silenciosa.
 */

import { STATUS_LABELS, STATUS_ORDER, type InfluencerStatus } from "./labels";
import type { RequirementResult } from "./qualification";

export type DecisaoAuditoria = "APROVAR" | "DEVOLVER";

/** Valor gravado em `qualification_results.manual_decision`. */
export type RegistroDecisao = "APROVADA" | "APROVADA_COM_EXCECAO" | "DEVOLVIDA";

export const REGISTRO_LABELS: Record<RegistroDecisao, string> = {
  APROVADA: "Aprovada",
  APROVADA_COM_EXCECAO: "Aprovada com exceção",
  DEVOLVIDA: "Devolvida",
};

export const ETAPA_EM_AUDITORIA: InfluencerStatus = "PRONTA_AUDITORIA";
export const ETAPA_APROVADA: InfluencerStatus = "QUALIFICADA";

/** Para onde a candidata pode voltar. Nunca para frente, nem para fora da jornada. */
export const ETAPAS_DE_DEVOLUCAO: InfluencerStatus[] = [
  "AGUARDANDO_EVIDENCIAS",
  "EM_ESTRUTURACAO",
  "EM_PRODUCAO",
  "EM_CRESCIMENTO",
];
export const ETAPA_DEVOLUCAO_PADRAO: InfluencerStatus = "EM_CRESCIMENTO";

/** Justificativa e motivo precisam dizer alguma coisa: "ok" não documenta decisão. */
export const NOTA_MINIMA = 10;

export type ResultadoValidacao =
  | {
      ok: true;
      registro: RegistroDecisao;
      proximaEtapa: InfluencerStatus;
      pendentes: RequirementResult[];
    }
  | { ok: false; erro: string };

export function requisitosPendentes(requisitos: RequirementResult[]): RequirementResult[] {
  return requisitos.filter((r) => r.status !== "PASS");
}

export function validarDecisao(entrada: {
  etapaAtual: InfluencerStatus;
  decisao: DecisaoAuditoria;
  nota: string;
  etapaDevolucao?: InfluencerStatus | null | undefined;
  requisitos: RequirementResult[];
}): ResultadoValidacao {
  if (entrada.etapaAtual !== ETAPA_EM_AUDITORIA) {
    return {
      ok: false,
      erro: `A auditoria só vale para candidatas em "${STATUS_LABELS[ETAPA_EM_AUDITORIA]}". Esta está em "${STATUS_LABELS[entrada.etapaAtual]}".`,
    };
  }

  const nota = entrada.nota.trim();
  const pendentes = requisitosPendentes(entrada.requisitos);

  if (entrada.decisao === "APROVAR") {
    if (pendentes.length === 0) {
      return { ok: true, registro: "APROVADA", proximaEtapa: ETAPA_APROVADA, pendentes };
    }
    if (nota.length < NOTA_MINIMA) {
      return {
        ok: false,
        erro: `Há ${pendentes.length} requisito(s) não cumprido(s). Aprovar mesmo assim exige uma justificativa de pelo menos ${NOTA_MINIMA} caracteres, que fica registrada como exceção.`,
      };
    }
    return { ok: true, registro: "APROVADA_COM_EXCECAO", proximaEtapa: ETAPA_APROVADA, pendentes };
  }

  if (nota.length < NOTA_MINIMA) {
    return {
      ok: false,
      erro: `Devolver exige o motivo, com pelo menos ${NOTA_MINIMA} caracteres: ele vira a tarefa da candidata.`,
    };
  }
  const destino = entrada.etapaDevolucao ?? ETAPA_DEVOLUCAO_PADRAO;
  if (!ETAPAS_DE_DEVOLUCAO.includes(destino)) {
    return { ok: false, erro: "Essa etapa não é um destino válido para devolução." };
  }
  return { ok: true, registro: "DEVOLVIDA", proximaEtapa: destino, pendentes };
}

/** O motivo da devolução vira o título da tarefa — curto, numa linha só. */
export function tituloTarefaDevolucao(nota: string): string {
  const base = `Pendências da auditoria: ${nota.trim().replace(/\s+/g, " ")}`;
  return base.length > 120 ? `${base.slice(0, 117)}...` : base;
}

/**
 * Etapas que só se alcançam pela auditoria, ou depois dela. Decisão de produto de
 * 2026-09-12: sem isto, o seletor comum de etapa levava uma candidata direto para
 * "Qualificada" ou "Aprovada" sem auditoria e sem justificativa — e a auditoria virava
 * um caminho opcional, sem garantia de que o registro de "quem aprovou" exista.
 */
export const ETAPAS_DEPOIS_DA_AUDITORIA: InfluencerStatus[] = [
  "QUALIFICADA",
  "ENVIADA_ANALISE",
  "APROVADA",
  "NAO_APROVADA",
];

/**
 * Por que o seletor comum não pode fazer esta mudança, ou `null` se pode.
 *
 * - "Qualificada" só pelo formulário de auditoria.
 * - "Enviada para análise", "Aprovada" e "Não aprovada" só para quem já está em
 *   "Qualificada" ou depois.
 * - Todo o resto continua livre: as etapas de antes (inclusive voltar para elas),
 *   "Pausada" e "Arquivada".
 */
export function motivoBloqueioSeletor(de: InfluencerStatus, para: InfluencerStatus): string | null {
  if (de === para) return null;
  const jaAuditada = ETAPAS_DEPOIS_DA_AUDITORIA.includes(de);
  if (para === ETAPA_APROVADA && !jaAuditada) {
    return `Para chegar a "${STATUS_LABELS[ETAPA_APROVADA]}", use a auditoria na página da candidata: é ela que registra quem aprovou e com base em quê.`;
  }
  if (ETAPAS_DEPOIS_DA_AUDITORIA.includes(para) && !jaAuditada) {
    return `"${STATUS_LABELS[para]}" só vale para candidatas que já passaram pela auditoria.`;
  }
  return null;
}

/** As etapas que o seletor comum oferece a partir da etapa atual. */
export function etapasPermitidasNoSeletor(de: InfluencerStatus): InfluencerStatus[] {
  return STATUS_ORDER.filter((para) => motivoBloqueioSeletor(de, para) === null);
}
