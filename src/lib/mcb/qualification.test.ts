import { describe, expect, it } from "vitest";

import { evaluateQualification, formatarValorAtual } from "./qualification";

const qualified = {
  followers: 1200,
  postsCount: 45,
  recentPosts6m: "SIM" as const,
  profileType: "CRIADOR" as const,
  femaleAudiencePct: 62,
};

describe("motor determinístico de qualificação", () => {
  it("qualifica quando todos os critérios são atendidos", () => {
    const result = evaluateQualification(qualified);
    expect(result.status).toBe("QUALIFIED");
    expect(result.requirements.every((r) => r.status === "PASS")).toBe(true);
  });

  it("reprova com menos de 500 seguidores", () => {
    const result = evaluateQualification({ ...qualified, followers: 499 });
    expect(result.status).toBe("NOT_QUALIFIED");
    expect(result.requirements.find((r) => r.key === "followers")?.status).toBe("FAIL");
  });

  it("exige mais de 30 publicações", () => {
    expect(evaluateQualification({ ...qualified, postsCount: 30 }).status).toBe("NOT_QUALIFIED");
    expect(evaluateQualification({ ...qualified, postsCount: 31 }).status).toBe("QUALIFIED");
  });

  it("exige público feminino estritamente acima de 50%", () => {
    expect(evaluateQualification({ ...qualified, femaleAudiencePct: 50 }).status).toBe("NOT_QUALIFIED");
    expect(evaluateQualification({ ...qualified, femaleAudiencePct: 50.1 }).status).toBe("QUALIFIED");
  });

  it("exige perfil de criador de conteúdo", () => {
    expect(evaluateQualification({ ...qualified, profileType: "PESSOAL" }).status).toBe("NOT_QUALIFIED");
  });

  it("nunca qualifica com dado ausente e pede evidência", () => {
    const result = evaluateQualification({ ...qualified, followers: null });
    expect(result.status).toBe("NEEDS_EVIDENCE");
    expect(result.requirements.find((r) => r.key === "followers")?.status).toBe("UNKNOWN");
  });

  it("trata 'NAO_SEI' de publicações recentes como pendência, não como falha", () => {
    const result = evaluateQualification({ ...qualified, recentPosts6m: "NAO_SEI" });
    expect(result.status).toBe("NEEDS_EVIDENCE");
  });

  it("mantém o progresso entre 0 e 100", () => {
    const low = evaluateQualification({
      followers: 0,
      postsCount: 0,
      recentPosts6m: "NAO",
      profileType: "PESSOAL",
      femaleAudiencePct: 10,
    });
    expect(low.progress.score).toBeGreaterThanOrEqual(0);
    expect(evaluateQualification(qualified).progress.score).toBeLessThanOrEqual(100);
  });
});

describe("exibição dos valores dos requisitos", () => {
  const valor = (key: string, entrada: Parameters<typeof evaluateQualification>[0]) =>
    evaluateQualification(entrada).requirements.find((r) => r.key === key);

  it("mostra o público feminino no formato brasileiro", () => {
    expect(valor("female_audience", { ...qualified, femaleAudiencePct: 72.5 })?.currentValue).toBe(
      "72,5%",
    );
    expect(valor("female_audience", { ...qualified, femaleAudiencePct: 48.5 })?.gap).toBe(
      "precisa ultrapassar 50% (hoje 48,5%)",
    );
  });

  it("formata números com separador de milhar e deixa texto como está", () => {
    expect(formatarValorAtual(12400)).toBe("12.400");
    expect(formatarValorAtual("Sim")).toBe("Sim");
    expect(formatarValorAtual(null)).toBeNull();
  });

  it("não muda a regra: 50,1% continua qualificando", () => {
    expect(evaluateQualification({ ...qualified, femaleAudiencePct: 50.1 }).status).toBe(
      "QUALIFIED",
    );
  });
});
