/**
 * Fase 2 (item 3) — Portal da candidata.
 *
 * Tudo aqui passa pelas funções `security definer` criadas em
 * supabase/migrations/20260909210000_fase2_portal_candidata.sql. A candidata **não é
 * membro do ambiente** — se fosse, as políticas da fase 1 deixariam ela ler os dados
 * de todas as outras candidatas, inclusive as notas internas da gestora.
 *
 * O que ela pode ver e mudar está definido naquelas funções, não aqui.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalTask = {
  id: string;
  titulo: string;
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
  prioridade: "BAIXA" | "MEDIA" | "ALTA";
  prazo: string | null;
};

export type PortalSnapshot = {
  data: string;
  seguidores: number | null;
  publicacoes: number | null;
};

export type PortalApplication = {
  id: string;
  gestora: string;
  nome: string;
  status: string;
  nivel: string;
  progresso: number;
  criada_em: string;
  metricas: {
    seguidores: number | null;
    publicacoes: number | null;
    publico_feminino_pct: number | null;
  };
  tarefas: PortalTask[];
  evolucao: PortalSnapshot[];
  feedbacks: Array<{ texto: string; data: string }>;
};

/** Vincula a conta pelo e-mail (idempotente) e devolve as candidaturas dela. */
export const getPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Roda sempre: é barato, idempotente, e cobre o caso de a candidata se cadastrar
    // antes de a gestora registrar a candidatura dela.
    const { error: linkError } = await context.supabase.rpc("link_influencer_account");
    if (linkError) throw new Error(linkError.message);

    const { data, error } = await context.supabase.rpc("get_portal_data");
    if (error) throw new Error(error.message);

    return { applications: (data ?? []) as PortalApplication[] };
  });

/** A candidata marca a própria tarefa. A função no banco só deixa mudar o status. */
export const setPortalTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { taskId: string; status: "PENDENTE" | "CONCLUIDA" }) =>
    z
      .object({
        taskId: z.string().uuid(),
        status: z.enum(["PENDENTE", "CONCLUIDA"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase.rpc("influencer_set_task_status", {
      _task: data.taskId,
      _status: data.status,
    });
    if (error) throw new Error(error.message);
    if (updated !== true) throw new Error("Esta tarefa não é sua.");

    return { ok: true };
  });

/**
 * Para onde mandar a pessoa depois do login.
 *
 * Candidata vai para o portal; gestora vai para o painel. Quem é as duas coisas
 * (gestora que também se candidatou) vai para o painel, porque é o ambiente que ela
 * administra. Na dúvida vai para o painel: erro aqui não pode impedir o login.
 */
export const resolveLanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    try {
      // Vincula antes de decidir: no primeiro login a candidatura ainda não tem dono.
      await context.supabase.rpc("link_influencer_account");

      const { data: memberships } = await context.supabase
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", userId)
        .limit(1);

      if ((memberships ?? []).length > 0) {
        return { to: "dashboard" as const };
      }

      const { data } = await context.supabase.rpc("get_portal_data");
      const applications = (data ?? []) as unknown[];

      return { to: applications.length > 0 ? ("portal" as const) : ("dashboard" as const) };
    } catch {
      return { to: "dashboard" as const };
    }
  });
