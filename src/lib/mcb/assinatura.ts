/**
 * Fase 7 — Assinatura sem cobrança online: as regras de prazo, sem rede nem banco.
 *
 * Decisões de 2026-09-14: ambiente novo nasce com 14 dias de avaliação; aviso a partir de
 * 5 dias antes do vencimento; vencido, mais 3 dias de tolerância e depois só leitura; o
 * pagamento é combinado pelo contato e registrado pela administração. Os mesmos prazos
 * estão no banco (`suspender_vencidos`, `registrar_pagamento`, `cancelar_assinatura`,
 * migração `20260914100000_fase7_assinatura_e_convites`) — mudar um lado exige mudar o
 * outro, e os Termos de Uso.
 */

import { CONTROLADOR } from "./documentosLegais";
import { dataBR } from "./relatorio";

export const DIAS_DE_AVALIACAO = 14;
export const DIAS_DE_AVISO_DE_VENCIMENTO = 5;
export const DIAS_DE_TOLERANCIA = 3;
export const DIAS_DE_ARREPENDIMENTO = 7;

export type DadosDaAssinatura = {
  cobranca: string;
  venceEm: string | null;
  status: string;
  suspensaoMotivo: string | null;
  isDemo?: boolean;
};

export type EstadoDaAssinatura =
  | { fase: "isenta" }
  | { fase: "suspensa"; porVencimento: boolean }
  | { fase: "avaliacao" | "paga"; venceEm: string; dias: number; vencendo: boolean }
  | { fase: "tolerancia"; venceEm: string; suspendeEm: string; dias: number }
  | { fase: "cancelada"; valeAte: string; dias: number };

const DIA_EM_MS = 86_400_000;

/** Dias que faltam até a data, arredondando para cima: vencer hoje à tarde ainda é 1. */
export function diasAte(dataIso: string, agora: Date = new Date()): number {
  return Math.ceil((Date.parse(dataIso) - agora.getTime()) / DIA_EM_MS);
}

export function estadoDaAssinatura(
  dados: DadosDaAssinatura,
  agora: Date = new Date(),
): EstadoDaAssinatura {
  if (dados.isDemo || dados.cobranca === "ISENTA" || !dados.venceEm) {
    return dados.status === "SUSPENDED"
      ? { fase: "suspensa", porVencimento: false }
      : { fase: "isenta" };
  }
  if (dados.status === "SUSPENDED") {
    return { fase: "suspensa", porVencimento: dados.suspensaoMotivo === "VENCIMENTO" };
  }

  const dias = diasAte(dados.venceEm, agora);
  if (dados.cobranca === "CANCELADA") {
    return { fase: "cancelada", valeAte: dados.venceEm, dias: Math.max(0, dias) };
  }
  if (dias <= 0) {
    const suspendeEm = new Date(
      Date.parse(dados.venceEm) + DIAS_DE_TOLERANCIA * DIA_EM_MS,
    ).toISOString();
    return {
      fase: "tolerancia",
      venceEm: dados.venceEm,
      suspendeEm,
      dias: Math.max(0, diasAte(suspendeEm, agora)),
    };
  }
  return {
    fase: dados.cobranca === "PAGA" ? "paga" : "avaliacao",
    venceEm: dados.venceEm,
    dias,
    vencendo: dias <= DIAS_DE_AVISO_DE_VENCIMENTO,
  };
}

/** Entra na lista de vencimentos da administração e no aviso do painel da gestora. */
export function precisaDeAviso(estado: EstadoDaAssinatura): boolean {
  if (estado.fase === "avaliacao" || estado.fase === "paga") return estado.vencendo;
  if (estado.fase === "suspensa") return estado.porVencimento;
  return estado.fase === "tolerancia";
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function textoDaSituacao(estado: EstadoDaAssinatura): string {
  switch (estado.fase) {
    case "isenta":
      return "Sem cobrança neste ambiente.";
    case "avaliacao":
      return `Avaliação gratuita até ${dataBR(estado.venceEm)} — ${plural(estado.dias, "dia", "dias")}.`;
    case "paga":
      return `Assinatura em dia até ${dataBR(estado.venceEm)} — ${plural(estado.dias, "dia", "dias")}.`;
    case "tolerancia":
      return `A assinatura venceu em ${dataBR(estado.venceEm)}. O ambiente fica só para leitura em ${dataBR(estado.suspendeEm)} se o pagamento não for registrado.`;
    case "cancelada":
      return `Assinatura cancelada. O ambiente funciona até ${dataBR(estado.valeAte)} e depois fica só para leitura.`;
    case "suspensa":
      return estado.porVencimento
        ? "A assinatura venceu e o ambiente está só para leitura até o pagamento."
        : "O ambiente foi suspenso pela administração da plataforma.";
  }
}

/** Preço como na página inicial: "R$ 97", "R$ 97,50". */
export function precoBR(centavos: number): string {
  const inteiro = centavos % 100 === 0;
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Valor digitado na administração ("97", "97,50", "1.297,00") em centavos. */
export function centavosDoCampo(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, "");
  let normal: string;
  if (limpo.includes(",")) normal = limpo.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) normal = limpo.replace(/\./g, "");
  else normal = limpo;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  return Math.round(Number(normal) * 100);
}

