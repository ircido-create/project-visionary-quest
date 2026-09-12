import { motivoBloqueioSeletor } from "@/lib/mcb/auditoria";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "@/lib/mcb/audit";
import { garantirEspacoParaMembro } from "@/lib/mcb/limits";
import { evaluateQualification, type ProgressSignals } from "@/lib/mcb/qualification";
import type { Database, Json } from "@/integrations/supabase/types";

type InfluencerRow = Database["public"]["Tables"]["influencers"]["Row"];
type InfluencerStatus = Database["public"]["Enums"]["influencer_status"];

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);

/** Espaços de trabalho da usuária: gestoras em que participa + ambientes de demonstração. */
export const getWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: memberships }, { data: demoTenants }, { data: profile }] = await Promise.all([
      supabase.from("tenant_memberships").select("tenant_id, role").eq("user_id", userId),
      supabase.from("tenants").select("id, name, slug, is_demo, plan_id, status").eq("is_demo", true).order("created_at"),
      supabase.from("profiles").select("id, full_name, email, avatar_url").eq("id", userId).maybeSingle(),
    ]);

    const ownTenantIds = (memberships ?? []).map((m) => m.tenant_id);
    let ownTenants: Array<{ id: string; name: string; slug: string; is_demo: boolean; plan_id: string | null; status: string }> = [];
    if (ownTenantIds.length > 0) {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, is_demo, plan_id, status")
        .in("id", ownTenantIds);
      ownTenants = data ?? [];
    }

    return {
      profile: profile ?? null,
      memberships: (memberships ?? []).map((m) => ({ tenantId: m.tenant_id, role: m.role })),
      tenants: [
        ...ownTenants.map((t) => ({ ...t, readOnly: false })),
        ...(demoTenants ?? [])
          .filter((t) => !ownTenantIds.includes(t.id))
          .map((t) => ({ ...t, readOnly: true })),
      ],
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string; email: string; avatarUrl?: string }) =>
    z
      .object({
        fullName: z.string().trim().max(120),
        email: z.string().trim().email().max(160),
        avatarUrl: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      full_name: data.fullName,
      email: data.email,
      avatar_url: data.avatarUrl?.length ? data.avatarUrl : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; slug?: string; managerName?: string; bio?: string }) =>
    z
      .object({
        name: z.string().trim().min(3).max(80),
        slug: z.string().trim().max(48).optional(),
        managerName: z.string().trim().max(80).optional(),
        bio: z.string().trim().max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const base = slugify(data.slug || data.name) || `gestora-${Date.now()}`;

    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("code", "essencial")
      .maybeSingle();

    // O id é gerado aqui, e não lido de volta do banco, de propósito.
    //
    // Encadear `.select()` num insert faz o PostgREST usar RETURNING, e o Postgres
    // aplica a política de SELECT à linha nova. A de `tenants` é can_read_tenant(id),
    // que exige membresia — criada só no passo seguinte. Ou seja: a linha entrava e a
    // leitura de volta era negada, com a mensagem enganosa "new row violates row-level
    // security policy", que parece rejeição do insert e não é.
    const tenantId = crypto.randomUUID();

    // O laço de slug abaixo enxerga, sob RLS, apenas ambientes de demonstração e os
    // desta usuária. Colisão com o slug de outra gestora é invisível aqui e chega como
    // violação de unicidade (23505) no insert — por isso o retry trata os dois casos.
    let slug = base;
    let created = false;
    for (let attempt = 0; attempt < 6 && !created; attempt += 1) {
      if (attempt > 0) slug = `${base}-${attempt}`;

      const { data: taken } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (taken) continue;

      const { error } = await supabase.from("tenants").insert({
        id: tenantId,
        name: data.name,
        slug,
        created_by: userId,
        plan_id: plan?.id ?? null,
      });

      if (!error) {
        created = true;
      } else if (error.code !== "23505") {
        throw new Error(error.message);
      }
    }

    if (!created) {
      throw new Error("Não foi possível criar o ambiente: o endereço já está em uso.");
    }

    // A partir daqui a membresia existe e can_read_tenant passa a valer para ela.
    const { error: membershipError } = await supabase
      .from("tenant_memberships")
      .insert({ tenant_id: tenantId, user_id: userId, role: "manager_owner" });
    if (membershipError) throw new Error(membershipError.message);

    await supabase.from("tenant_branding").insert({
      tenant_id: tenantId,
      manager_name: data.managerName ?? data.name,
      headline: "Do perfil pessoal à criadora de conteúdo pronta para análise.",
      subheadline:
        "Uma jornada prática para estruturar seu perfil, desenvolver presença, criar conexão e alcançar os requisitos necessários com autenticidade.",
      authority_quote:
        "Antes de ensinar você a vender uma marca, vamos ensinar você a construir a sua.",
      bio: data.bio ?? null,
    });

    return { id: tenantId, slug };
  });

