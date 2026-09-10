import { describe, expect, it } from "vitest";

import {
  SCOPES,
  lerErroDaMeta,
  lerPerfil,
  lerPublicoFeminino,
  montarUrlDeAutorizacao,
  precisaRenovar,
} from "./instagram";

describe("url de autorização", () => {
  const url = () =>
    new URL(
      montarUrlDeAutorizacao({
        appId: "123",
        redirectUri: "https://app.mcblessing.com.br/instagram/retorno",
        state: "abc",
      }),
    );

  it("aponta para o domínio do Instagram, não o do Facebook", () => {
    // O caminho pelo Facebook exigiria Página vinculada, que as candidatas não têm.
    expect(url().host).toBe("www.instagram.com");
  });

  it("pede exatamente os dois escopos usados", () => {
    expect(url().searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_manage_insights",
    );
    expect(SCOPES).toHaveLength(2);
  });

  it("leva o state adiante", () => {
    expect(url().searchParams.get("state")).toBe("abc");
  });

  it("escapa a redirect_uri em vez de concatenar cru", () => {
    expect(url().searchParams.get("redirect_uri")).toBe(
      "https://app.mcblessing.com.br/instagram/retorno",
    );
  });
});

describe("leitura do perfil", () => {
  it("lê os três campos que interessam", () => {
    expect(
      lerPerfil({
        id: "17841400000000000",
        username: "ana",
        followers_count: 812,
        media_count: 47,
      }),
    ).toEqual({
      id: "17841400000000000",
      username: "ana",
      seguidores: 812,
      publicacoes: 47,
    });
  });

  it("devolve nulo por campo ausente, não zero", () => {
    // Zero seguidores e "a Meta não mandou" são coisas diferentes: o motor de
    // qualificação trata ausência como desconhecido, e zero como reprovação.
    const p = lerPerfil({ id: "1" });
    expect(p?.seguidores).toBeNull();
    expect(p?.publicacoes).toBeNull();
  });

  it("recusa resposta sem id", () => {
    expect(lerPerfil({ username: "ana" })).toBeNull();
    expect(lerPerfil(null)).toBeNull();
    expect(lerPerfil("erro")).toBeNull();
  });
});

describe("público feminino a partir de follower_demographics", () => {
  const resposta = (results: unknown[]) => ({
    data: [{ total_value: { breakdowns: [{ results }] } }],
  });

  it("calcula o percentual com uma casa decimal", () => {
    const json = resposta([
      { dimension_values: ["F"], value: 700 },
      { dimension_values: ["M"], value: 300 },
    ]);
    expect(lerPublicoFeminino(json)).toBe(70);
  });

  it("inclui quem não informou gênero no denominador", () => {
    // A pergunta do método é que fração do público é feminina; quem não informou
    // continua fazendo parte do público.
    const json = resposta([
      { dimension_values: ["F"], value: 50 },
      { dimension_values: ["M"], value: 30 },
      { dimension_values: ["U"], value: 20 },
    ]);
    expect(lerPublicoFeminino(json)).toBe(50);
  });

  it("devolve nulo quando a Meta não manda a quebra", () => {
    // Acontece de verdade abaixo de 100 seguidores. Nulo preserva o valor vindo do
    // print; zero apagaria um dado bom.
    expect(lerPublicoFeminino({ data: [] })).toBeNull();
    expect(lerPublicoFeminino({ data: [{ total_value: {} }] })).toBeNull();
    expect(lerPublicoFeminino(resposta([]))).toBeNull();
  });

  it("devolve nulo se o formato mudar, em vez de inventar número", () => {
    expect(
      lerPublicoFeminino({ data: [{ total_value: { breakdowns: "outra coisa" } }] }),
    ).toBeNull();
    expect(lerPublicoFeminino(resposta([{ dimension_values: ["F"], value: "muitos" }]))).toBeNull();
    expect(lerPublicoFeminino(null)).toBeNull();
  });

  it("ignora linha malformada mas aproveita as boas", () => {
    const json = resposta([
      { dimension_values: ["F"], value: 80 },
      { lixo: true },
      { dimension_values: ["M"], value: 20 },
    ]);
    expect(lerPublicoFeminino(json)).toBe(80);
  });
});

describe("mensagem de erro da Meta", () => {
  it("extrai a frase útil", () => {
    expect(lerErroDaMeta({ error: { message: "Invalid OAuth access token." } })).toBe(
      "Invalid OAuth access token.",
    );
  });

  it("devolve nulo quando não é erro", () => {
    expect(lerErroDaMeta({ data: [] })).toBeNull();
    expect(lerErroDaMeta(null)).toBeNull();
  });
});

describe("renovação do token", () => {
  const agora = new Date("2026-09-10T12:00:00Z");

  it("não renova token novo", () => {
    expect(precisaRenovar("2026-11-01T12:00:00Z", agora)).toBe(false);
  });

  it("renova dentro da janela de folga", () => {
    // 5 dias para expirar, e a folga é de 10.
    expect(precisaRenovar("2026-09-15T12:00:00Z", agora)).toBe(true);
  });

  it("renova token já vencido", () => {
    expect(precisaRenovar("2026-09-01T12:00:00Z", agora)).toBe(true);
  });

  it("trata validade desconhecida como precisando renovar", () => {
    expect(precisaRenovar(null, agora)).toBe(true);
  });
});
