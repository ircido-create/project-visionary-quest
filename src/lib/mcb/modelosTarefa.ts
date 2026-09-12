/**
 * Fase 5 — Modelos de tarefa por nível: as regras, sem rede nem banco.
 *
 * Cada ambiente mantém uma biblioteca de tarefas por nível da jornada. Na página da
 * candidata aparecem, como sugestão, as tarefas do nível em que ela está e que ela ainda
 * não tem — e a gestora escolhe quais criar. Nada é criado sozinho: a gestora conhece a
 * candidata, o modelo não.
 *
 * Os modelos são de cada ambiente (decisão de 2026-09-12). Quem edita a biblioteca é
 * conferido no servidor (`modelosTarefa.functions.ts`).
 */

import { LEVELS } from "./qualification";

export type Prioridade = "BAIXA" | "MEDIA" | "ALTA";

export const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

/** Os níveis na ordem da jornada — os mesmos que a qualificação calcula. */
export const NIVEIS: readonly string[] = [
  LEVELS.ONE,
  LEVELS.TWO,
  LEVELS.THREE,
  LEVELS.AUDIT,
  LEVELS.QUALIFIED,
];
export const NIVEL_INICIAL: string = LEVELS.ONE;

/** O mesmo limite do `check` no banco. */
export const PRAZO_MAXIMO_DIAS = 90;

/** Chave do cache da biblioteca: Configurações e a página da candidata usam a mesma. */
export const chaveModelosTarefa = (tenantId: string) => ["mcb", "modelos-tarefa", tenantId];

export type ModeloTarefa = {
  id: string;
  level: string;
  title: string;
  description: string | null;
  due_in_days: number | null;
  priority: Prioridade;
  sort_order: number;
};

export type TarefaExistente = { title: string; template_id: string | null };

export function normalizarTitulo(titulo: string): string {
  return titulo.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/**
 * Os modelos que a candidata ainda não tem como tarefa.
 *
 * "Já tem" vale para qualquer situação da tarefa, concluída ou cancelada inclusive:
 * sugerir de novo o que a gestora cancelou seria insistir. Tarefas criadas à mão, antes
 * dos modelos, contam pelo título.
 */
export function modelosQueFaltam(
  modelos: ModeloTarefa[],
  tarefas: TarefaExistente[],
): ModeloTarefa[] {
  const vinculados = new Set(tarefas.map((t) => t.template_id).filter(Boolean));
  const titulos = new Set(tarefas.map((t) => normalizarTitulo(t.title)));
  return modelos
    .filter((m) => !vinculados.has(m.id) && !titulos.has(normalizarTitulo(m.title)))
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "pt-BR"));
}

export function sugestoesParaNivel(
  nivel: string,
  modelos: ModeloTarefa[],
  tarefas: TarefaExistente[],
): ModeloTarefa[] {
  return modelosQueFaltam(
    modelos.filter((m) => m.level === nivel),
    tarefas,
  );
}

/** A data de hoje no horário de Brasília. O servidor roda em UTC: às 22h daqui já é amanhã lá. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

export function somarDias(data: string, dias: number): string {
  const [ano = 0, mes = 1, dia = 1] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export function prazoDoModelo(dias: number | null, agora: Date = new Date()): string | null {
  return dias === null ? null : somarDias(hojeEmBrasilia(agora), dias);
}

export function descreverPrazo(dias: number | null): string {
  if (dias === null) return "sem prazo";
  if (dias === 0) return "prazo no mesmo dia";
  return dias === 1 ? "prazo de 1 dia" : `prazo de ${dias} dias`;
}

export type ModeloInicial = {
  level: string;
  title: string;
  description: string;
  dueInDays: number;
  priority: Prioridade;
};

/**
 * Conjunto inicial oferecido quando a biblioteca de um ambiente está vazia — a gestora
 * carrega com um clique e ajusta depois. Escrito a partir das etapas do método
 * (Estruture, Apareça, Conecte, Cresça, Qualifique), dos pilares Atrair, Conectar e
 * Ensinar e dos requisitos da análise. Rascunho de 2026-09-12, a revisar com a dona da
 * plataforma.
 */
