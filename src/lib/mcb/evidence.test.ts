import { describe, expect, it } from "vitest";

import {
  EVIDENCE_EXTENSION,
  EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_BYTES,
  formatBytes,
  isEvidenceMimeType,
} from "./evidence";

describe("tipos de arquivo aceitos como evidência", () => {
  it("aceita os três formatos declarados", () => {
    expect(isEvidenceMimeType("image/png")).toBe(true);
    expect(isEvidenceMimeType("image/jpeg")).toBe(true);
    expect(isEvidenceMimeType("image/webp")).toBe(true);
  });

  it("recusa o que não é imagem, mesmo com nome parecido", () => {
    expect(isEvidenceMimeType("image/gif")).toBe(false);
    expect(isEvidenceMimeType("application/pdf")).toBe(false);
    expect(isEvidenceMimeType("image/png; charset=utf-8")).toBe(false);
    expect(isEvidenceMimeType("")).toBe(false);
  });

  it("tem extensão para cada tipo aceito", () => {
    // Se alguém acrescentar um MIME e esquecer a extensão, o caminho no Storage sairia
    // com "undefined" no fim e o arquivo viraria lixo silencioso.
    for (const mime of EVIDENCE_MIME_TYPES) {
      expect(EVIDENCE_EXTENSION[mime]).toBeTruthy();
    }
  });
});

describe("formatação de tamanho", () => {
  it("usa bytes abaixo de 1 KB", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("usa KB até 1 MB", () => {
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("usa MB acima disso, com uma casa decimal", () => {
    expect(formatBytes(MAX_EVIDENCE_BYTES)).toBe("5.0 MB");
  });

  it("mostra travessão quando não há tamanho", () => {
    // Aparece na tela ao lado da miniatura: "0 B" sugeriria arquivo vazio, e o que
    // acontece de fato é que o tamanho não foi registrado.
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(0)).toBe("—");
  });
});
