/**
 * Fase 9 — Avisos dentro do app: o que não depende de rede.
 *
 * Os avisos nascem em gatilhos do banco (migração `20260914130000_fase9_avisos`). Aqui
 * ficam o destino de cada tipo e o "há quanto tempo" do sininho.
 */

import { dataBR } from "./relatorio";

export type TipoDeAviso =
  "nova_candidatura" | "tarefa_concluida" | "pronta_auditoria" | "tarefa_nova" | "feedback_novo";

/** Os avisos da afiliada levam ao portal; os da gestora, à página da afiliada. */
export function avisoDaCandidata(tipo: string): boolean {
  return tipo === "tarefa_nova" || tipo === "feedback_novo";
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

export function haQuanto(iso: string, agora: Date = new Date()): string {
  const passou = agora.getTime() - Date.parse(iso);
  if (passou < MINUTO) return "agora";
  if (passou < HORA) return `há ${Math.floor(passou / MINUTO)} min`;
  if (passou < DIA) return `há ${Math.floor(passou / HORA)} h`;
  const dias = Math.floor(passou / DIA);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return dataBR(iso);
}

/** O número no sininho: até 9, depois "9+". */
export function contagemNoSino(naoLidos: number): string | null {
  if (naoLidos <= 0) return null;
  return naoLidos > 9 ? "9+" : String(naoLidos);
}
