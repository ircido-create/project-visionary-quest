/**
 * Fase 11 — Gráfico de seguidores do relatório, em SVG, sem biblioteca. Sem animação:
 * a impressão em PDF captura a linha já desenhada. O valor de cada ponto aparece ao passar
 * o mouse (título nativo do SVG).
 */

import { desenharLinha, rotulosVisiveis } from "@/lib/mcb/grafico";
import { formatarNumero } from "@/lib/mcb/relatorio";

const LARGURA = 600;
const ALTURA = 224;
const MARGEM = { topo: 8, direita: 16, base: 24, esquerda: 56 };

export function GraficoSeguidores({
  pontos,
}: {
  pontos: Array<{ data: string; seguidores: number }>;
}) {
  if (pontos.length === 0) return null;
  const linha = desenharLinha(pontos, LARGURA, ALTURA, MARGEM);
  const visiveis = rotulosVisiveis(linha.pontos.length);

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="h-auto w-full text-muted-foreground"
      role="img"
      aria-label={`Seguidores: de ${formatarNumero(pontos[0]!.seguidores)} a ${formatarNumero(pontos[pontos.length - 1]!.seguidores)}`}
    >
      {linha.marcas.map((marca) => (
        <g key={marca.valor}>
          <line
            x1={MARGEM.esquerda}
            x2={LARGURA - MARGEM.direita}
            y1={marca.y}
            y2={marca.y}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <text
            x={MARGEM.esquerda - 8}
            y={marca.y + 4}
            textAnchor="end"
            fontSize="11"
            fill="currentColor"
          >
            {formatarNumero(marca.valor)}
          </text>
        </g>
      ))}
      {linha.pontos.map((ponto, i) =>
        visiveis.has(i) ? (
          <text
            key={`r-${i}`}
            x={ponto.x}
            y={ALTURA - 6}
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
          >
            {ponto.rotulo}
          </text>
        ) : null,
      )}
      <path d={linha.caminho} fill="none" stroke="var(--primary)" strokeWidth="2" />
      {linha.pontos.map((ponto, i) => (
        <circle key={`p-${i}`} cx={ponto.x} cy={ponto.y} r="3" fill="var(--primary)">
          <title>{`${ponto.rotulo}: ${formatarNumero(ponto.valor)} seguidores`}</title>
        </circle>
      ))}
    </svg>
  );
}
