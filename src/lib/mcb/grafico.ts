/**
 * Fase 11 — O gráfico de seguidores do relatório, sem biblioteca.
 *
 * Antes era o recharts: 376 KB de JavaScript para uma linha. Aqui ficam só as contas —
 * a escala do eixo e a posição de cada ponto —, puras e testadas; o desenho é SVG.
 */

/** Marcas "redondas" para o eixo (1, 2 ou 5 vezes uma potência de 10), sem decimais. */
export function escalaBonita(minimo: number, maximo: number, quantas = 4): number[] {
  if (!Number.isFinite(minimo) || !Number.isFinite(maximo)) return [0, 1];
  let min = Math.min(minimo, maximo);
  let max = Math.max(minimo, maximo);
  if (min === max) {
    const folga = Math.max(1, Math.abs(min) * 0.1);
    min -= folga;
    max += folga;
  }
  const bruto = (max - min) / quantas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? 10 * potencia,
  );
  let inicio = Math.floor(min / passo) * passo;
  if (minimo >= 0 && inicio < 0) inicio = 0;
  const fim = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let valor = inicio; valor <= fim + passo / 2; valor += passo) marcas.push(Math.round(valor));
  return marcas.length > 1 ? marcas : [inicio, inicio + passo];
}

export type Margem = { topo: number; direita: number; base: number; esquerda: number };

export type LinhaDesenhada = {
  marcas: Array<{ valor: number; y: number }>;
  pontos: Array<{ x: number; y: number; rotulo: string; valor: number }>;
  caminho: string;
};

/** Posições no SVG: pontos igualmente espaçados no eixo X, como o eixo por categoria. */
export function desenharLinha(
  serie: Array<{ data: string; seguidores: number }>,
  largura: number,
  altura: number,
  margem: Margem,
): LinhaDesenhada {
  const valores = serie.map((p) => p.seguidores);
  const marcas = escalaBonita(Math.min(...valores), Math.max(...valores));
  const base = marcas[0] ?? 0;
  const topoDaEscala = marcas[marcas.length - 1] ?? base + 1;
  const w = largura - margem.esquerda - margem.direita;
  const h = altura - margem.topo - margem.base;
  const y = (valor: number) => margem.topo + h - ((valor - base) / (topoDaEscala - base || 1)) * h;
  const x = (i: number) =>
    margem.esquerda + (serie.length === 1 ? w / 2 : (i * w) / (serie.length - 1));

  const pontos = serie.map((p, i) => ({
    x: x(i),
    y: y(p.seguidores),
    rotulo: p.data,
    valor: p.seguidores,
  }));
  return {
    marcas: marcas.map((valor) => ({ valor, y: y(valor) })),
    pontos,
    caminho: pontos
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" "),
  };
}

/** Com muitos pontos, só alguns rótulos no eixo X, para não se sobreporem. */
export function rotulosVisiveis(quantidade: number, maximo = 8): Set<number> {
  if (quantidade <= maximo) return new Set(Array.from({ length: quantidade }, (_, i) => i));
  const passo = Math.ceil((quantidade - 1) / (maximo - 1));
  const visiveis = new Set<number>();
  for (let i = 0; i < quantidade; i += passo) visiveis.add(i);
  visiveis.add(quantidade - 1);
  return visiveis;
}
