/**
 * Pautas de reunião — o que é puro: formato da saída e montagem do resumo enviado à IA.
 *
 * A pauta muda com o programa. Na Ybera a conversa é sobre preparação do perfil,
 * requisitos e tarefas; na ONBIO, sobre resultado comercial e crescimento. O que não muda
 * é o formato: a gestora recebe sempre as mesmas seis seções, para a reunião ter a mesma
 * cara toda semana.
 */

export type Programa = "YBERA" | "ONBIO";
export type Escopo = "INDIVIDUAL" | "EQUIPE";

export const VERSAO_DO_PROMPT = "pauta-v1";

export type Pauta = {
  resumo_executivo: string;
  conquistas: string[];
  pontos_de_atencao: string[];
  perguntas: string[];
  decisoes_necessarias: string[];
  proximos_passos: string[];
};

export const SECOES: Array<{ chave: keyof Omit<Pauta, "resumo_executivo">; titulo: string }> = [
  { chave: "conquistas", titulo: "Conquistas" },
  { chave: "pontos_de_atencao", titulo: "Pontos de atenção" },
  { chave: "perguntas", titulo: "Perguntas para a conversa" },
  { chave: "decisoes_necessarias", titulo: "Decisões necessárias" },
  { chave: "proximos_passos", titulo: "Próximos passos" },
];

export const SCHEMA_DA_PAUTA = {
  type: "object",
  additionalProperties: false,
  properties: {
    resumo_executivo: { type: "string" },
    conquistas: { type: "array", items: { type: "string" } },
    pontos_de_atencao: { type: "array", items: { type: "string" } },
    perguntas: { type: "array", items: { type: "string" } },
    decisoes_necessarias: { type: "array", items: { type: "string" } },
    proximos_passos: { type: "array", items: { type: "string" } },
  },
  required: [
    "resumo_executivo",
    "conquistas",
    "pontos_de_atencao",
    "perguntas",
    "decisoes_necessarias",
    "proximos_passos",
  ],
} as const;

const COMUM =
  "Você prepara pautas de reunião para uma gestora que acompanha afiliadas. Escreva em português do Brasil, de forma direta e humana, na segunda pessoa quando falar com a gestora. " +
  "Use somente os dados recebidos: não invente números, nomes, metas ou fatos. Quando um dado faltar, diga que falta em vez de estimar. " +
  "Cada item é uma frase curta. No máximo cinco itens por seção, e menos quando não houver o que dizer.";

/** A instrução muda com o programa: são conversas diferentes. */
export function instrucaoDoSistema(programa: Programa, escopo: Escopo): string {
  const foco =
    programa === "ONBIO"
      ? "O programa é a ONBIO: a conversa é comercial — faturamento, pedidos, comissão, metas, campanhas e crescimento de audiência. Não existem requisitos de afiliação nem auditoria neste programa, então nunca fale em qualificação, aprovação ou nota de preparação."
      : "O programa é a Ybera: a conversa é sobre a preparação do perfil — requisitos de qualificação, evolução dos números, tarefas e etapa da jornada. Deixe claro que atender aos requisitos não garante aprovação em programas de terceiros.";
  const alvo =
    escopo === "EQUIPE"
      ? "A pauta é da reunião de equipe: fale do conjunto das afiliadas, dos destaques e de quem precisa de atenção, citando nomes apenas quando vierem nos dados."
      : "A pauta é da reunião individual com uma afiliada: fale do caso dela.";
  return `${COMUM} ${foco} ${alvo}`;
}

export function instrucaoDoUsuario(periodoEmDias: number, dados: unknown): string {
  return (
    `Prepare a pauta considerando os últimos ${periodoEmDias} dias. ` +
    `Estes são os dados disponíveis, em JSON: ${JSON.stringify(dados)}`
  );
}

/** Texto para colar no WhatsApp ou num documento, na ordem em que a reunião acontece. */
export function pautaEmTexto(pauta: Pauta, titulo: string): string {
  const linhas = [titulo, "", pauta.resumo_executivo];
  for (const secao of SECOES) {
    const itens = pauta[secao.chave];
    if (!itens?.length) continue;
    linhas.push("", `${secao.titulo}:`);
    for (const item of itens) linhas.push(`- ${item}`);
  }
  return linhas.join("\n");
}

/** Vazio em toda seção: a IA respondeu no formato, mas sem conteúdo aproveitável. */
export function pautaVazia(pauta: Pauta): boolean {
  return (
    pauta.resumo_executivo.trim() === "" &&
    SECOES.every((secao) => (pauta[secao.chave] ?? []).length === 0)
  );
}
