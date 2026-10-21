import { describe, expect, it } from "vitest";

import {
  emailPendente,
  lerCsv,
  lerData,
  lerDinheiro,
  lerPlanilhaDeRede,
  lerSituacao,
  montarRede,
} from "./rede";

describe("lerCsv", () => {
  it("lê ponto e vírgula, aspas, BOM e linhas em branco", () => {
    const texto = '﻿nome;vendas\n"Silva; Ana";"1.229,78"\r\n\n"Diz ""oi""";0\n';
    expect(lerCsv(texto)).toEqual([
      ["nome", "vendas"],
      ["Silva; Ana", "1.229,78"],
      ['Diz "oi"', "0"],
    ]);
  });

  it("usa vírgula quando é o separador do cabeçalho", () => {
    expect(lerCsv("nome,email\nAna,a@x.com")).toEqual([
      ["nome", "email"],
      ["Ana", "a@x.com"],
    ]);
  });
});

describe("valores", () => {
  it("lê dinheiro nos formatos brasileiro e americano", () => {
    expect(lerDinheiro("R$ 1.229,78")).toBe(122978);
    expect(lerDinheiro("54,39")).toBe(5439);
    expect(lerDinheiro("1229.78")).toBe(122978);
    expect(lerDinheiro("1,229.78")).toBe(122978);
    expect(lerDinheiro("")).toBeNull();
    expect(lerDinheiro("abc")).toBeNaN();
  });

  it("lê datas e recusa datas que não existem", () => {
    expect(lerData("20/10/2026")).toBe("2026-10-20");
    expect(lerData("2026-04-01")).toBe("2026-04-01");
    expect(lerData("31/02/2026")).toBe("invalida");
    expect(lerData("")).toBeNull();
  });

  it("entende a situação de meta como o painel escreve", () => {
    expect(lerSituacao("Bateu a Meta")).toBe("BATEU");
    expect(lerSituacao("Não Bateu a Meta")).toBe("NAO_BATEU");
    expect(lerSituacao("nao bateu")).toBe("NAO_BATEU");
    expect(lerSituacao("Sem Vendas no Mês")).toBe("SEM_VENDAS");
    expect(lerSituacao("")).toBeNull();
    expect(lerSituacao("talvez")).toBe("invalida");
  });

  it("reconhece e-mail provisório da importação", () => {
    expect(emailPendente("pendente-abc@importacao.invalid")).toBe(true);
    expect(emailPendente("ana@x.com")).toBe(false);
  });
});

const PLANILHA = [
  "nome;email;indicada por;vendas;pedidos;periodo inicio;periodo fim;meta 2026-08;meta 2026-09;meta 2026-10",
  "Bia Topo;;;;;;;;;",
  "Carla Gestora;carla@x.com;Bia Topo;100,00;2;01/08/2026;20/10/2026;Bateu;Sem vendas;Sem vendas",
  "Duda Afiliada;;Carla Gestora;50,50;1;01/08/2026;20/10/2026;Sem vendas;Sem vendas;Não bateu",
  "Eva Afiliada;;Carla Gestora;0,00;;01/08/2026;20/10/2026;Sem vendas;Sem vendas;Sem vendas",
  "Fabi Neta;;Duda Afiliada;10,00;;01/08/2026;20/10/2026;Sem vendas;Bateu;Sem vendas",
  "Total;;;160,50;;;;;;",
].join("\n");

describe("lerPlanilhaDeRede", () => {
  it("transforma a planilha em linhas para a importação", () => {
    const { linhas, erros } = lerPlanilhaDeRede(PLANILHA);
    expect(erros).toEqual([]);
    expect(linhas).toHaveLength(5);
    expect(linhas[1]).toEqual({
      nome: "Carla Gestora",
      email: "carla@x.com",
      indicada_por: "Bia Topo",
      vendas_centavos: 10000,
      pedidos: 2,
      periodo_inicio: "2026-08-01",
      periodo_fim: "2026-10-20",
      metas: { "2026-08-01": "BATEU", "2026-09-01": "SEM_VENDAS", "2026-10-01": "SEM_VENDAS" },
    });
    expect(linhas[0]).toMatchObject({
      nome: "Bia Topo",
      indicada_por: null,
      vendas_centavos: null,
    });
  });

  it("aceita as colunas com os nomes do painel", () => {
    const { linhas, erros } = lerPlanilhaDeRede(
      "Afiliado;1º Geração;Total Vendas;periodo_inicio;periodo_fim\nAna Lima;Bia Topo;R$ 1.000,00;2026-04-01;2026-10-20",
    );
    expect(erros).toEqual([]);
    expect(linhas[0]).toMatchObject({
      nome: "Ana Lima",
      indicada_por: "Bia Topo",
      vendas_centavos: 100000,
    });
  });

  it("aponta os problemas pela linha", () => {
    const { erros } = lerPlanilhaDeRede(
      [
        "nome;email;indicada por;vendas;periodo inicio;periodo fim;meta 2026-10",
        "Ana Lima;nao-e-email;;10;01/10/2026;20/10/2026;Bateu",
        "Ana  Lima;;;;;;",
        "Bia Souza;;Bia Souza;xx;01/10/2026;;talvez",
      ].join("\n"),
    );
    expect(erros).toEqual([
      "Linha 2: e-mail inválido (nao-e-email).",
      "Linha 3: Ana Lima aparece mais de uma vez.",
      "Linha 4: Bia Souza não pode ter sido indicada por ela mesma.",
      "Linha 4: valor de vendas ilegível.",
      "Linha 4: informe o início e o fim do período das vendas.",
      "Linha 4: situação de meta ilegível em 2026-10 (use Bateu, Não bateu ou Sem vendas).",
    ]);
  });

  it("exige a coluna de nome", () => {
    expect(lerPlanilhaDeRede("email\na@x.com").erros).toEqual(['Falta a coluna "nome".']);
  });
});