function signalsFor(influencer: InfluencerRow): ProgressSignals {
  const filled = (value: string | null) => Boolean(value && value.trim().length > 8);
  return {
    nicheDefined: filled(influencer.topics),
    bioReady: filled(influencer.profile_goal),
    profileOrganized: influencer.profile_type === "CRIADOR",
    storiesActive:
      influencer.stories_frequency === "Todos os dias" ||
      influencer.stories_frequency === "Algumas vezes por semana",
    consistentContent:
      influencer.reels_frequency === "Frequentemente" || influencer.reels_frequency === "Às vezes",
  };
}

export function evaluateInfluencer(influencer: InfluencerRow) {
  return evaluateQualification(
    {
      followers: influencer.followers,
      postsCount: influencer.posts_count,
      recentPosts6m: influencer.recent_posts_6m,
      profileType: influencer.profile_type,
      femaleAudiencePct: influencer.female_audience_pct === null ? null : Number(influencer.female_audience_pct),
      source: influencer.data_source,
      capturedAt: influencer.updated_at,
    },
    signalsFor(influencer),
  );
}

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: influencers }, { data: tasks }] = await Promise.all([
      supabase.from("influencers").select("*").eq("tenant_id", data.tenantId).order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("id, title, due_date, status, influencer_id, priority")
        .eq("tenant_id", data.tenantId)
        .neq("status", "CONCLUIDA"),
    ]);

    const rows = influencers ?? [];
    const evaluated = rows.map((row) => ({ influencer: row, evaluation: evaluateInfluencer(row) }));
    const today = new Date().toISOString().slice(0, 10);

    const countStatus = (statuses: InfluencerStatus[]) =>
      rows.filter((r) => statuses.includes(r.status)).length;

    const nearGoal = evaluated
      .filter((e) => e.evaluation.status !== "QUALIFIED")
      .sort((a, b) => b.evaluation.progress.score - a.evaluation.progress.score)
      .slice(0, 5)
      .map((e) => ({
        id: e.influencer.id,
        name: e.influencer.full_name,
        score: e.evaluation.progress.score,
        pending: e.evaluation.requirements.filter((r) => r.status !== "PASS").length,
      }));

    const growth = rows
      .filter((r) => r.followers !== null && r.initial_followers !== null)
      .map((r) => (r.followers ?? 0) - (r.initial_followers ?? 0));

    const funnel = [
      { key: "entrada", label: "Entrada", value: rows.length },
      { key: "estruturando", label: "Estruturando", value: countStatus(["EM_ESTRUTURACAO", "AGUARDANDO_DIAGNOSTICO"]) },
      { key: "produzindo", label: "Produzindo", value: countStatus(["EM_PRODUCAO"]) },
      { key: "crescendo", label: "Crescendo", value: countStatus(["EM_CRESCIMENTO"]) },
      { key: "auditoria", label: "Auditoria", value: countStatus(["PRONTA_AUDITORIA"]) },
      { key: "qualificadas", label: "Qualificadas", value: countStatus(["QUALIFICADA", "ENVIADA_ANALISE", "APROVADA"]) },
    ];

    return {
      totals: {
        candidates: rows.length,
        newApplications: rows.filter(
          (r) => new Date(r.created_at).getTime() > Date.now() - 1000 * 60 * 60 * 24 * 14,
        ).length,
        qualified: evaluated.filter((e) => e.evaluation.status === "QUALIFIED").length,
        developing: countStatus(["EM_ESTRUTURACAO", "EM_PRODUCAO", "EM_CRESCIMENTO"]),
        waitingData: evaluated.filter((e) => e.evaluation.status === "NEEDS_EVIDENCE").length,
        readyForAudit: countStatus(["PRONTA_AUDITORIA"]),
        lateTasks: (tasks ?? []).filter((t) => t.due_date !== null && t.due_date < today).length,
        openTasks: (tasks ?? []).length,
        averageGrowth: growth.length
          ? Math.round(growth.reduce((sum, value) => sum + value, 0) / growth.length)
          : 0,
      },
      funnel,
      nearGoal,
      // Fila da Fase 5: candidatas esperando a decisão de auditoria.
      awaitingAudit: rows
        .filter((r) => r.status === "PRONTA_AUDITORIA")
        .slice(0, 6)
        .map((r) => ({ id: r.id, name: r.full_name })),
      lateTasks: (tasks ?? [])
        .filter((t) => t.due_date !== null && t.due_date < today)
        .slice(0, 6)
        .map((t) => ({ id: t.id, title: t.title, dueDate: t.due_date, influencerId: t.influencer_id })),
      evolution: rows
        .slice(0, 30)
        .map((r) => ({ name: r.full_name.split(" ")[0], seguidores: r.followers ?? 0, meta: 500 })),
    };
  });

