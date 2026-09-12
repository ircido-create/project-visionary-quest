import { describe, expect, it } from "vitest";

import {
  contarAbertas,
  dataBR,
  diaMesBR,
  formatarDiferenca,
  formatarNumero,
  pontosSeguidores,
  tarefasConcluidas,
  variacao,
  type PontoEvolucao,
} from "./relatorio";

const ponto = (
  capturedAt: string,
  followers: number | null,
  posts: number | null = null,
  female: number | null = null,
): PontoEvolucao => ({ capturedAt, followers, posts, female });

describe("variação dos números", () => {
  it("compara o primeiro e o último registro com valor", () => {
    const pontos = [
      ponto("2026-05-09T12:00:00Z", 310),
      ponto("2026-07-01T12:00:00Z", null),
      ponto("2026-09-12T12:00:00Z", 560),
    ];
    expect(variacao(pontos, "followers")).toEqual({ inicio: 310, atual: 560, diferenca: 250 });
  });

  it("com um registro só, mostra o valor mas não inventa variação", () => {
    expect(variacao([ponto("2026-09-12T12:00:00Z", 500)], "followers")).toEqual({
      inicio: 500,
      atual: 500,
      diferenca: null,
    });
  });

  it("sem registro nenhum, fica tudo sem medida", () => {
    expect(variacao([ponto("2026-09-12T12:00:00Z", 500)], "female")).toEqual({
      inicio: null,
      atual: null,
      diferenca: null,
    });
  });

  it("mede queda também", () => {
    const pontos = [ponto("a", null, 40), ponto("b", null, 37)];
    expect(variacao(pontos, "posts").diferenca).toBe(-3);
  });
});

describe("formatação", () => {
  it("usa o padrão brasileiro", () => {
    expect(formatarNumero(12400)).toBe("12.400");
    expect(formatarNumero(72.5, 1)).toBe("72,5");
    expect(formatarNumero(null)).toBe("—");
  });

  it("variação com sinal explícito", () => {
    expect(formatarDiferenca(1240)).toBe("+1.240");
    expect(formatarDiferenca(-3)).toBe("−3");
    expect(formatarDiferenca(0)).toBe("0");
    expect(formatarDiferenca(null)).toBe("—");
  });

  it("datas no horário de Brasília", () => {
    expect(dataBR("2026-09-12T02:00:00Z")).toBe("11/09/2026");
    expect(diaMesBR("2026-09-12T15:00:00Z")).toBe("12/09");
  });
});

describe("tarefas", () => {
  const tarefas = [
    { title: "Antiga", status: "CONCLUIDA", completed_at: "2026-08-01T10:00:00Z" },
    { title: "Aberta", status: "PENDENTE", completed_at: null },
    { title: "Recente", status: "CONCLUIDA", completed_at: "2026-09-10T10:00:00Z" },
    { title: "Andando", status: "EM_ANDAMENTO", completed_at: null },
    { title: "Cancelada", status: "CANCELADA", completed_at: null },
  ];

  it("lista as concluídas, da mais recente à mais antiga", () => {
    expect(tarefasConcluidas(tarefas).map((t) => t.title)).toEqual(["Recente", "Antiga"]);
  });

  it("conta como abertas só pendentes e em andamento", () => {
    expect(contarAbertas(tarefas)).toBe(2);
  });
});

describe("gráfico", () => {
  it("usa só os registros com seguidores, com a data curta", () => {
    const r = pontosSeguidores([
      ponto("2026-05-09T12:00:00Z", 310),
      ponto("2026-07-01T12:00:00Z", null),
      ponto("2026-09-12T12:00:00Z", 560),
    ]);
    expect(r).toEqual([
      { data: "09/05", seguidores: 310 },
      { data: "12/09", seguidores: 560 },
    ]);
  });
});
