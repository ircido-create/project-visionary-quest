/**
 * Fase 5 — Modelos de tarefa por nível: leitura, edição da biblioteca e criação das
 * tarefas escolhidas pela gestora.
 *
 * QUEM FAZ O QUÊ
 *
 * - Editar a biblioteca: a dona e a administradora do ambiente. As políticas do banco
 *   deixam qualquer membro gravar em `task_templates`, então a regra de papel mora aqui,
 *   conferida por `has_tenant_role`, como na auditoria.
 * - Criar tarefas a partir dos modelos: qualquer membro, como já acontece com a tarefa
 *   criada à mão.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "@/lib/mcb/audit";
import {
  CONJUNTO_INICIAL,
  NIVEIS,
  PRAZO_MAXIMO_DIAS,
  modelosQueFaltam,
  normalizarTitulo,
  prazoDoModelo,
  type ModeloTarefa,
} from "@/lib/mcb/modelosTarefa";

type Cliente = Parameters<typeof audit>[0];

const PAPEIS_QUE_EDITAM = ["manager_owner", "manager_admin"] as const;
const SO_QUEM_EDITA = "Só a dona ou a administradora do ambiente edita os modelos de tarefa.";
const CAMPOS = "id, level, title, description, due_in_days, priority, sort_order";

async function podeEditar(supabase: Cliente, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_tenant_role", {
    _tenant: tenantId,
    _roles: [...PAPEIS_QUE_EDITAM],
  });
  if (error) throw new Error(error.message);
  return data === true;
}

const nivel = z.string().refine((v) => NIVEIS.includes(v), "Esse nível não existe na jornada.");

export const listarModelosTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: modelos, error }, pode] = await Promise.all([
      supabase
        .from("task_templates")
        .select(CAMPOS)
        .eq("tenant_id", data.tenantId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      podeEditar(supabase, data.tenantId),
    ]);
    if (error) throw new Error(error.message);
    return { modelos: (modelos ?? []) as ModeloTarefa[], podeEditar: pode };
  });

export const salvarModeloTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      id?: string | undefined;
      level: string;
      title: string;
      description?: string | undefined;
      dueInDays: number | null;
      priority: "BAIXA" | "MEDIA" | "ALTA";
    }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          id: z.string().uuid().optional(),
          level: nivel,
          title: z.string().trim().min(3).max(160),
          description: z.string().trim().max(1000).optional(),
          dueInDays: z.number().int().min(0).max(PRAZO_MAXIMO_DIAS).nullable(),
          priority: z.enum(["BAIXA", "MEDIA", "ALTA"]),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await podeEditar(supabase, data.tenantId))) throw new Error(SO_QUEM_EDITA);

    // Dois modelos com o mesmo título no mesmo nível viram duas sugestões iguais.
    const { data: doNivel, error: erroLeitura } = await supabase
      .from("task_templates")
      .select("id, title, sort_order")
      .eq("tenant_id", data.tenantId)
      .eq("level", data.level);
    if (erroLeitura) throw new Error(erroLeitura.message);
    const titulo = normalizarTitulo(data.title);
    if ((doNivel ?? []).some((m) => m.id !== data.id && normalizarTitulo(m.title) === titulo)) {
      throw new Error("Já existe um modelo com esse título neste nível.");
    }

    const campos = {
      level: data.level,
      title: data.title,
      description: data.description || null,
      due_in_days: data.dueInDays,
      priority: data.priority,
    };

    let modeloId = data.id ?? null;
    if (data.id) {
      const { data: linhas, error } = await supabase
        .from("task_templates")
        .update(campos)
        .eq("tenant_id", data.tenantId)
        .eq("id", data.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!linhas || linhas.length === 0) throw new Error("Modelo não encontrado neste ambiente.");
    } else {
      const ultima = Math.max(-1, ...(doNivel ?? []).map((m) => m.sort_order));
      const { data: criado, error } = await supabase
        .from("task_templates")
        .insert({ tenant_id: data.tenantId, ...campos, sort_order: ultima + 1 })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      modeloId = criado.id;
    }

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: data.id ? "task_template.updated" : "task_template.created",
      entity: "task_templates",
      entity_id: modeloId,
      meta: { level: data.level, title: data.title },
    });
    return { ok: true };
  });

export const removerModeloTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; id: string }) =>
    z.object({ tenantId: z.string().uuid(), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await podeEditar(supabase, data.tenantId))) throw new Error(SO_QUEM_EDITA);

    // As tarefas já criadas a partir dele continuam; perdem só o vínculo (on delete set null).
    const { data: linhas, error } = await supabase
      .from("task_templates")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("id", data.id)
      .select("id, title");
    if (error) throw new Error(error.message);
    if (!linhas || linhas.length === 0) throw new Error("Modelo não encontrado neste ambiente.");

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "task_template.deleted",
      entity: "task_templates",
      entity_id: data.id,
      meta: { title: linhas[0]?.title ?? null },
    });
    return { ok: true };
  });

/** Carrega o conjunto inicial do método, pulando o que o ambiente já tem. */
export const carregarConjuntoInicial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await podeEditar(supabase, data.tenantId))) throw new Error(SO_QUEM_EDITA);

    const { data: existentes, error: erroLeitura } = await supabase
      .from("task_templates")
      .select("level, title")
      .eq("tenant_id", data.tenantId);
    if (erroLeitura) throw new Error(erroLeitura.message);
    const ja = new Set((existentes ?? []).map((m) => `${m.level}|${normalizarTitulo(m.title)}`));

    const ordem = new Map<string, number>();
    const novos = CONJUNTO_INICIAL.filter(
      (m) => !ja.has(`${m.level}|${normalizarTitulo(m.title)}`),
    ).map((m) => {
      const posicao = ordem.get(m.level) ?? 0;
      ordem.set(m.level, posicao + 1);
      return {
        tenant_id: data.tenantId,
        level: m.level,
        title: m.title,
        description: m.description,
        due_in_days: m.dueInDays,
        priority: m.priority,
        sort_order: posicao,
      };
    });
    if (novos.length === 0) return { criados: 0 };

    const { error } = await supabase.from("task_templates").insert(novos);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "task_template.conjunto_inicial",
      entity: "task_templates",
      meta: { quantidade: novos.length },
    });
    return { criados: novos.length };
  });

