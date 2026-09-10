import { describe, expect, it } from "vitest";

import { dataBr, gerarCsv, numeroBr } from "./csv";

/** Sem o BOM, o Excel lê o arquivo como Latin-1 e a acentuação quebra. */
const BOM = "﻿";

const semBom = (csv: string) => csv.slice(BOM.length);
const linhasDe = (csv: string) => semBom(csv).split("\r\n");

describe("geração de CSV", () => {
  it("começa com BOM", () => {
    expect(gerarCsv(["a"], [["b"]]).startsWith(BOM)).toBe(true);
  });

  it("separa por ponto e vírgula, não por vírgula", () => {
    // O Excel em pt-BR usa vírgula como separador decimal: separar campos por vírgula
    // faria a planilha abrir com tudo numa coluna só.
    const csv = gerarCsv(["Nome", "Cidade"], [["Ana", "Recife"]]);
    expect(linhasDe(csv)[0]).toBe("Nome;Cidade");
    expect(linhasDe(csv)[1]).toBe("Ana;Recife");
  });

  it("termina as linhas com CRLF", () => {
    expect(semBom(gerarCsv(["a"], [["b"]]))).toBe("a\r\nb");
  });

  describe("escapando valores", () => {
    it("envolve em aspas quando há o separador dentro do texto", () => {
      const csv = gerarCsv(["Nome"], [["Renata; Teixeira"]]);
      expect(linhasDe(csv)[1]).toBe('"Renata; Teixeira"');
    });

    it("duplica aspas internas e envolve o campo", () => {
      const csv = gerarCsv(["Obs"], [['Disse "não sei"']]);
      expect(linhasDe(csv)[1]).toBe('"Disse ""não sei"""');
    });

    it("preserva quebra de linha dentro do campo", () => {
      const csv = gerarCsv(["Obs"], [["primeira\nsegunda"]]);
      expect(semBom(csv)).toBe('Obs\r\n"primeira\nsegunda"');
    });

    it("não envolve em aspas o que não precisa", () => {
      expect(linhasDe(gerarCsv(["a"], [["simples"]]))[1]).toBe("simples");
    });

    it("trata nulo e indefinido como célula vazia", () => {
      const csv = gerarCsv(["a", "b", "c"], [[null, undefined, 0]]);
      expect(linhasDe(csv)[1]).toBe(";;0");
    });
  });

  it("mantém acentuação intacta", () => {
    const csv = gerarCsv(["Cidade"], [["Goiânia"]]);
    expect(csv).toContain("Goiânia");
  });
});

describe("números no formato brasileiro", () => {
  it("usa vírgula como separador decimal", () => {
    expect(numeroBr(72.5, 1)).toBe("72,5");
  });

  it("respeita a quantidade de casas pedida", () => {
    expect(numeroBr(20, 0)).toBe("20");
    expect(numeroBr(20, 2)).toBe("20,00");
  });

  it("devolve vazio para ausência de dado, e não zero", () => {
    // Zero e "não informado" são coisas diferentes: uma candidata com 0 seguidores não
    // é o mesmo que uma cujo dado ainda não foi levantado.
    expect(numeroBr(null)).toBe("");
    expect(numeroBr(undefined)).toBe("");
    expect(numeroBr(0)).toBe("0");
  });
});

describe("datas", () => {
  it("formata no padrão brasileiro", () => {
    expect(dataBr("2026-09-10T12:00:00Z")).toBe("10/09/2026");
  });

  it("devolve vazio quando não há data", () => {
    expect(dataBr(null)).toBe("");
    expect(dataBr(undefined)).toBe("");
  });
});