describe("montarRede", () => {
  const pessoas = [
    { id: "bia", nome: "Bia Topo", indicadaPor: null },
    { id: "carla", nome: "Carla Gestora", indicadaPor: "bia" },
    { id: "duda", nome: "Duda Afiliada", indicadaPor: "carla" },
    { id: "eva", nome: "Eva Afiliada", indicadaPor: "carla" },
    { id: "fabi", nome: "Fabi Neta", indicadaPor: "duda" },
    { id: "gil", nome: "Gil Sem Dados", indicadaPor: "bia" },
  ];
  const resultados = [
    { influencerId: "carla", centavos: 10000, pedidos: 2 },
    { influencerId: "duda", centavos: 5050, pedidos: 1 },
    { influencerId: "fabi", centavos: 1000, pedidos: 0 },
  ];
  const metas = [
    { influencerId: "carla", mes: "2026-08-01", situacao: "BATEU" as const },
    { influencerId: "carla", mes: "2026-10-01", situacao: "SEM_VENDAS" as const },
    { influencerId: "duda", mes: "2026-10-01", situacao: "NAO_BATEU" as const },
    { influencerId: "eva", mes: "2026-10-01", situacao: "SEM_VENDAS" as const },
    { influencerId: "fabi", mes: "2026-09-01", situacao: "BATEU" as const },
  ];
  const rede = montarRede(pessoas, resultados, metas);

  it("monta níveis, papéis e tamanho da rede", () => {
    expect(rede.raizes.map((r) => r.id)).toEqual(["bia"]);
    const no = (id: string) => rede.nos.get(id)!;
    expect(no("bia")).toMatchObject({ nivel: 0, papel: "TOPO", tamanhoDaRede: 5 });
    expect(no("carla")).toMatchObject({ nivel: 1, papel: "GESTORA", tamanhoDaRede: 3 });
    expect(no("duda")).toMatchObject({ nivel: 2, papel: "GESTORA", tamanhoDaRede: 1 });
    expect(no("fabi")).toMatchObject({ nivel: 3, papel: "AFILIADA", tamanhoDaRede: 0 });
    expect(no("carla").indicadas.map((f) => f.id)).toEqual(["duda", "eva"]);
  });

  it("valor da equipe é a soma das indicadas diretas, como no painel", () => {
    expect(rede.nos.get("carla")!.vendasDaEquipeCentavos).toBe(5050);
    expect(rede.nos.get("duda")!.vendasDaEquipeCentavos).toBe(1000);
  });

  it("conta gestoras, afiliadas e vendas sem o topo", () => {
    expect(rede).toMatchObject({ gestoras: 2, afiliadas: 3, vendasCentavos: 16050, pedidos: 3 });
    expect(rede.meses).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("situação de vendas conta do mês mais recente da planilha", () => {
    const s = (id: string) => rede.nos.get(id)!.situacaoDeVendas;
    expect(s("duda")).toBe("ULTIMO_MES");
    expect(s("fabi")).toBe("ULTIMO_MES"); // setembro conta como último mês em outubro
    expect(s("carla")).toBe("HA_2_MESES");
    expect(s("eva")).toBe("NUNCA");
    expect(s("gil")).toBe("SEM_DADOS");
    expect(rede.porSituacao).toEqual({
      ULTIMO_MES: 2,
      HA_2_MESES: 1,
      HA_3_MESES: 0,
      HA_MAIS_DE_3_MESES: 0,
      NUNCA: 1,
      SEM_DADOS: 1,
    });
  });

  it("não entra em laço se os dados tiverem um ciclo", () => {
    const ciclo = montarRede(
      [
        { id: "a", nome: "A", indicadaPor: "b" },
        { id: "b", nome: "B", indicadaPor: "a" },
      ],
      [],
      [],
    );
    expect(ciclo.raizes).toEqual([]);
  });
});
