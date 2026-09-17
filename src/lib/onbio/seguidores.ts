/**
 * ONBIO — regras puras do acompanhamento de seguidores.
 *
 * Nada aqui toca rede ou banco: situação da integração, variação, crescimento no período
 * e totais do painel. A regra que atravessa tudo é **não tratar ausência como zero**:
 * uma afiliada sem número fica fora da soma e aparece como "sem dados", e uma variação
 * sobre base zero ou inexistente não tem percentual.
 */

export type SituacaoIntegracao = "CONECTADO" | "PENDENTE" | "ERRO";

export const ROTULO_SITUACAO: Record<SituacaoIntegracao, string> = {
  CONECTADO: "Conectado",
  PENDENTE: "Pendente",
  ERRO: "Erro",
};

export type Fonte = "META_API" | "MANUAL" | "SCREENSHOT" | "INTERNAL";

export const ROTULO_FONTE: Record<Fonte, string> = {
  META_API: "Consulta oficial (Meta)",
  MANUAL: "Informado manualmente",
  SCREENSHOT: "Conferido por print",
  INTERNAL: "Registro interno",
};

/** Sem conexão ativa é Pendente; conexão cuja última consulta falhou é Erro. */
export function situacaoDaIntegracao(
  conexao: { ultimoErro: string | null } | null | undefined,
): SituacaoIntegracao {
  if (!conexao) return "PENDENTE";
  return conexao.ultimoErro ? "ERRO" : "CONECTADO";
}

export type Variacao = { absoluta: number | null; percentual: number | null };

/**
 * Atual − anterior e ((atual − anterior) ÷ anterior) × 100, com uma casa.
 * Sem um dos dois números não há variação; com anterior zero há diferença, mas não
 * percentual (divisão por zero não é "infinito por cento").
 */
export function variacao(
  anterior: number | null | undefined,
  atual: number | null | undefined,
): Variacao {
  if (anterior === null || anterior === undefined || atual === null || atual === undefined) {
    return { absoluta: null, percentual: null };
  }
  const absoluta = atual - anterior;
  if (anterior === 0) return { absoluta, percentual: null };
  return { absoluta, percentual: Math.round((absoluta / anterior) * 1000) / 10 };
}

export type Registro = {
  capturedAt: string;
  followers: number | null;
  source: Fonte;
};

export type LinhaDoHistorico = {
  data: string;
  anterior: number | null;
  atual: number;
  fonte: Fonte;
} & Variacao;

/** Histórico com a comparação de cada registro com o anterior, mais recente primeiro. */
export function historicoDeCrescimento(registros: Registro[]): LinhaDoHistorico[] {
  const validos = ordenar(registros).filter(
    (r): r is Registro & { followers: number } => r.followers !== null,
  );
  const linhas = validos.map((r, i) => {
    const anterior = i > 0 ? validos[i - 1]!.followers : null;
    return {
      data: r.capturedAt,
      anterior,
      atual: r.followers,
      fonte: r.source,
      ...variacao(anterior, r.followers),
    };
  });
  return linhas.reverse();
}

export type CrescimentoNoPeriodo = {
  inicio: number | null;
  atual: number | null;
  atualizadoEm: string | null;
  fonte: Fonte | null;
} & Variacao;

/**
 * Seguidores no início do período: o último registro até o início; se a afiliada entrou
 * depois, o primeiro registro dentro do período. Atual: o último registro até o fim.
 */
export function crescimentoNoPeriodo(
  registros: Registro[],
  inicio: Date,
  fim: Date,
): CrescimentoNoPeriodo {
  const validos = ordenar(registros).filter(
    (r): r is Registro & { followers: number } =>
      r.followers !== null && new Date(r.capturedAt) <= fim,
  );
  const antes = validos.filter((r) => new Date(r.capturedAt) <= inicio);
  const base =
    antes[antes.length - 1] ?? validos.find((r) => new Date(r.capturedAt) > inicio) ?? null;
  const ultimo = validos[validos.length - 1] ?? null;
  return {
    inicio: base?.followers ?? null,
    atual: ultimo?.followers ?? null,
    atualizadoEm: ultimo?.capturedAt ?? null,
    fonte: ultimo?.source ?? null,
    ...variacao(base?.followers, ultimo?.followers),
  };
}

export type AfiliadaNoPainel = {
  situacao: SituacaoIntegracao;
  seguidores: number | null;
  fonte: Fonte | null;
  crescimento: number | null;
  atualizadoEm: string | null;
};

export type ResumoDoPainel = {
  total: number;
  conectadas: number;
  pendentes: number;
  comErro: number;
  /** Só contas conectadas cujo número atual veio da Meta. */
  seguidoresConsultados: number;
  contasConsultadas: number;
  semDadosAutorizados: number;
  crescimentoTotal: number;
  contasComCrescimento: number;
  ultimaAtualizacao: string | null;
};

export function resumoDoPainel(afiliadas: AfiliadaNoPainel[]): ResumoDoPainel {
  const consultadas = afiliadas.filter(
    (a) => a.situacao !== "PENDENTE" && a.fonte === "META_API" && a.seguidores !== null,
  );
  const comCrescimento = afiliadas.filter((a) => a.crescimento !== null);
  const datas = afiliadas.map((a) => a.atualizadoEm).filter((d): d is string => d !== null);
  return {
    total: afiliadas.length,
    conectadas: afiliadas.filter((a) => a.situacao === "CONECTADO").length,
    pendentes: afiliadas.filter((a) => a.situacao === "PENDENTE").length,
    comErro: afiliadas.filter((a) => a.situacao === "ERRO").length,
    seguidoresConsultados: consultadas.reduce((soma, a) => soma + a.seguidores!, 0),
    contasConsultadas: consultadas.length,
    semDadosAutorizados: afiliadas.length - consultadas.length,
    crescimentoTotal: comCrescimento.reduce((soma, a) => soma + a.crescimento!, 0),
    contasComCrescimento: comCrescimento.length,
    ultimaAtualizacao: datas.length ? datas.sort().at(-1)! : null,
  };
}

/** Período por quantidade de dias até hoje, ou datas escolhidas (AAAA-MM-DD). */
export function intervaloDoPeriodo(
  periodo: { dias: number } | { de: string; ate: string },
  agora = new Date(),
): { inicio: Date; fim: Date } {
  if ("dias" in periodo) {
    return { inicio: new Date(agora.getTime() - periodo.dias * 86_400_000), fim: agora };
  }
  return {
    inicio: new Date(`${periodo.de}T00:00:00-03:00`),
    fim: new Date(`${periodo.ate}T23:59:59-03:00`),
  };
}

function ordenar(registros: Registro[]): Registro[] {
  return [...registros].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}
