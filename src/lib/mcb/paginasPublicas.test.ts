import { describe, expect, it } from "vitest";

import { ordenarPaginas, paginaPrincipal } from "./paginasPublicas";

const pagina = (slug: string, is_demo: boolean) => ({ name: slug, slug, is_demo });

describe("páginas públicas de candidatura", () => {
  it("põe as reais antes das demonstrações, mantendo a ordem de cada grupo", () => {
    const r = ordenarPaginas([
      pagina("demo-a", true),
      pagina("real-1", false),
      pagina("demo-b", true),
      pagina("real-2", false),
    ]);
    expect(r.map((p) => p.slug)).toEqual(["real-1", "real-2", "demo-a", "demo-b"]);
  });

  it("o botão principal abre a primeira página real, mesmo criada depois de uma demonstração", () => {
    expect(paginaPrincipal([pagina("demo-a", true), pagina("real-1", false)])?.slug).toBe("real-1");
  });

  it("sem página real, abre a demonstração, que não aceita envio", () => {
    expect(paginaPrincipal([pagina("demo-a", true)])?.slug).toBe("demo-a");
  });

  it("sem página nenhuma, não há botão", () => {
    expect(paginaPrincipal([])).toBeNull();
  });
});
