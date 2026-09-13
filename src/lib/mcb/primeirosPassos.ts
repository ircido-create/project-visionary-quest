/**
 * Fase 6 — Primeiros passos da gestora nova: as regras, sem rede nem tela.
 *
 * O roteiro aparece no painel para a dona e a administradora de um ambiente real. Cada
 * passo é marcado a partir do que já existe no banco — não há tabela de progresso para
 * ficar desatualizada. Some quando os passos obrigatórios estão feitos, ou quando a
 * gestora escolhe ocultar.
 */

export type EstadoDoAmbiente = {
  paginaAjustada: boolean;
  modelosCarregados: boolean;
  primeiraCandidata: boolean;
  equipeConvidada: boolean;
};

export type Passo = {
  chave: keyof EstadoDoAmbiente;
  titulo: string;
  descricao: string;
  opcional: boolean;
  feito: boolean;
};

const PASSOS: Array<Omit<Passo, "feito">> = [
  {
    chave: "paginaAjustada",
    titulo: "Ajustar sua página de candidatura",
    descricao: "Seu nome, sua bio e o texto que a candidata lê antes de se inscrever.",
    opcional: false,
  },
  {
    chave: "modelosCarregados",
    titulo: "Carregar os modelos de tarefa",
    descricao: "O conjunto inicial do método, para sugerir as tarefas de cada nível.",
    opcional: false,
  },
  {
    chave: "primeiraCandidata",
    titulo: "Receber a primeira candidatura",
    descricao: "Compartilhe o link da sua página com quem você acompanha.",
    opcional: false,
  },
  {
    chave: "equipeConvidada",
    titulo: "Convidar alguém da equipe",
    descricao: "Se mais alguém acompanha as candidatas com você.",
    opcional: true,
  },
];

export function montarPassos(estado: EstadoDoAmbiente): Passo[] {
  return PASSOS.map((p) => ({ ...p, feito: estado[p.chave] }));
}

/** Os passos obrigatórios feitos; o opcional não segura o roteiro na tela. */
export function roteiroConcluido(passos: Passo[]): boolean {
  return passos.every((p) => p.opcional || p.feito);
}

export function progresso(passos: Passo[]): { feitos: number; total: number } {
  const obrigatorios = passos.filter((p) => !p.opcional);
  return { feitos: obrigatorios.filter((p) => p.feito).length, total: obrigatorios.length };
}

/**
 * Ao criar o ambiente, a marca é gravada no mesmo segundo, com o texto padrão. Salvar a
 * página depois deixa `updated_at` bem à frente da criação — é isso que conta como
 * "ajustada", sem depender de a gestora ler o log de auditoria.
 */
export const MARGEM_DA_CRIACAO_SEGUNDOS = 60;

export function paginaFoiAjustada(
  ambienteCriadoEm: string,
  marcaAtualizadaEm: string | null,
): boolean {
  if (!marcaAtualizadaEm) return false;
  const diferenca = (Date.parse(marcaAtualizadaEm) - Date.parse(ambienteCriadoEm)) / 1000;
  return diferenca > MARGEM_DA_CRIACAO_SEGUNDOS;
}

export function linkDeCandidatura(origem: string, slug: string): string {
  return `${origem.replace(/\/+$/, "")}/g/${slug}`;
}
