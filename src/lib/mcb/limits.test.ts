import { describe, expect, it } from "vitest";

import {
  garantirEspacoParaAnalise,
  garantirEspacoParaArquivo,
  garantirEspacoParaCandidata,
  garantirEspacoParaMembro,
} from "./limits";

/**
 * Dublê do cliente Supabase.
 *
 * As funções de limite encadeiam `.select().eq().is().gte()` e às vezes terminam em
 * `.maybeSingle()`, às vezes no próprio await. O dublê devolve o mesmo objeto em toda
 * chamada encadeada e é "thenable", o que cobre os dois finais sem precisar imitar a
 * assinatura inteira do supabase-js.
 */
type Resposta = { data?: unknown; count?: number };

function fakeSupabase(porTabela: Record<string, Resposta>) {
  const from = (tabela: string) => {
    const resultado = porTabela[tabela] ?? { data: null, count: 0 };
    const alvo: Record<string, unknown> = {
      select: () => alvo,
      eq: () => alvo,
      is: () => alvo,
      gte: () => alvo,
      maybeSingle: () => Promise.resolve(resultado),
      then: (ok: (v: Resposta) => unknown, erro?: (e: unknown) => unknown) =>
        Promise.resolve(resultado).then(ok, erro),
    };
    return alvo;
  };
  return { from } as unknown as Parameters<typeof garantirEspacoParaCandidata>[0];
}

const AMBIENTE = "11111111-1111-4111-8111-111111111111";

const PLANO_ESSENCIAL = {
  id: "p1",
  name: "Essencial",
  max_candidates: 25,
  max_members: 2,
  max_ai_analyses: 20,
  storage_mb: 1,
};

/** Base comum: o ambiente aponta para o plano Essencial. */
const comPlano = (extras: Record<string, Resposta>) =>
  fakeSupabase({
    tenants: { data: { plan_id: PLANO_ESSENCIAL.id } },
    plans: { data: PLANO_ESSENCIAL },
    ...extras,
  });

describe("limites por plano", () => {
  describe("ambiente sem plano atribuído", () => {
    it("não bloqueia nenhuma das quatro ações", async () => {
      const semPlano = fakeSupabase({ tenants: { data: { plan_id: null } } });

      await expect(garantirEspacoParaCandidata(semPlano, AMBIENTE)).resolves.toBeUndefined();
      await expect(garantirEspacoParaMembro(semPlano, AMBIENTE)).resolves.toBeUndefined();
      await expect(garantirEspacoParaAnalise(semPlano, AMBIENTE)).resolves.toBeUndefined();
      await expect(
        garantirEspacoParaArquivo(semPlano, AMBIENTE, 999_999_999),
      ).resolves.toBeUndefined();
    });
  });

  describe("candidatas", () => {
    it("permite abaixo do limite", async () => {
      const db = comPlano({ influencers: { count: 24 } });
      await expect(garantirEspacoParaCandidata(db, AMBIENTE)).resolves.toBeUndefined();
    });

    it("recusa ao atingir o limite, e não só ao passar dele", async () => {
      const db = comPlano({ influencers: { count: 25 } });
      await expect(garantirEspacoParaCandidata(db, AMBIENTE)).rejects.toThrow(/25 candidatas/);
    });

    it("diz o plano, o limite e quanto já existe", async () => {
      const db = comPlano({ influencers: { count: 25 } });
      await expect(garantirEspacoParaCandidata(db, AMBIENTE)).rejects.toThrow(
        /Essencial.*25.*já tem 25/s,
      );
    });
  });

  describe("equipe", () => {
    it("conta convite pendente como vaga ocupada", async () => {
      // 1 membro + 1 convite = 2, que é o limite do Essencial.
      const db = comPlano({
        tenant_memberships: { count: 1 },
        invitations: { count: 1 },
      });
      await expect(garantirEspacoParaMembro(db, AMBIENTE)).rejects.toThrow(/pessoas na equipe/);
    });

    it("permite quando membros e convites somados ainda cabem", async () => {
      const db = comPlano({
        tenant_memberships: { count: 1 },
        invitations: { count: 0 },
      });
      await expect(garantirEspacoParaMembro(db, AMBIENTE)).resolves.toBeUndefined();
    });
  });

  describe("análises de IA", () => {
    it("permite abaixo do teto mensal", async () => {
      const db = comPlano({ ai_analyses: { count: 19 } });
      await expect(garantirEspacoParaAnalise(db, AMBIENTE)).resolves.toBeUndefined();
    });

    it("recusa no teto e avisa que o limite é mensal", async () => {
      const db = comPlano({ ai_analyses: { count: 20 } });
      await expect(garantirEspacoParaAnalise(db, AMBIENTE)).rejects.toThrow(
        /20 análises por mês.*reinicia no dia 1º/s,
      );
    });
  });

  describe("armazenamento", () => {
    const UM_MB = 1024 * 1024;

    it("permite quando o arquivo cabe exatamente no teto", async () => {
      const db = comPlano({ files: { data: [{ size_bytes: UM_MB / 2 }] } });
      await expect(garantirEspacoParaArquivo(db, AMBIENTE, UM_MB / 2)).resolves.toBeUndefined();
    });

    it("recusa quando o arquivo faria passar do teto por um byte", async () => {
      const db = comPlano({ files: { data: [{ size_bytes: UM_MB / 2 }] } });
      await expect(garantirEspacoParaArquivo(db, AMBIENTE, UM_MB / 2 + 1)).rejects.toThrow(
        /1 MB de arquivos/,
      );
    });

    it("soma os arquivos existentes em vez de olhar só o novo", async () => {
      const db = comPlano({
        files: { data: [{ size_bytes: UM_MB / 2 }, { size_bytes: UM_MB / 2 }] },
      });
      await expect(garantirEspacoParaArquivo(db, AMBIENTE, 1)).rejects.toThrow(/já usa 1.0 MB/);
    });

    it("ignora tamanho nulo em vez de quebrar a soma", async () => {
      const db = comPlano({ files: { data: [{ size_bytes: null }, { size_bytes: 10 }] } });
      await expect(garantirEspacoParaArquivo(db, AMBIENTE, 10)).resolves.toBeUndefined();
    });
  });
});
