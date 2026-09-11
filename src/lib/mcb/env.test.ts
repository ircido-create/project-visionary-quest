import { describe, expect, it } from "vitest";

import { mesclarAmbiente, nomesPresentes, somenteTexto } from "./env";

describe("leitura dos bindings do Worker", () => {
  it("fica só com texto, descartando bindings que são objetos", () => {
    const bindings = { GEMINI_API_KEY: "chave", ASSETS: { fetch: () => null }, PORTA: 3 };
    expect(somenteTexto(bindings)).toEqual({ GEMINI_API_KEY: "chave" });
  });

  it("aceita ausência de bindings sem quebrar", () => {
    expect(somenteTexto(undefined)).toEqual({});
    expect(somenteTexto(null)).toEqual({});
  });
});

describe("mescla de process.env com os bindings", () => {
  it("usa o binding quando process.env não tem o nome", () => {
    expect(mesclarAmbiente({}, { META_APP_ID: "123" })["META_APP_ID"]).toBe("123");
  });

  it("dá prioridade a process.env, que é o comportamento anterior", () => {
    const r = mesclarAmbiente({ SUPABASE_URL: "do-processo" }, { SUPABASE_URL: "do-binding" });
    expect(r["SUPABASE_URL"]).toBe("do-processo");
  });

  it("não deixa um valor vazio em process.env esconder o binding", () => {
    expect(mesclarAmbiente({ META_APP_ID: "  " }, { META_APP_ID: "123" })["META_APP_ID"]).toBe(
      "123",
    );
  });
});

describe("nomes presentes", () => {
  it("lista só nomes com valor, e nunca o valor", () => {
    const r = nomesPresentes({ A: "segredo", B: " ", C: undefined }, ["A", "B", "C", "D"]);
    expect(r).toEqual(["A"]);
    expect(JSON.stringify(r)).not.toContain("segredo");
  });
});