/** Valor inicial do campo: o preço do plano, no formato que a pessoa digitaria. */
export function precoParaCampo(centavos: number | null): string {
  if (centavos === null) return "";
  return centavos % 100 === 0
    ? String(centavos / 100)
    : (centavos / 100).toFixed(2).replace(".", ",");
}

export type EmailDeAviso = { assunto: string; corpo: string };

/** O e-mail que a dona da plataforma manda à dona do ambiente. O MCB não envia sozinho. */
export function emailDeVencimento(p: {
  nomeDaDona: string | null;
  ambiente: string;
  estado: EstadoDaAssinatura;
  plano: string | null;
  precoCentavos: number | null;
}): EmailDeAviso {
  const primeiroNome = p.nomeDaDona ? (p.nomeDaDona.trim().split(/\s+/)[0] ?? p.nomeDaDona) : null;
  const ola = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";
  const plano = p.plano
    ? `o plano ${p.plano}${p.precoCentavos ? ` (${precoBR(p.precoCentavos)} por mês)` : ""}`
    : "o seu plano";
  const regra = `Se o pagamento não for feito até o vencimento, o ambiente segue funcionando por mais ${plural(DIAS_DE_TOLERANCIA, "dia", "dias")}; depois fica disponível só para leitura, e a página deixa de receber candidaturas até o pagamento.`;
  const fecho = `Equipe MCB\n${CONTROLADOR.email}`;

  let assunto: string;
  let paragrafos: string[];
  switch (p.estado.fase) {
    case "avaliacao":
      assunto = `Sua avaliação do MCB termina em ${dataBR(p.estado.venceEm)}`;
      paragrafos = [
        `A avaliação gratuita do ambiente ${p.ambiente} no MCB termina em ${dataBR(p.estado.venceEm)}. Para continuar com ${plano}, é só responder este e-mail que combinamos o pagamento.`,
        regra,
      ];
      break;
    case "paga":
      assunto = `Sua assinatura do MCB vence em ${dataBR(p.estado.venceEm)}`;
      paragrafos = [
        `A assinatura do ambiente ${p.ambiente} no MCB vence em ${dataBR(p.estado.venceEm)}. Para renovar ${plano}, responda este e-mail e combinamos o pagamento.`,
        regra,
      ];
      break;
    case "tolerancia":
      assunto = "Sua assinatura do MCB venceu";
      paragrafos = [
        `A assinatura do ambiente ${p.ambiente} no MCB venceu em ${dataBR(p.estado.venceEm)}. Ele continua funcionando até ${dataBR(p.estado.suspendeEm)}; depois fica disponível só para leitura, e a página deixa de receber candidaturas, até o pagamento.`,
        `Para continuar com ${plano}, responda este e-mail e combinamos o pagamento.`,
      ];
      break;
    case "suspensa":
      assunto = "Seu ambiente no MCB está só para leitura";
      paragrafos = [
        `O ambiente ${p.ambiente} está disponível só para leitura porque a assinatura venceu. Você continua vendo todos os dados. Para reativar ${plano}, responda este e-mail e combinamos o pagamento; a reativação é imediata.`,
      ];
      break;
    default:
      assunto = "Sua assinatura do MCB";
      paragrafos = [`Escrevemos sobre a assinatura do ambiente ${p.ambiente} no MCB.`];
  }
  return { assunto, corpo: [ola, ...paragrafos, fecho].join("\n\n") };
}

export function linkDeEmail(destino: string, email: EmailDeAviso): string {
  return `mailto:${destino}?subject=${encodeURIComponent(email.assunto)}&body=${encodeURIComponent(email.corpo)}`;
}
