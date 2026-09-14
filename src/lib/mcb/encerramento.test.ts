import { describe, expect, it } from "vitest";

import {
  confirmacaoDoAmbienteConfere,
  nomeDoArquivoDeExportacao,
  resumoDaExclusaoDoAmbiente,
} from "./encerramento";

describe("encerrar o ambiente", () => {
  it("a confirmação aceita o nome com outra caixa e espaços, e nada além disso", () => {
    expect(confirmacaoDoAmbienteConfere("  equipe   blessing ", "Equipe Blessing")).toBe(true);
    expect(confirmacaoDoAmbienteConfere("Equipe Bless", "Equipe Blessing")).toBe(false);
    expect(confirmacaoDoAmbienteConfere("", "")).toBe(false);
    expect(confirmacaoDoAmbienteConfere("   ", "Equipe Blessing")).toBe(false);
  });

  it("o arquivo exportado leva o endereço do ambiente e a data", () => {
    expect(nomeDoArquivoDeExportacao("blessing", new Date("2026-09-14T12:00:00Z"))).toBe(
      "mcb-blessing-2026-09-14.json",
    );
  });

  it("o resumo diz só o que havia, no singular e no plural", () => {
    expect(resumoDaExclusaoDoAmbiente({ candidatas: 2, tarefas: 1, arquivos: 0, membros: 1 })).toBe(
      "2 candidatas, 1 tarefa, 1 pessoa da equipe",
    );
    expect(resumoDaExclusaoDoAmbiente({ candidatas: 0 })).toBe("o ambiente estava vazio");
  });
});
