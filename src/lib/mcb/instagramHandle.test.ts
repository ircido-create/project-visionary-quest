import { describe, expect, it } from "vitest";

import { normalizarHandle, urlDoPerfil } from "./instagramHandle";

describe("normalizar o @ do Instagram", () => {
  it("aceita o @ com ou sem arroba", () => {
    expect(normalizarHandle("igor_nathan_sak")).toBe("igor_nathan_sak");
    expect(normalizarHandle("@igor_nathan_sak")).toBe("igor_nathan_sak");
    expect(normalizarHandle("  @igor_nathan_sak  ")).toBe("igor_nathan_sak");
  });

  it("extrai o usuário do link colado, com barra, www ou parâmetros de rastreio", () => {
    expect(normalizarHandle("https://www.instagram.com/ir_cido/")).toBe("ir_cido");
    expect(normalizarHandle("instagram.com/queel_correa")).toBe("queel_correa");
    expect(normalizarHandle("https://www.instagram.com/michelly.luk?stkn=NGdodWRnenR4NXNy")).toBe(
      "michelly.luk",
    );
    expect(normalizarHandle("https://instagram.com/fulana/reels/")).toBe("fulana");
  });

  it("devolve nulo quando não dá para extrair um usuário válido", () => {
    expect(normalizarHandle("")).toBeNull();
    expect(normalizarHandle("   ")).toBeNull();
    expect(normalizarHandle(null)).toBeNull();
    expect(normalizarHandle("https://www.instagram.com/")).toBeNull();
    expect(normalizarHandle("nome com espaço")).toBeNull();
    expect(normalizarHandle("a".repeat(31))).toBeNull();
  });

  it("monta o link do perfil já normalizado", () => {
    expect(urlDoPerfil("@ir_cido")).toBe("https://instagram.com/ir_cido");
    expect(urlDoPerfil("https://www.instagram.com/ir_cido/")).toBe("https://instagram.com/ir_cido");
    expect(urlDoPerfil("  ")).toBeNull();
  });
});