/** Cria, para a candidata, as tarefas dos modelos que a gestora marcou. */
export const criarTarefasDeModelos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; influencerId: string; modeloIds: string[] }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        influencerId: z.string().uuid(),
        modeloIds: z.array(z.string().uuid()).min(1).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [candidata, modelos, tarefas] = await Promise.all([
      supabase
        .from("influencers")
        .select("id")
        .eq("tenant_id", data.tenantId)
        .eq("id", data.influencerId)
        .maybeSingle(),
      supabase
        .from("task_templates")
        .select(CAMPOS)
        .eq("tenant_id", data.tenantId)
        .in("id", data.modeloIds),
      supabase
        .from("tasks")
        .select("title, template_id")
        .eq("tenant_id", data.tenantId)
        .eq("influencer_id", data.influencerId),
    ]);
    for (const r of [candidata, modelos, tarefas]) if (r.error) throw new Error(r.error.message);
    if (!candidata.data) throw new Error("Candidata não encontrada neste ambiente.");

    // Dois cliques, ou duas abas abertas, não duplicam a tarefa.
    const faltam = modelosQueFaltam((modelos.data ?? []) as ModeloTarefa[], tarefas.data ?? []);
    if (faltam.length === 0) return { criadas: 0 };

    const { error } = await supabase.from("tasks").insert(
      faltam.map((m) => ({
        tenant_id: data.tenantId,
        influencer_id: data.influencerId,
        title: m.title,
        description: m.description,
        level: m.level,
        due_date: prazoDoModelo(m.due_in_days),
        priority: m.priority,
        template_id: m.id,
        created_by: userId,
      })),
    );
    if (error) throw new Error(error.message);

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "tasks.criadas_de_modelo",
      entity: "influencers",
      entity_id: data.influencerId,
      meta: { modelos: faltam.map((m) => m.id), quantidade: faltam.length },
    });
    return { criadas: faltam.length };
  });
