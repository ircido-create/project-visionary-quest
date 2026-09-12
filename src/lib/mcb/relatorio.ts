/**
 * Fase 5 — Relatório de evolução: o que entra no documento, sem rede nem tela.
 *
 * O relatório existe para sair da plataforma: a gestora salva em PDF pelo navegador e
 * manda à candidata ou a quem avalia (decisão de 2026-09-12 — sem link público). Por
 * isso a página mostra uma lista fechada: identificação pública (nome, @, cidade),
 * números, requisitos e tarefas. Contato (e-mail, telefone), notas internas, leitura da
 * IA e prints de evidência não entram, mesmo estando nos dados que a página recebe.
 */

import type { RequirementResult } from "./qualification";

export type PontoEvolucao = {
  capturedAt: string;
  followers: number | null;
  posts: number | null;
  female: number | null;
};

export type Variacao = { inicio: number | null; atual: number | null; diferenca: number | null };

/**
 * Primeiro e último valor registrados de um indicador. A diferença só existe com dois
 * registros ou mais — com um só, "variação zero" seria afirmar o que não se mediu.
 */
export function variacao(
  pontos: PontoEvolucao[],
  campo: "followers" | "posts" | "female",
): Variacao {
  const valores = pontos.map((p) => p[campo]).filter((v): v is number => v !== null);
  const inicio = valores.length > 0 ? valores[0]! : null;
  const atual = valores.length > 0 ? valores[valores.length - 1]! : null;
  const diferenca = valores.length > 1 && inicio !== null && atual !== null ? atual - inicio : null;
  return { inicio, atual, diferenca };
}

const FUSO = "America/Sao_Paulo";

/** "2026-09-12T02:00:00Z" → "11/09/2026": a data de Brasília, não a de UTC. */
export function dataBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function diaMesBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

export function formatarNumero(valor: number | null, casas = 0): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Com sinal explícito: "+1.240", "−3", "0". Sem medida, "—". */
export function formatarDiferenca(valor: number | null, casas = 0): string {
  if (valor === null) return "—";
  if (valor === 0) return "0";
  const absoluto = formatarNumero(Math.abs(valor), casas);
  return valor > 0 ? `+${absoluto}` : `−${absoluto}`;
}

export const SITUACAO_REQUISITO: Record<RequirementResult["status"], string> = {
  PASS: "Cumprido",
  FAIL: "Não cumprido",
  UNKNOWN: "Sem dado",
  REVIEW: "Em revisão",
};

export type TarefaRelatorio = {
  title: string;
  status: string;
  completed_at: string | null;
};

/** Concluídas, da mais recente para a mais antiga. */
export function tarefasConcluidas<T extends TarefaRelatorio>(tarefas: T[]): T[] {
  return tarefas
    .filter((t) => t.status === "CONCLUIDA")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
}

export function contarAbertas(tarefas: TarefaRelatorio[]): number {
  return tarefas.filter((t) => t.status === "PENDENTE" || t.status === "EM_ANDAMENTO").length;
}

/** Pontos do gráfico de seguidores: só os registros que têm o número. */
export function pontosSeguidores(pontos: PontoEvolucao[]): { data: string; seguidores: number }[] {
  return pontos
    .filter((p): p is PontoEvolucao & { followers: number } => p.followers !== null)
    .map((p) => ({ data: diaMesBR(p.capturedAt), seguidores: p.followers }));
}
