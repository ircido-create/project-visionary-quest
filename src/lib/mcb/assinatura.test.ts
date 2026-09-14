import { describe, expect, it } from "vitest";

import {
  DIAS_DE_AVALIACAO,
  DIAS_DE_AVISO_DE_VENCIMENTO,
  DIAS_DE_TOLERANCIA,
  centavosDoCampo,
  emailDeVencimento,
  estadoDaAssinatura,
  linkDeEmail,
  precisaDeAviso,
  precoBR,
  precoParaCampo,
  textoDaSituacao,
} from "./assinatura";

const agora = new Date("2026-09-14T12:00:00Z");
const ativa = (cobranca: string, venceEm: string | null) => ({
  cobranca,
  venceEm,
  status: "ACTIVE",
  suspensaoMotivo: null,
});

describe("prazos da assinatura", () => {
  it("são os decididos em 2026-09-14", () => {
    expect(DIAS_DE_AVALIACAO).toBe(14);
    expect(DIAS_DE_AVISO_DE_VENCIMENTO).toBe(5);
    expect(DIAS_DE_TOLERANCIA).toBe(3);
  });
});

describe("estado da assinatura", () => {
  it("isento e demonstração não têm prazo", () => {
    expect(estadoDaAssinatura(ativa("ISENTA", null), agora)).toEqual({ fase: "isenta" });
    expect(
      estadoDaAssinatura({ ...ativa("AVALIACAO", "2026-09-20T12:00:00Z"), isDemo: true }, agora),
    ).toEqual({ fase: "isenta" });
  });

  it("avaliação longe do fim não pede aviso; a 5 dias pede", () => {
    const longe = estadoDaAssinatura(ativa("AVALIACAO", "2026-09-24T12:00:00Z"), agora);
    expect(longe).toMatchObject({ fase: "avaliacao", dias: 10, vencendo: false });
    expect(precisaDeAviso(longe)).toBe(false);

    const perto = estadoDaAssinatura(ativa("AVALIACAO", "2026-09-19T12:00:00Z"), agora);
    expect(perto).toMatchObject({ fase: "avaliacao", dias: 5, vencendo: true });
    expect(precisaDeAviso(perto)).toBe(true);
  });

  it("vencer hoje mais tarde ainda conta como 1 dia", () => {
    expect(estadoDaAssinatura(ativa("PAGA", "2026-09-14T15:00:00Z"), agora)).toMatchObject({
      fase: "paga",
      dias: 1,
    });
  });

  it("vencida entra na tolerância de 3 dias", () => {
    const estado = estadoDaAssinatura(ativa("PAGA", "2026-09-13T12:00:00Z"), agora);
    expect(estado).toMatchObject({
      fase: "tolerancia",
      suspendeEm: "2026-09-16T12:00:00.000Z",
      dias: 2,
    });
    expect(precisaDeAviso(estado)).toBe(true);
  });

  it("cancelada vale até o fim do período, sem aviso de cobrança", () => {
    const estado = estadoDaAssinatura(ativa("CANCELADA", "2026-10-01T12:00:00Z"), agora);
    expect(estado).toMatchObject({ fase: "cancelada", dias: 17 });
    expect(precisaDeAviso(estado)).toBe(false);
  });

  it("suspensa: por vencimento pede aviso; pela administração, não", () => {
    const porVencimento = estadoDaAssinatura(
      {
        cobranca: "PAGA",
        venceEm: "2026-09-01T12:00:00Z",
        status: "SUSPENDED",
        suspensaoMotivo: "VENCIMENTO",
      },
      agora,
    );
    expect(porVencimento).toEqual({ fase: "suspensa", porVencimento: true });
    expect(precisaDeAviso(porVencimento)).toBe(true);

    const pelaAdministracao = estadoDaAssinatura(
      { cobranca: "ISENTA", venceEm: null, status: "SUSPENDED", suspensaoMotivo: "ADMINISTRACAO" },
      agora,
    );
    expect(pelaAdministracao).toEqual({ fase: "suspensa", porVencimento: false });
    expect(precisaDeAviso(pelaAdministracao)).toBe(false);
  });

  it("o texto diz quantos dias faltam, no singular e no plural", () => {
    expect(
      textoDaSituacao(estadoDaAssinatura(ativa("AVALIACAO", "2026-09-15T12:00:00Z"), agora)),
    ).toContain("1 dia.");
    expect(
      textoDaSituacao(estadoDaAssinatura(ativa("AVALIACAO", "2026-09-24T12:00:00Z"), agora)),
    ).toContain("10 dias.");
  });
});

describe("valores em reais", () => {
  it("formata como a página inicial", () => {
    expect(precoBR(9700)).toBe("R$ 97");
    expect(precoBR(9750)).toBe("R$ 97,50");
    expect(precoBR(129700)).toBe("R$ 1.297");
  });

  it("lê o que se digita no campo", () => {
    expect(centavosDoCampo("97")).toBe(9700);
    expect(centavosDoCampo("97,50")).toBe(9750);
    expect(centavosDoCampo("R$ 1.297,00")).toBe(129700);
    expect(centavosDoCampo("1.297")).toBe(129700);
    expect(centavosDoCampo("97.5")).toBe(9750);
    expect(centavosDoCampo("")).toBeNull();
    expect(centavosDoCampo("noventa")).toBeNull();
    expect(centavosDoCampo("97,505")).toBeNull();
  });

  it("preenche o campo com o preço do plano", () => {
    expect(precoParaCampo(9700)).toBe("97");
    expect(precoParaCampo(9750)).toBe("97,50");
    expect(precoParaCampo(null)).toBe("");
  });
});

describe("e-mail de vencimento", () => {
  it("avaliação terminando: nome, ambiente, plano, preço e a regra da tolerância", () => {
    const email = emailDeVencimento({
      nomeDaDona: "Ana Paula Souza",
      ambiente: "Equipe Ana",
      estado: estadoDaAssinatura(ativa("AVALIACAO", "2026-09-17T12:00:00Z"), agora),
      plano: "Essencial",
      precoCentavos: 9700,
    });
    expect(email.assunto).toContain("avaliação");
    expect(email.corpo).toContain("Olá, Ana!");
    expect(email.corpo).toContain("Equipe Ana");
    expect(email.corpo).toContain("Essencial (R$ 97 por mês)");
    expect(email.corpo).toContain("mais 3 dias");
    expect(email.corpo).toContain("contato@mcblessing.com.br");
  });

  it("suspenso por vencimento: explica a leitura e a reativação imediata", () => {
    const email = emailDeVencimento({
      nomeDaDona: null,
      ambiente: "Equipe Ana",
      estado: { fase: "suspensa", porVencimento: true },
      plano: null,
      precoCentavos: null,
    });
    expect(email.corpo.startsWith("Olá!")).toBe(true);
    expect(email.corpo).toContain("só para leitura");
    expect(email.corpo).toContain("reativação é imediata");
  });

  it("o link abre o e-mail com assunto e corpo codificados", () => {
    const link = linkDeEmail("ana@exemplo.com", {
      assunto: "Olá & tchau",
      corpo: "linha 1\n\nlinha 2",
    });
    expect(link).toBe(
      "mailto:ana@exemplo.com?subject=Ol%C3%A1%20%26%20tchau&body=linha%201%0A%0Alinha%202",
    );
  });
});
