/**
 * Fase 8 — Os requisitos do programa como a afiliada os vê no portal.
 *
 * O cálculo é o mesmo da página da gestora (`evaluateQualification`); aqui só muda a
 * linguagem. O texto da gestora diz o estado ("aguardando dado", "faltam 88"); o da
 * afiliada diz o que ela pode fazer. Não há decisão de auditoria nem nota interna aqui.
 */

import { formatarValorAtual, numeroBR, type RequirementResult } from "./qualification";

export type SituacaoDoRequisito = "cumprido" | "falta" | "a_confirmar";

export type RequisitoDoPortal = {
  chave: string;
  titulo: string;
  situacao: SituacaoDoRequisito;
  atual: string | null;
  meta: string;
  proximoPasso: string | null;
};

const META: Record<string, string> = {
  followers: "500 ou mais",
  posts: "31 ou mais",
  recency: "12 nos últimos 6 meses",
  profile_type: "Conta de criadora de conteúdo",
  female_audience: "Mais de 50%",
};

const A_CONFIRMAR: Record<string, string> = {
  followers: "Conte à sua gestora quantos seguidores você tem hoje.",
  posts: "Conte à sua gestora quantas publicações há no seu feed.",
  recency: "Confira as datas das suas 12 publicações mais recentes e conte à sua gestora.",
  profile_type: "Confira o tipo da sua conta no Instagram e conte à sua gestora.",
  female_audience:
    "Envie à sua gestora o print do público nas estatísticas do Instagram (Painel profissional → Público).",
};

function faltam(quantidade: number, um: string, varios: string): string {
  return quantidade === 1 ? `Falta 1 ${um}` : `Faltam ${numeroBR(quantidade)} ${varios}`;
}

function numero(valor: RequirementResult["currentValue"]): number | null {
  return typeof valor === "number" ? valor : null;
}

function passoQueFalta(r: RequirementResult): string {
  switch (r.key) {
    case "followers": {
      const atual = numero(r.currentValue);
      return atual === null
        ? "Continue crescendo até 500 seguidores."
        : `${faltam(Math.max(0, 500 - atual), "seguidor", "seguidores")} para chegar a 500.`;
    }
    case "posts": {
      const atual = numero(r.currentValue);
      return atual === null
        ? "Publique no feed até passar de 30 publicações."
        : `${faltam(Math.max(0, 31 - atual), "publicação", "publicações")} no feed para passar de 30.`;
    }
    case "recency":
      return "Publique com regularidade: as 12 publicações mais recentes precisam ser dos últimos 6 meses.";
    case "profile_type":
      return "Mude a conta para criadora de conteúdo nas configurações do Instagram.";
    case "female_audience":
      return r.currentValue === null
        ? "O público feminino precisa passar de 50%."
        : `Seu público feminino está em ${String(r.currentValue)}; precisa passar de 50%.`;
    default:
      return r.gap ?? "Fale com sua gestora sobre este requisito.";
  }
}

export function requisitosParaCandidata(requisitos: RequirementResult[]): RequisitoDoPortal[] {
  return requisitos.map((r) => {
    const situacao: SituacaoDoRequisito =
      r.status === "PASS" ? "cumprido" : r.status === "FAIL" ? "falta" : "a_confirmar";
    return {
      chave: r.key,
      titulo: r.label,
      situacao,
      atual: formatarValorAtual(r.currentValue),
      meta: META[r.key] ?? r.targetLabel,
      proximoPasso:
        situacao === "cumprido"
          ? null
          : situacao === "falta"
            ? passoQueFalta(r)
            : r.status === "REVIEW"
              ? "Sua gestora vai conferir este dado."
              : (A_CONFIRMAR[r.key] ?? "Conte este dado à sua gestora."),
    };
  });
}

export function resumoDosRequisitos(itens: RequisitoDoPortal[]): string {
  const cumpridos = itens.filter((item) => item.situacao === "cumprido").length;
  if (itens.length > 0 && cumpridos === itens.length) {
    return `Você cumpre os ${itens.length} requisitos do programa.`;
  }
  return `${cumpridos} de ${itens.length} requisitos cumpridos. Veja abaixo o que falta.`;
}