export const listInfluencers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("influencers")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => {
      const evaluation = evaluateInfluencer(row);
      return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        city: row.city,
        state: row.state,
        instagramHandle: row.instagram_handle,
        followers: row.followers,
        postsCount: row.posts_count,
        femaleAudiencePct: row.female_audience_pct === null ? null : Number(row.female_audience_pct),
        status: row.status,
        level: evaluation.progress.level,
        score: evaluation.progress.score,
        qualification: evaluation.status,
        pendingRequirements: evaluation.requirements.filter((r) => r.status !== "PASS").length,
        createdAt: row.created_at,
      };
    });
  });

export const getInfluencer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; influencerId: string }) =>
    z.object({ tenantId: z.string().uuid(), influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: influencer, error } = await supabase
      .from("influencers")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!influencer) return null;

    const [snapshots, tasks, notes, feedbacks, history, application] = await Promise.all([
      supabase
        .from("metric_snapshots")
        .select("*")
        .eq("tenant_id", data.tenantId)
        .eq("influencer_id", data.influencerId)
        .order("captured_at", { ascending: true }),
      supabase
        .from("tasks")
        .select("*")
        .eq("tenant_id", data.tenantId)
        .eq("influencer_id", data.influencerId)
        .order("due_date", { ascending: true }),
      supabase
        .from("notes")
        .select("*")
        .eq("tenant_id", data.tenantId)
        .eq("influencer_id", data.influencerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("feedbacks")
        .select("*")
        .eq("tenant_id", data.tenantId)
        .eq("influencer_id", data.influencerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("status_history")
        .select("*")
        .eq("tenant_id", data.tenantId)
        .eq("influencer_id", data.influencerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("applications")
        .select("answers, submitted_at")
        .eq("tenant_id", data.tenantId)
        .eq("influencer_id", data.influencerId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      influencer: {
        ...influencer,
        female_audience_pct:
          influencer.female_audience_pct === null ? null : Number(influencer.female_audience_pct),
        progress_score: Number(influencer.progress_score),
      },
      evaluation: evaluateInfluencer(influencer),
      snapshots: (snapshots.data ?? []).map((s) => ({
        capturedAt: s.captured_at,
        followers: s.followers,
        posts: s.posts_count,
        female: s.female_audience_pct === null ? null : Number(s.female_audience_pct),
        source: s.source,
      })),
      tasks: tasks.data ?? [],
      notes: notes.data ?? [],
      feedbacks: feedbacks.data ?? [],
      history: history.data ?? [],
      application: application.data ?? null,
    };
  });

export const updateInfluencerMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      influencerId: string;
      followers: number | null;
      postsCount: number | null;
      femaleAudiencePct: number | null;
      recentPosts6m: "SIM" | "NAO" | "NAO_SEI";
      profileType: "PESSOAL" | "CRIADOR" | "COMERCIAL" | "NAO_SEI";
      source: "MANUAL" | "SCREENSHOT" | "META_API" | "INTERNAL";
    }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          influencerId: z.string().uuid(),
          followers: z.number().int().min(0).max(100_000_000).nullable(),
          postsCount: z.number().int().min(0).max(100_000).nullable(),
          femaleAudiencePct: z.number().min(0).max(100).nullable(),
          recentPosts6m: z.enum(["SIM", "NAO", "NAO_SEI"]),
          profileType: z.enum(["PESSOAL", "CRIADOR", "COMERCIAL", "NAO_SEI"]),
          source: z.enum(["MANUAL", "SCREENSHOT", "META_API", "INTERNAL"]),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: updated, error } = await supabase
      .from("influencers")
      .update({
        followers: data.followers,
        posts_count: data.postsCount,
        female_audience_pct: data.femaleAudiencePct,
        recent_posts_6m: data.recentPosts6m,
        profile_type: data.profileType,
        data_source: data.source,
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Candidata não encontrada neste ambiente.");

    const evaluation = evaluateInfluencer(updated);

    await Promise.all([
      supabase
        .from("influencers")
        .update({ level: evaluation.progress.level, progress_score: evaluation.progress.score })
        .eq("tenant_id", data.tenantId)
        .eq("id", data.influencerId),
      supabase.from("metric_snapshots").insert({
        tenant_id: data.tenantId,
        influencer_id: data.influencerId,
        followers: data.followers,
        posts_count: data.postsCount,
        female_audience_pct: data.femaleAudiencePct,
        source: data.source,
        created_by: userId,
      }),
      supabase.from("qualification_results").insert({
        tenant_id: data.tenantId,
        influencer_id: data.influencerId,
        rule_set_version: evaluation.ruleSetVersion,
        status: evaluation.status,
        requirements: evaluation.requirements as unknown as Json,
        progress: evaluation.progress as unknown as Json,
      }),
      audit(supabase, {
        tenant_id: data.tenantId,
        actor_id: userId,
        action: "influencer.metrics_updated",
        entity: "influencers",
        entity_id: data.influencerId,
        meta: { source: data.source },
      }),
    ]);

    return { status: evaluation.status, score: evaluation.progress.score };
  });

export const changeInfluencerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; influencerId: string; status: InfluencerStatus; note?: string }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        influencerId: z.string().uuid(),
        status: z.string().min(3).max(40),
        note: z.string().trim().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: current } = await supabase
      .from("influencers")
      .select("status")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .maybeSingle();
    if (!current) throw new Error("Candidata não encontrada neste ambiente.");

    const nextStatus = data.status as InfluencerStatus;
    // Fase 5: "Qualificada" só pela auditoria, e as etapas seguintes só depois dela.
    const bloqueio = motivoBloqueioSeletor(current.status, nextStatus);
    if (bloqueio) throw new Error(bloqueio);
    const { error } = await supabase
      .from("influencers")
      .update({ status: nextStatus })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId);
    if (error) throw new Error(error.message);

    await Promise.all([
      supabase.from("status_history").insert({
        tenant_id: data.tenantId,
        influencer_id: data.influencerId,
        from_status: current.status,
        to_status: nextStatus,
        changed_by: userId,
        note: data.note ?? null,
      }),
      audit(supabase, {
        tenant_id: data.tenantId,
        actor_id: userId,
        action: "influencer.status_changed",
        entity: "influencers",
        entity_id: data.influencerId,
        meta: { from: current.status, to: nextStatus },
      }),
    ]);

    return { ok: true };
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; influencerId: string; body: string; kind: "note" | "feedback" }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        influencerId: z.string().uuid(),
        body: z.string().trim().min(3).max(2000),
        kind: z.enum(["note", "feedback"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const table = data.kind === "note" ? "notes" : "feedbacks";
    const { error } = await supabase.from(table).insert({
      tenant_id: data.tenantId,
      influencer_id: data.influencerId,
      author_id: userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      influencerId: string | null;
      title: string;
      description?: string;
      dueDate?: string | null;
      priority: "BAIXA" | "MEDIA" | "ALTA";
      level?: string;
    }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          influencerId: z.string().uuid().nullable(),
          title: z.string().trim().min(3).max(160),
          description: z.string().trim().max(1000).optional(),
          dueDate: z.string().trim().max(20).nullable().optional(),
          priority: z.enum(["BAIXA", "MEDIA", "ALTA"]),
          level: z.string().trim().max(60).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("tasks").insert({
      tenant_id: data.tenantId,
      influencer_id: data.influencerId,
      title: data.title,
      description: data.description ?? null,
      due_date: data.dueDate && data.dueDate.length > 0 ? data.dueDate : null,
      priority: data.priority,
      level: data.level ?? null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; taskId: string; status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA" }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        taskId: z.string().uuid(),
        status: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({
        status: data.status,
        completed_at: data.status === "CONCLUIDA" ? new Date().toISOString() : null,
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: tasks }, { data: influencers }] = await Promise.all([
      context.supabase
        .from("tasks")
        .select("*")
        .eq("tenant_id", data.tenantId)
        .order("due_date", { ascending: true, nullsFirst: false }),
      context.supabase.from("influencers").select("id, full_name").eq("tenant_id", data.tenantId),
    ]);
    const names = new Map((influencers ?? []).map((i) => [i.id, i.full_name]));
    return (tasks ?? []).map((t) => ({
      ...t,
      influencerName: t.influencer_id ? (names.get(t.influencer_id) ?? null) : null,
    }));
  });

export const getSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: tenant }, { data: branding }, { data: members }, { data: invitations }, { data: plans }] =
      await Promise.all([
        supabase.from("tenants").select("*").eq("id", data.tenantId).maybeSingle(),
        supabase.from("tenant_branding").select("*").eq("tenant_id", data.tenantId).maybeSingle(),
        supabase.from("tenant_memberships").select("user_id, role, created_at").eq("tenant_id", data.tenantId),
        supabase.from("invitations").select("*").eq("tenant_id", data.tenantId).order("created_at", { ascending: false }),
        supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
      ]);

    const { count: candidateCount } = await supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", data.tenantId);

    const memberIds = (members ?? []).map((m) => m.user_id);
    let memberProfiles: Array<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null }> =
      [];
    if (memberIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", memberIds);
      memberProfiles = profileRows ?? [];
    }
    const profileById = new Map(memberProfiles.map((p) => [p.id, p]));

    return {
      tenant,
      branding,
      currentUserId: context.userId,
      currentRole: (members ?? []).find((m) => m.user_id === context.userId)?.role ?? null,
      members: (members ?? []).map((m) => ({
        ...m,
        fullName: profileById.get(m.user_id)?.full_name ?? null,
        email: profileById.get(m.user_id)?.email ?? null,
        avatarUrl: profileById.get(m.user_id)?.avatar_url ?? null,
      })),
      invitations: invitations ?? [],
      plans: plans ?? [],
      plan: (plans ?? []).find((p) => p.id === tenant?.plan_id) ?? null,
      usage: { candidates: candidateCount ?? 0, members: (members ?? []).length },
    };
  });

