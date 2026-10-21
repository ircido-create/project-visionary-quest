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
    if (vistas.has(chave)) {
      erros.push(`Linha ${numero}: ${nome} aparece mais de uma vez.`);
      return;
    }
    vistas.add(chave);

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

export type ResultadoDaRede = { influencerId: string; centavos: number; pedidos: number };
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
