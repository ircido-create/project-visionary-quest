// Rede de indicações da ONBIO: leitura da planilha de importação e montagem da árvore.
//
// Tudo aqui é puro (sem banco), para poder ser testado e usado no navegador e no servidor.

export type SituacaoMeta = "BATEU" | "NAO_BATEU" | "SEM_VENDAS";

/** Uma linha pronta para `onbio_importar_rede`. */
export type LinhaDeRede = {
  nome: string;
  email: string | null;
  indicada_por: string | null;
  vendas_centavos: number | null;
  pedidos: number | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  metas: Record<string, SituacaoMeta>;
};

export type LeituraDaPlanilha = {
  linhas: LinhaDeRede[];
  erros: string[];
};

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Lê CSV com `;` ou `,` (o que aparecer mais na primeira linha), aspas e BOM. */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^\uFEFF/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const separador =
    (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (entreAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreAspas = true;
    } else if (c === separador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((v) => v.trim() !== ""));
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

/** "R$ 1.229,78", "1229,78", "1229.78" ou "1,229.78" → centavos. Vazio → null. */
export function lerDinheiro(valor: string): number | null {
  let v = valor.replace(/R\$|\s/g, "").trim();
  if (v === "" || v === "-") return null;
  const ultimaVirgula = v.lastIndexOf(",");
  const ultimoPonto = v.lastIndexOf(".");
  if (ultimaVirgula > ultimoPonto) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else {
    v = v.replace(/,/g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(v)) return NaN;
  return Math.round(Number(v) * 100);
}

/** "31/10/2026" ou "2026-10-31" → "2026-10-31". Vazio → null. */
export function lerData(valor: string): string | null {
  const v = valor.trim();
  if (v === "") return null;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return dataValida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return dataValida(Number(m[3]), Number(m[2]), Number(m[1]));
  return "invalida";
}

function dataValida(ano: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return "invalida";
  }
  return d.toISOString().slice(0, 10);
}

const SITUACOES: Record<string, SituacaoMeta> = {
  bateu: "BATEU",
  "bateu a meta": "BATEU",
  "nao bateu": "NAO_BATEU",
  "nao bateu a meta": "NAO_BATEU",
  "sem vendas": "SEM_VENDAS",
  "sem vendas no mes": "SEM_VENDAS",
  "sem venda": "SEM_VENDAS",
};

export function chaveDoTexto(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function lerSituacao(valor: string): SituacaoMeta | null | "invalida" {
  const chave = chaveDoTexto(valor);
  if (chave === "") return null;
  return SITUACOES[chave] ?? "invalida";
}

// ---------------------------------------------------------------------------
// Planilha
// ---------------------------------------------------------------------------

const COLUNAS = {
  nome: ["nome", "afiliado", "afiliada"],
  email: ["email", "e-mail"],
  indicada_por: [
    "indicada por",
    "indicado por",
    "indicada_por",
    "1º geracao",
    "1o geracao",
    "1 geracao",
  ],
  vendas: ["vendas", "total vendas", "valor", "faturamento"],
  pedidos: ["pedidos"],
  periodo_inicio: ["periodo inicio", "periodo_inicio", "inicio"],
  periodo_fim: ["periodo fim", "periodo_fim", "fim"],
} as const;

/** Cabeçalho de meta: "meta 2026-04", "meta_2026-04" ou "meta 04/2026". */
function mesDaColunaDeMeta(cabecalho: string): string | null {
  const c = chaveDoTexto(cabecalho).replace(/_/g, " ");
  let m = c.match(/^meta (\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${(m[2] ?? "").padStart(2, "0")}-01`;
  m = c.match(/^meta (\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${(m[1] ?? "").padStart(2, "0")}-01`;
  return null;
}

export function lerPlanilhaDeRede(texto: string): LeituraDaPlanilha {
  const tabela = lerCsv(texto);
  const erros: string[] = [];
  if (tabela.length < 2) {
    return { linhas: [], erros: ["A planilha está vazia ou só tem o cabeçalho."] };
  }

  const cabecalho = (tabela[0] ?? []).map((c) => chaveDoTexto(c).replace(/_/g, " "));
  const posicao = (nomes: readonly string[]) =>
    cabecalho.findIndex((c) => nomes.some((n) => c === n.replace(/_/g, " ")));
  const col = {
    nome: posicao(COLUNAS.nome),
    email: posicao(COLUNAS.email),
    indicada_por: posicao(COLUNAS.indicada_por),
    vendas: posicao(COLUNAS.vendas),
    pedidos: posicao(COLUNAS.pedidos),
    periodo_inicio: posicao(COLUNAS.periodo_inicio),
    periodo_fim: posicao(COLUNAS.periodo_fim),
  };
  if (col.nome < 0) {
    return { linhas: [], erros: ['Falta a coluna "nome".'] };
  }
  const metas = (tabela[0] ?? [])
    .map((c, i) => ({ i, mes: mesDaColunaDeMeta(c) }))
    .filter((m): m is { i: number; mes: string } => m.mes !== null);

  const celula = (linha: string[], i: number) => (i >= 0 ? (linha[i] ?? "").trim() : "");
  const vistas = new Set<string>();
  const indicadoras = new Map<string, string>();
  const linhas: LinhaDeRede[] = [];

  tabela.slice(1).forEach((linha, posicaoNaTabela) => {
    const numero = posicaoNaTabela + 2;
    const nome = celula(linha, col.nome).replace(/\s+/g, " ");
    if (nome === "" || chaveDoTexto(nome) === "total") return;
    if (nome.length < 3) {
      erros.push(`Linha ${numero}: nome muito curto.`);
      return;
    }
    const chave = chaveDoTexto(nome);

    const email = celula(linha, col.email).toLowerCase() || null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      erros.push(`Linha ${numero}: e-mail inválido (${email}).`);
    }
    const indicadaPor = celula(linha, col.indicada_por).replace(/\s+/g, " ") || null;
    if (indicadaPor && chaveDoTexto(indicadaPor) === chave) {
      erros.push(`Linha ${numero}: ${nome} não pode ter sido indicada por ela mesma.`);
    }

    const vendas = lerDinheiro(celula(linha, col.vendas));
    if (Number.isNaN(vendas)) erros.push(`Linha ${numero}: valor de vendas ilegível.`);
    const pedidosTexto = celula(linha, col.pedidos);
    const pedidos = pedidosTexto === "" ? null : Number(pedidosTexto);
    if (pedidos !== null && (!Number.isInteger(pedidos) || pedidos < 0)) {
      erros.push(`Linha ${numero}: número de pedidos ilegível.`);
    }
    const inicio = lerData(celula(linha, col.periodo_inicio));
    const fim = lerData(celula(linha, col.periodo_fim));
    if (inicio === "invalida" || fim === "invalida") {
      erros.push(`Linha ${numero}: data ilegível (use dd/mm/aaaa).`);
    } else if ((vendas !== null || pedidos !== null) && (!inicio || !fim)) {
      erros.push(`Linha ${numero}: informe o início e o fim do período das vendas.`);
    } else if (inicio && fim && fim < inicio) {
      erros.push(`Linha ${numero}: o fim do período vem antes do início.`);
    }

    // A mesma pessoa pode aparecer uma vez por período (planilha mês a mês), sempre com a
    // mesma indicadora.
    const chaveDaLinha = `${chave}|${inicio ?? ""}|${fim ?? ""}`;
    if (vistas.has(chaveDaLinha)) {
      erros.push(`Linha ${numero}: ${nome} aparece mais de uma vez no mesmo período.`);
      return;
    }
    vistas.add(chaveDaLinha);
    const indicadoraAnterior = indicadoras.get(chave);
    if (
      indicadoraAnterior !== undefined &&
      indicadoraAnterior !== chaveDoTexto(indicadaPor ?? "")
    ) {
      erros.push(`Linha ${numero}: ${nome} aparece com indicadoras diferentes.`);
    }
    if (indicadaPor || indicadoraAnterior === undefined) {
      indicadoras.set(chave, chaveDoTexto(indicadaPor ?? ""));
    }

    const situacoes: Record<string, SituacaoMeta> = {};
    for (const { i, mes } of metas) {
      const s = lerSituacao(celula(linha, i));
      if (s === "invalida") {
        erros.push(
          `Linha ${numero}: situação de meta ilegível em ${mes.slice(0, 7)} (use Bateu, Não bateu ou Sem vendas).`,
        );
      } else if (s) {
        situacoes[mes] = s;
      }
    }

    linhas.push({
      nome,
      email,
      indicada_por: indicadaPor,
      vendas_centavos: vendas,
      pedidos,
      periodo_inicio: inicio === "invalida" ? null : inicio,
      periodo_fim: fim === "invalida" ? null : fim,
      metas: situacoes,
    });
  });

  if (linhas.length > 2000) erros.push("Máximo de 2.000 linhas por importação.");
  return { linhas, erros };
}

// ---------------------------------------------------------------------------
// Árvore
// ---------------------------------------------------------------------------

export type PessoaDaRede = {
  id: string;
  nome: string;
  indicadaPor: string | null;
};

export type ResultadoDaRede = {
  influencerId: string;
  centavos: number;
  pedidos: number;
  /** "AAAA-MM" quando o resultado é de um mês só. */
  mes?: string | null;
};
export type MetaDaRede = { influencerId: string; mes: string; situacao: SituacaoMeta };

export type SituacaoDeVendas =
  "ULTIMO_MES" | "HA_2_MESES" | "HA_3_MESES" | "HA_MAIS_DE_3_MESES" | "NUNCA" | "SEM_DADOS";

export type NoDaRede = {
  id: string;
  nome: string;
  indicadaPor: string | null;
  /** 0 para quem está no topo; 1 para quem foi indicada pelo topo, e assim por diante. */
  nivel: number;
  indicadas: NoDaRede[];
  vendasCentavos: number;
  pedidos: number;
  /** Soma das vendas das indicadas diretas, como o painel da ONBIO mostra por equipe. */
  vendasDaEquipeCentavos: number;
  /** Todas as pessoas abaixo, em qualquer geração. */
  tamanhoDaRede: number;
  papel: "TOPO" | "GESTORA" | "AFILIADA";
  metas: Record<string, SituacaoMeta>;
  situacaoDeVendas: SituacaoDeVendas;
};

export type ResumoDaRede = {
  raizes: NoDaRede[];
  nos: Map<string, NoDaRede>;
  meses: string[];
  gestoras: number;
  afiliadas: number;
  vendasCentavos: number;
  pedidos: number;
  porSituacao: Record<SituacaoDeVendas, number>;
};

function mesesEntre(de: string, ate: string): number {
  const [a1 = 0, m1 = 0] = de.split("-").map(Number);
  const [a2 = 0, m2 = 0] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/**
 * Monta a árvore. A referência para "vendeu no último mês" é o mês mais recente com meta
 * registrada (a data da planilha, não a de hoje), para que uma carga antiga não pareça
 * parada só porque o tempo passou. Como no painel, "último mês" inclui o mês de referência
 * e o anterior.
 */
export function montarRede(
  pessoas: PessoaDaRede[],
  resultados: ResultadoDaRede[],
  metas: MetaDaRede[],
): ResumoDaRede {
  const nos = new Map<string, NoDaRede>();
  for (const p of pessoas) {
    nos.set(p.id, {
      id: p.id,
      nome: p.nome,
      indicadaPor: p.indicadaPor,
      nivel: 0,
      indicadas: [],
      vendasCentavos: 0,
      pedidos: 0,
      vendasDaEquipeCentavos: 0,
      tamanhoDaRede: 0,
      papel: "AFILIADA",
      metas: {},
      situacaoDeVendas: "NUNCA",
    });
  }
  for (const r of resultados) {
    const no = nos.get(r.influencerId);
    if (!no) continue;
    no.vendasCentavos += r.centavos;
    no.pedidos += r.pedidos;
  }
  const meses = [...new Set(metas.map((m) => m.mes.slice(0, 7)))].sort();
  for (const m of metas) {
    const no = nos.get(m.influencerId);
    if (no) no.metas[m.mes.slice(0, 7)] = m.situacao;
  }

  const raizes: NoDaRede[] = [];
  for (const no of nos.values()) {
    const acima = no.indicadaPor ? nos.get(no.indicadaPor) : undefined;
    if (acima) acima.indicadas.push(no);
    else raizes.push(no);
  }
  const porNome = (a: NoDaRede, b: NoDaRede) => a.nome.localeCompare(b.nome, "pt-BR");

  const visitar = (no: NoDaRede, nivel: number, caminho: Set<string>): number => {
    no.nivel = nivel;
    no.indicadas.sort(porNome);
    caminho.add(no.id);
    let abaixo = 0;
    for (const filha of no.indicadas) {
      if (caminho.has(filha.id)) continue;
      abaixo += 1 + visitar(filha, nivel + 1, caminho);
    }
    caminho.delete(no.id);
    no.tamanhoDaRede = abaixo;
    no.vendasDaEquipeCentavos = no.indicadas.reduce((s, f) => s + f.vendasCentavos, 0);
    no.papel =
      nivel === 0 && no.indicadas.length > 0
        ? "TOPO"
        : no.indicadas.length > 0
          ? "GESTORA"
          : "AFILIADA";
    return abaixo;
  };
  raizes.sort(porNome).forEach((r) => visitar(r, 0, new Set()));

  const referencia = meses.at(-1);
  const porSituacao: Record<SituacaoDeVendas, number> = {
    ULTIMO_MES: 0,
    HA_2_MESES: 0,
    HA_3_MESES: 0,
    HA_MAIS_DE_3_MESES: 0,
    NUNCA: 0,
    SEM_DADOS: 0,
  };
  let gestoras = 0;
  let afiliadas = 0;
  let vendasCentavos = 0;
  let pedidos = 0;
  for (const no of nos.values()) {
    const comVenda = Object.entries(no.metas)
      .filter(([, s]) => s !== "SEM_VENDAS")
      .map(([mes]) => mes)
      .sort();
    const ultima = comVenda.at(-1);
    if (ultima && referencia) {
      const distancia = mesesEntre(ultima, referencia);
      no.situacaoDeVendas =
        distancia <= 1
          ? "ULTIMO_MES"
          : distancia === 2
            ? "HA_2_MESES"
            : distancia === 3
              ? "HA_3_MESES"
              : "HA_MAIS_DE_3_MESES";
    } else if (referencia && Object.keys(no.metas).length === 0) {
      // A planilha tem meses, mas nenhum para esta pessoa: não dá para dizer que nunca
      // vendeu. Acontece com quem entra só como indicadora.
      no.situacaoDeVendas = no.vendasCentavos > 0 ? "HA_MAIS_DE_3_MESES" : "SEM_DADOS";
    } else if (!referencia && no.vendasCentavos > 0) {
      // Sem metas mensais não há como datar a última venda: conta como quem vendeu.
      no.situacaoDeVendas = "ULTIMO_MES";
    }
    // O topo da rede não entra nas contagens, como no painel.
    if (no.papel === "TOPO") continue;
    porSituacao[no.situacaoDeVendas] += 1;
    if (no.papel === "GESTORA") gestoras += 1;
    else afiliadas += 1;
    vendasCentavos += no.vendasCentavos;
    pedidos += no.pedidos;
  }

  return { raizes, nos, meses, gestoras, afiliadas, vendasCentavos, pedidos, porSituacao };
}

export const ROTULO_SITUACAO_DE_VENDAS: Record<SituacaoDeVendas, string> = {
  ULTIMO_MES: "Vendeu no último mês",
  HA_2_MESES: "Vendeu há 2 meses",
  HA_3_MESES: "Vendeu há 3 meses",
  HA_MAIS_DE_3_MESES: "Vendeu há mais de 3 meses",
  NUNCA: "Nunca vendeu",
  SEM_DADOS: "Sem dados mensais",
};

export const ROTULO_META: Record<SituacaoMeta, string> = {
  BATEU: "Bateu a meta",
  NAO_BATEU: "Não bateu a meta",
  SEM_VENDAS: "Sem vendas no mês",
};

export function emailPendente(email: string | null | undefined): boolean {
  return !!email && email.endsWith("@importacao.invalid");
}

// ---------------------------------------------------------------------------
// Comissões por nível
// ---------------------------------------------------------------------------

/**
 * Percentuais do sistema da ONBIO, na ordem: venda própria (afiliada), 1º nível acima
 * (gestora), 2º (supervisora), 3º (embaixadora), 4º (diretora executiva) e 5º. A ONBIO
 * não paga o 5º nível; a posição existe para o ambiente que quiser usar.
 */
export const COMISSAO_PADRAO: readonly number[] = [15, 5, 2.5, 1.5, 1, 0];
export const NIVEIS_DE_COMISSAO = 5;

export type ComissaoDaPessoa = {
  /** Comissão sobre as próprias vendas. */
  propriaCentavos: number;
  /** Índice 0 = 1º nível abaixo (indicadas diretas), 1 = 2º nível, e assim por diante. */
  porNivelCentavos: number[];
  /** Soma do que vem da rede abaixo. */
  redeCentavos: number;
  totalCentavos: number;
};

export type ResumoDeComissoes = {
  porPessoa: Map<string, ComissaoDaPessoa>;
  totalCentavos: number;
  /** Percentual da venda que vira comissão quando a cadeia acima está completa. */
  percentualMaximo: number;
};

export function percentuaisValidos(p: readonly number[]): boolean {
  return (
    p.length === NIVEIS_DE_COMISSAO + 1 &&
    p.every((v) => Number.isFinite(v) && v >= 0 && v <= 100) &&
    p.reduce((s, v) => s + v, 0) <= 100
  );
}

/**
 * Distribui a comissão de cada venda: a vendedora recebe o percentual da posição 0 e quem
 * está acima recebe o da posição do nível. Quem fica acima do 5º nível não recebe. Os
 * valores são acumulados sem arredondar e arredondados uma vez por pessoa e nível, para a
 * soma não perder centavos em redes grandes.
 */
export function calcularComissoes(
  rede: ResumoDaRede,
  percentuais: readonly number[] = COMISSAO_PADRAO,
): ResumoDeComissoes {
  const p = percentuaisValidos(percentuais) ? percentuais : COMISSAO_PADRAO;
  const bruto = new Map<string, number[]>();
  const conta = (id: string) => {
    let v = bruto.get(id);
    if (!v) {
      v = new Array(NIVEIS_DE_COMISSAO + 1).fill(0);
      bruto.set(id, v);
    }
    return v;
  };

  for (const no of rede.nos.values()) {
    conta(no.id);
    if (no.vendasCentavos <= 0) continue;
    conta(no.id)[0]! += (no.vendasCentavos * p[0]!) / 100;
    const vistos = new Set([no.id]);
    let acima = no.indicadaPor ? rede.nos.get(no.indicadaPor) : undefined;
    for (let nivel = 1; acima && nivel <= NIVEIS_DE_COMISSAO; nivel++) {
      if (vistos.has(acima.id)) break;
      vistos.add(acima.id);
      conta(acima.id)[nivel]! += (no.vendasCentavos * p[nivel]!) / 100;
      acima = acima.indicadaPor ? rede.nos.get(acima.indicadaPor) : undefined;
    }
  }

  const porPessoa = new Map<string, ComissaoDaPessoa>();
  let totalCentavos = 0;
  for (const [id, v] of bruto) {
    const propriaCentavos = Math.round(v[0]!);
    const porNivelCentavos = v.slice(1).map((x) => Math.round(x));
    const redeCentavos = porNivelCentavos.reduce((s, x) => s + x, 0);
    const total = propriaCentavos + redeCentavos;
    porPessoa.set(id, { propriaCentavos, porNivelCentavos, redeCentavos, totalCentavos: total });
    totalCentavos += total;
  }
  return { porPessoa, totalCentavos, percentualMaximo: p.reduce((s, x) => s + x, 0) };
}

const CARGO_DO_NIVEL = ["", "gestora", "supervisora", "embaixadora", "diretora executiva"];

export function rotuloDoNivel(nivel: number): string {
  const cargo = CARGO_DO_NIVEL[nivel];
  return cargo ? `${nivel}º nível (${cargo})` : `${nivel}º nível`;
}

export type ComissaoDoMes = {
  mes: string;
  vendasCentavos: number;
  pedidos: number;
  comissaoCentavos: number;
  propriaCentavos: number;
  redeCentavos: number;
};

/**
 * Comissão de cada mês, recalculando a rede só com as vendas daquele mês. Resultados que
 * cobrem mais de um mês entram em "sem mês" (mes = null) e não são distribuídos.
 */
export function comissoesPorMes(
  pessoas: PessoaDaRede[],
  resultados: ResultadoDaRede[],
  percentuais: readonly number[] = COMISSAO_PADRAO,
): ComissaoDoMes[] {
  const meses = [...new Set(resultados.map((r) => r.mes).filter((m): m is string => !!m))].sort();
  return meses.map((mes) => {
    const doMes = resultados.filter((r) => r.mes === mes);
    const rede = montarRede(pessoas, doMes, []);
    const c = calcularComissoes(rede, percentuais);
    const redeCentavos = [...c.porPessoa.values()].reduce((s, x) => s + x.redeCentavos, 0);
    return {
      mes,
      vendasCentavos: doMes.reduce((s, r) => s + r.centavos, 0),
      pedidos: doMes.reduce((s, r) => s + r.pedidos, 0),
      comissaoCentavos: c.totalCentavos,
      propriaCentavos: c.totalCentavos - redeCentavos,
      redeCentavos,
    };
  });
}