export const updateBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      managerName: string;
      headline: string;
      subheadline: string;
      authorityQuote: string;
      bio: string;
      instagramHandle: string;
      whatsapp: string;
    }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          managerName: z.string().trim().max(80),
          headline: z.string().trim().max(160),
          subheadline: z.string().trim().max(400),
          authorityQuote: z.string().trim().max(200),
          bio: z.string().trim().max(800),
          instagramHandle: z.string().trim().max(60),
          whatsapp: z.string().trim().max(30),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("tenant_branding").upsert({
      tenant_id: data.tenantId,
      manager_name: data.managerName,
      headline: data.headline,
      subheadline: data.subheadline,
      authority_quote: data.authorityQuote,
      bio: data.bio,
      instagram_handle: data.instagramHandle,
      whatsapp: data.whatsapp,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "branding.updated",
      entity: "tenant_branding",
      entity_id: data.tenantId,
    });
    return { ok: true };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; email: string; role: "manager_admin" | "manager_member" }) =>
    z
      .object({
        tenantId: z.string().uuid(),
        email: z.string().trim().email().max(160),
        role: z.enum(["manager_admin", "manager_member"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await garantirEspacoParaMembro(supabase, data.tenantId);

    const { error } = await supabase.from("invitations").upsert({
      tenant_id: data.tenantId,
      email: data.email.toLowerCase(),
      role: data.role,
      invited_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertOwner(
  supabase: { from: (t: "tenant_memberships") => any },
  tenantId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.role !== "manager_owner") {
    throw new Error("Apenas a dona do ambiente pode gerenciar a equipe.");
  }
}

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tenantId: string; memberId: string; role: "manager_owner" | "manager_admin" | "manager_member" }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          memberId: z.string().uuid(),
          role: z.enum(["manager_owner", "manager_admin", "manager_member"]),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.tenantId, userId);
    if (data.memberId === userId) throw new Error("Você não pode alterar o seu próprio papel.");

    const { error } = await supabase
      .from("tenant_memberships")
      .update({ role: data.role })
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.memberId);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "member.role_changed",
      entity: "tenant_memberships",
      entity_id: data.memberId,
      meta: { role: data.role },
    });
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; memberId: string }) =>
    z.object({ tenantId: z.string().uuid(), memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.tenantId, userId);
    if (data.memberId === userId) throw new Error("Você não pode remover o seu próprio acesso.");

    const { error } = await supabase
      .from("tenant_memberships")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.memberId);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "member.removed",
      entity: "tenant_memberships",
      entity_id: data.memberId,
    });
    return { ok: true };
  });