export const CONJUNTO_INICIAL: ModeloInicial[] = [
  {
    level: LEVELS.ONE,
    title: "Definir o nicho em uma frase",
    description:
      "Para quem ela fala e sobre o quê. Ex.: “maternidade real para mães de primeira viagem”.",
    dueInDays: 7,
    priority: "ALTA",
  },
  {
    level: LEVELS.ONE,
    title: "Reescrever a bio com o nicho",
    description: "Quem ela é, para quem fala e o que a seguidora encontra no perfil.",
    dueInDays: 7,
    priority: "ALTA",
  },
  {
    level: LEVELS.ONE,
    title: "Mudar para conta de criadora de conteúdo",
    description: "Configurações do Instagram → Tipo de conta. É requisito da análise.",
    dueInDays: 3,
    priority: "ALTA",
  },
  {
    level: LEVELS.ONE,
    title: "Organizar os destaques",
    description: "Capas no mesmo estilo e destaques que apresentem o nicho.",
    dueInDays: 14,
    priority: "MEDIA",
  },
  {
    level: LEVELS.ONE,
    title: "Enviar print dos Insights",
    description: "Visão geral, seguidores e público por gênero, para conferir os números.",
    dueInDays: 7,
    priority: "MEDIA",
  },
  {
    level: LEVELS.TWO,
    title: "Montar o calendário da semana pelos três pilares",
    description: "Pelo menos um conteúdo de Atrair, um de Conectar e um de Ensinar.",
    dueInDays: 7,
    priority: "ALTA",
  },
  {
    level: LEVELS.TWO,
    title: "Publicar stories todos os dias por uma semana",
    description:
      "Rotina, bastidores e conversa com quem assiste. Constância antes de produção caprichada.",
    dueInDays: 7,
    priority: "MEDIA",
  },
  {
    level: LEVELS.TWO,
    title: "Publicar 3 Reels, um por pilar",
    description: "Um de Atrair, um de Conectar e um de Ensinar.",
    dueInDays: 14,
    priority: "ALTA",
  },
  {
    level: LEVELS.TWO,
    title: "Chegar a 12 publicações nos últimos 6 meses",
    description: "Requisito da análise: conferir quantas faltam e distribuir no calendário.",
    dueInDays: 30,
    priority: "MEDIA",
  },
  {
    level: LEVELS.THREE,
    title: "Responder comentários e mensagens no mesmo dia",
    description: "Conversa real cria vínculo, e é o que faz o público voltar.",
    dueInDays: 7,
    priority: "MEDIA",
  },
  {
    level: LEVELS.THREE,
    title: "Fazer uma caixinha de perguntas por semana",
    description: "Usar as respostas como pauta de conteúdo.",
    dueInDays: 7,
    priority: "BAIXA",
  },
  {
    level: LEVELS.THREE,
    title: "Conferir o público feminino nos Insights",
    description:
      "A análise exige mais de 50%. Se estiver abaixo, rever temas e linguagem com a gestora.",
    dueInDays: 14,
    priority: "ALTA",
  },
  {
    level: LEVELS.THREE,
    title: "Passar de 30 publicações no feed",
    description: "Requisito da análise: 31 ou mais.",
    dueInDays: 30,
    priority: "MEDIA",
  },
  {
    level: LEVELS.THREE,
    title: "Chegar a 500 seguidores",
    description:
      "Requisito da análise. Revisar com a gestora o que mais trouxe seguidoras no último mês.",
    dueInDays: 60,
    priority: "MEDIA",
  },
  {
    level: LEVELS.AUDIT,
    title: "Enviar prints atualizados dos Insights",
    description:
      "Seguidores, público por gênero e publicações recentes, com a data visível. São as evidências da auditoria.",
    dueInDays: 3,
    priority: "ALTA",
  },
  {
    level: LEVELS.AUDIT,
    title: "Revisar o perfil antes da auditoria",
    description: "Bio, destaques e as 12 publicações mais recentes coerentes com o nicho.",
    dueInDays: 5,
    priority: "MEDIA",
  },
  {
    level: LEVELS.QUALIFIED,
    title: "Selecionar os melhores conteúdos",
    description: "Os que melhor mostram o nicho e a conexão com o público.",
    dueInDays: 7,
    priority: "MEDIA",
  },
  {
    level: LEVELS.QUALIFIED,
    title: "Preparar o material para a análise oficial",
    description: "Organizar destaques, bio e prints finais para o envio.",
    dueInDays: 7,
    priority: "ALTA",
  },
];
