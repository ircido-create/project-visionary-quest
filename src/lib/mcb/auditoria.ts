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

import { STATUS_LABELS, type InfluencerStatus } from "./labels";
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