export const updateInfluencerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      influencerId: string;
      fullName: string;
      email: string;
      whatsapp?: string;
      city?: string;
      state?: string;
      instagramHandle?: string;
      profileType: "PESSOAL" | "CRIADOR" | "COMERCIAL" | "NAO_SEI";
      storiesFrequency?: string;
      reelsFrequency?: string;
      topics?: string;
      profileGoal?: string;
      mainDifficulty?: string;
    }) =>
      z
        .object({
          tenantId: z.string().uuid(),
          influencerId: z.string().uuid(),
          fullName: z.string().trim().min(3).max(120),
          email: z.string().trim().email().max(160),
          whatsapp: z.string().trim().max(30).optional(),
          city: z.string().trim().max(80).optional(),
          state: z.string().trim().max(40).optional(),
          instagramHandle: z.string().trim().max(60).optional(),
          profileType: z.enum(["PESSOAL", "CRIADOR", "COMERCIAL", "NAO_SEI"]),
          storiesFrequency: z.string().trim().max(60).optional(),
          reelsFrequency: z.string().trim().max(60).optional(),
          topics: z.string().trim().max(400).optional(),
          profileGoal: z.string().trim().max(400).optional(),
          mainDifficulty: z.string().trim().max(400).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clean = (value?: string) => (value && value.trim().length > 0 ? value.trim() : null);
    const handle = clean(data.instagramHandle)?.replace(/^@/, "") ?? null;

    const { data: updated, error } = await supabase
      .from("influencers")
      .update({
        full_name: data.fullName,
        email: data.email.toLowerCase(),
        whatsapp: clean(data.whatsapp),
        city: clean(data.city),
        state: clean(data.state),
        instagram_handle: handle,
        instagram_url: handle ? `https://instagram.com/${handle}` : null,
        profile_type: data.profileType,
        stories_frequency: clean(data.storiesFrequency),
        reels_frequency: clean(data.reelsFrequency),
        topics: clean(data.topics),
        profile_goal: clean(data.profileGoal),
        main_difficulty: clean(data.mainDifficulty),
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Candidata não encontrada neste ambiente.");

    const evaluation = evaluateInfluencer(updated);
    await Promise.all([
      supabase
        .from("influencers")
        .update({ level: evaluation.progress.level, progress_score: evaluation.progress.score })
        .eq("tenant_id", data.tenantId)
        .eq("id", data.influencerId),
      audit(supabase, {
        tenant_id: data.tenantId,
        actor_id: userId,
        action: "influencer.profile_updated",
        entity: "influencers",
        entity_id: data.influencerId,
      }),
    ]);

    return { ok: true };
  });
