import { describe, expect, it } from "vitest";

import {
  DIAS_DE_AVISO,
  DIAS_PARA_EXCLUSAO,
  dataDaExclusao,
  diasAteExclusao,
  diasSemAtividade,
} from "./inatividade";

const agora = new Date("2026-09-13T12:00:00Z");

describe("exclusão por inatividade", () => {
  it("a regra é de 90 dias, com aviso nos 15 anteriores", () => {
    expect(DIAS_PARA_EXCLUSAO).toBe(90);
    expect(DIAS_DE_AVISO).toBe(15);
  });

  it("conta dias inteiros desde a última atividade", () => {
    expect(diasSemAtividade("2026-09-13T08:00:00Z", agora)).toBe(0);
    expect(diasSemAtividade("2026-06-15T12:00:00Z", agora)).toBe(90);
  });

  it("atividade no futuro (relógio adiantado) não vira número negativo", () => {
    expect(diasSemAtividade("2026-09-14T12:00:00Z", agora)).toBe(0);
  });

  it("a exclusão cai 90 dias depois da última atividade", () => {
    expect(dataDaExclusao("2026-06-15T12:00:00Z").slice(0, 10)).toBe("2026-09-13");
  });

  it("quanto falta, sem passar de zero", () => {
    expect(diasAteExclusao("2026-07-15T12:00:00Z", agora)).toBe(30);
    expect(diasAteExclusao("2026-01-01T12:00:00Z", agora)).toBe(0);
  });
});
