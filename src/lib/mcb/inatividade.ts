/**
 * Fase 6 — Exclusão por inatividade: os números da regra, sem rede nem banco.
 *
 * Decisão de 2026-09-13 (Política de Privacidade, P5): inscrição sem nenhuma atividade
 * por 90 dias tem os dados excluídos pela limpeza diária do banco
 * (`limpar_candidatas_inativas`, migração `20260913140000_fase6_inatividade_90_dias`). A
 * gestora vê o aviso no painel nos 15 dias anteriores. O que conta como atividade está na
 * função `ultima_atividade_candidata` da mesma migração.
 */

export const DIAS_PARA_EXCLUSAO = 90;
export const DIAS_DE_AVISO = 15;

const DIA_EM_MS = 86_400_000;

export function diasSemAtividade(ultimaAtividade: string, agora: Date = new Date()): number {
  return Math.max(0, Math.floor((agora.getTime() - Date.parse(ultimaAtividade)) / DIA_EM_MS));
}

/** O dia em que a limpeza passa a excluir, se nada acontecer até lá. */
export function dataDaExclusao(ultimaAtividade: string): string {
  return new Date(Date.parse(ultimaAtividade) + DIAS_PARA_EXCLUSAO * DIA_EM_MS).toISOString();
}

export function diasAteExclusao(ultimaAtividade: string, agora: Date = new Date()): number {
  return Math.max(0, DIAS_PARA_EXCLUSAO - diasSemAtividade(ultimaAtividade, agora));
}
