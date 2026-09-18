import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { audit } from "@/lib/mcb/audit";
import { gerarAnalise } from "@/lib/mcb/ai-gateway";
import { EVIDENCE_BUCKET } from "@/lib/mcb/evidence";
import { caminhosDeEvidencia, confirmacaoConfere } from "@/lib/mcb/exclusao";

const tenantInput = z.object({ tenantId: z.string().uuid() });

async function requireOnbio(supabase: { from: (table: "tenants") => any }, tenantId: string) {
  const { data } = await supabase
    .from("tenants")
    .select("id, module")
    .eq("id", tenantId)
    .eq("module", "ONBIO")
    .maybeSingle();
  if (!data) throw new Error("Este recurso está disponível somente no ambiente ONBIO.");
}

async function requireOnbioManager(supabase: SupabaseClient<Database>, tenantId: string) {
  await requireOnbio(supabase, tenantId);
  const { data: allowed, error } = await supabase.rpc("has_tenant_role", {
    _tenant: tenantId,
    _roles: ["manager_owner", "manager_admin"],
  });
  if (error) throw new Error(error.message);
  if (!allowed) throw new Error("Somente a dona ou uma administradora pode excluir afiliadas.");
}

export const createOnbioAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        fullName: z.string().trim().min(3).max(120),
        email: z.string().trim().email().max(160),
        whatsapp: z.string().trim().max(30).nullable(),
        instagramHandle: z.string().trim().max(60).nullable(),
        followers: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
        postsCount: z.number().int().min(0).max(1_000_000).nullable().optional(),
        linkExisting: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOnbio(supabase, data.tenantId);
    const email = data.email.toLowerCase();

    const { data: duplicate } = await supabase
      .from("influencers")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .ilike("email", email)
      .maybeSingle();
    if (duplicate) throw new Error("Esta afiliada já está cadastrada na ONBIO.");

    // O vínculo entre ambientes não acontece aqui: a afiliada precisa autorizar no
    // portal dela. O cadastro nasce com identidade própria, e o pedido vai depois.
    let personId: string | null = null;
    if (!personId) {
      const { data: person, error: personError } = await supabase
        .from("people")
        .insert({
          full_name: data.fullName,
          email,
          whatsapp: data.whatsapp,
          created_by: userId,
        })
        .select("id")
        .single();
      if (personError) throw new Error(personError.message);
      personId = person.id;
    }

    const handle = data.instagramHandle?.replace(/^@/, "") || null;
    const { data: affiliate, error } = await supabase
      .from("influencers")
      .insert({
        tenant_id: data.tenantId,
        person_id: personId,
        full_name: data.fullName,
        email,
        whatsapp: data.whatsapp,
        instagram_handle: handle,
        instagram_url: handle ? `https://instagram.com/${handle}` : null,
        followers: data.followers ?? null,
        posts_count: data.postsCount ?? null,
        data_source: "MANUAL",
        status: "EM_PRODUCAO",
        level: "Afiliada ativa",
        progress_score: 100,
        origin: "cadastro_gestora",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Os números informados no cadastro viram o primeiro ponto da evolução.
    if (data.followers != null || data.postsCount != null) {
      await supabase.from("metric_snapshots").insert({
        tenant_id: data.tenantId,
        influencer_id: affiliate.id,
        followers: data.followers ?? null,
        posts_count: data.postsCount ?? null,
        source: "MANUAL",
        created_by: userId,
      });
    }

    let vinculoPedido = false;
    if (data.linkExisting) {
      const { data: origem } = await supabase
        .from("influencers")
        .select("id")
        .ilike("email", email)
        .neq("tenant_id", data.tenantId)
        .not("user_id", "is", null)
        .limit(1)
        .maybeSingle();
      if (!origem) {
        throw new Error(
          "Afiliada cadastrada, mas o vínculo não foi pedido: não encontramos esta pessoa, com conta de acesso, em outro ambiente.",
        );
      }
      const { error: erroVinculo } = await supabase.rpc("pedir_vinculo_de_identidade", {
        p_destino_influencer_id: affiliate.id,
        p_origem_influencer_id: origem.id,
      });
      if (erroVinculo) throw new Error(erroVinculo.message);
      vinculoPedido = true;
    }

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "onbio.affiliate_created",
      entity: "influencers",
      entity_id: affiliate.id,
      meta: { vinculo_pedido: vinculoPedido },
    });
    return affiliate;
  });

export const deleteOnbioAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        influencerId: z.string().uuid(),
        confirmation: z.string().max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireOnbioManager(context.supabase, data.tenantId);

    const { data: affiliate, error: affiliateError } = await context.supabase
      .from("influencers")
      .select("id, email")
      .eq("id", data.influencerId)
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (affiliateError) throw new Error(affiliateError.message);
    if (!affiliate) throw new Error("Afiliada não encontrada neste ambiente.");
    if (!confirmacaoConfere(data.confirmation, affiliate.email)) {
      throw new Error("O e-mail digitado não confere. Nada foi excluído.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [listing, registeredFiles] = await Promise.all([
      supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .list(`${data.tenantId}/${data.influencerId}`, { limit: 1000 }),
      supabaseAdmin.from("files").select("storage_path").eq("influencer_id", data.influencerId),
    ]);
    if (listing.error) {
      throw new Error(`Não foi possível verificar os arquivos. Nada foi excluído.`);
    }
    if (registeredFiles.error) throw new Error(registeredFiles.error.message);

    const paths = [
      ...new Set([
        ...caminhosDeEvidencia(
          data.tenantId,
          data.influencerId,
          (listing.data ?? []).map((item) => item.name),
        ),
        ...(registeredFiles.data ?? []).map((item) => item.storage_path),
      ]),
    ];
    if (paths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .remove(paths);
      if (storageError) {
        throw new Error("Não foi possível apagar os arquivos. Nada foi excluído do cadastro.");
      }
    }

    const { error: deleteError } = await supabaseAdmin.rpc("excluir_afiliada_onbio", {
      p_influencer_id: data.influencerId,
      p_actor: context.userId,
    });
    if (deleteError) {
      throw new Error(
        `Os arquivos foram apagados, mas o cadastro não pôde ser excluído. Tente novamente.`,
      );
    }

    return { ok: true, deletedFiles: paths.length };
  });

export const listCommercialResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    tenantInput.extend({ influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireOnbio(context.supabase, data.tenantId);
    const { data: rows, error } = await context.supabase
      .from("commercial_results")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .eq("influencer_id", data.influencerId)
      .order("period_end", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveCommercialResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        influencerId: z.string().uuid(),
        id: z.string().uuid().nullable(),
        periodStart: z.string(),
        periodEnd: z.string(),
        revenueCents: z.number().int().min(0),
        orders: z.number().int().min(0),
        commissionCents: z.number().int().min(0),
        goalCents: z.number().int().min(0).nullable(),
        campaign: z.string().trim().max(160).nullable(),
        notes: z.string().trim().max(1000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireOnbio(context.supabase, data.tenantId);
    const values = {
      tenant_id: data.tenantId,
      influencer_id: data.influencerId,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      revenue_cents: data.revenueCents,
      orders: data.orders,
      commission_cents: data.commissionCents,
      goal_cents: data.goalCents,
      campaign: data.campaign,
      notes: data.notes,
      created_by: context.userId,
    };
    const query = data.id
      ? context.supabase
          .from("commercial_results")
          .update(values)
          .eq("id", data.id)
          .eq("tenant_id", data.tenantId)
      : context.supabase.from("commercial_results").insert(values);
    const { error } = await query;
    if (error) throw new Error(error.message);
    await audit(context.supabase, {
      tenant_id: data.tenantId,
      actor_id: context.userId,
      action: data.id ? "onbio.result_updated" : "onbio.result_created",
      entity: "commercial_results",
      entity_id: data.id,
    });
    return { ok: true };
  });

export const deleteCommercialResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tenantInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireOnbio(context.supabase, data.tenantId);
    const { error } = await context.supabase
      .from("commercial_results")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, {
      tenant_id: data.tenantId,
      actor_id: context.userId,
      action: "onbio.result_deleted",
      entity: "commercial_results",
      entity_id: data.id,
    });
    return { ok: true };
  });

const agendaSchema = z.object({
  resumo_executivo: z.string(),
  conquistas: z.array(z.string()),
  pontos_de_atencao: z.array(z.string()),
  perguntas: z.array(z.string()),
  decisoes_necessarias: z.array(z.string()),
  proximos_passos: z.array(z.string()),
});

export const generateMeetingAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    tenantInput
      .extend({
        influencerId: z.string().uuid(),
        periodStart: z.string().nullable(),
        periodEnd: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireOnbio(context.supabase, data.tenantId);
    const [{ data: affiliate }, { data: results }] = await Promise.all([
      context.supabase
        .from("influencers")
        .select("full_name, instagram_handle")
        .eq("tenant_id", data.tenantId)
        .eq("id", data.influencerId)
        .single(),
      context.supabase
        .from("commercial_results")
        .select(
          "period_start, period_end, revenue_cents, orders, commission_cents, goal_cents, campaign, notes",
        )
        .eq("tenant_id", data.tenantId)
        .eq("influencer_id", data.influencerId)
        .order("period_end", { ascending: false })
        .limit(12),
    ]);
    if (!affiliate) throw new Error("Afiliada não encontrada.");
    if (!results?.length)
      throw new Error("Cadastre ao menos um resultado comercial antes de gerar a pauta.");

    const input = { affiliate, period: { start: data.periodStart, end: data.periodEnd }, results };
    const agendaId = crypto.randomUUID();
    const model = "google/gemini-2.5-flash";
    const { error: insertError } = await context.supabase.from("meeting_agendas").insert({
      id: agendaId,
      tenant_id: data.tenantId,
      influencer_id: data.influencerId,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      prompt_version: "onbio-reuniao-v1",
      model,
      input: input as unknown as Json,
      created_by: context.userId,
    });
    if (insertError) throw new Error(insertError.message);

    try {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("A inteligência artificial não está configurada neste projeto.");
      const text = await gerarAnalise({
        apiKey,
        modelo: model,
        sistema:
          "Você apoia a gestão de afiliadas ONBIO. Produza pautas objetivas, humanas e comerciais. Use somente os dados recebidos, não invente números e não avalie requisitos de afiliação.",
        usuario: `Crie a pauta da reunião com base nestes resultados comerciais: ${JSON.stringify(input)}.`,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            resumo_executivo: { type: "string" },
            conquistas: { type: "array", items: { type: "string" } },
            pontos_de_atencao: { type: "array", items: { type: "string" } },
            perguntas: { type: "array", items: { type: "string" } },
            decisoes_necessarias: { type: "array", items: { type: "string" } },
            proximos_passos: { type: "array", items: { type: "string" } },
          },
          required: [
            "resumo_executivo",
            "conquistas",
            "pontos_de_atencao",
            "perguntas",
            "decisoes_necessarias",
            "proximos_passos",
          ],
        },
      });
      if (!text) throw new Error("A inteligência artificial não retornou uma pauta válida.");
      const parsed = agendaSchema.parse(JSON.parse(text));
      await context.supabase
        .from("meeting_agendas")
        .update({
          status: "CONCLUIDA",
          output: parsed as unknown as Json,
          completed_at: new Date().toISOString(),
        })
        .eq("id", agendaId);
      await audit(context.supabase, {
        tenant_id: data.tenantId,
        actor_id: context.userId,
        action: "onbio.agenda_generated",
        entity: "meeting_agendas",
        entity_id: agendaId,
      });
      return { id: agendaId, output: parsed };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await context.supabase
        .from("meeting_agendas")
        .update({
          status: "ERRO",
          error: message.slice(0, 1000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", agendaId);
      throw new Error(message);
    }
  });

export const getOnbioDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tenantInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireOnbio(context.supabase, data.tenantId);
    const [
      { data: affiliates, error: affiliateError },
      { data: results, error: resultError },
      { data: tasks, error: taskError },
    ] = await Promise.all([
      context.supabase
        .from("influencers")
        .select("id, full_name")
        .eq("tenant_id", data.tenantId)
        .is("archived_at", null),
      context.supabase
        .from("commercial_results")
        .select("influencer_id, revenue_cents, orders, commission_cents, period_end")
        .eq("tenant_id", data.tenantId)
        .order("period_end", { ascending: false }),
      context.supabase
        .from("tasks")
        .select("id, status, due_date")
        .eq("tenant_id", data.tenantId)
        .neq("status", "CANCELADA"),
    ]);
    if (affiliateError || resultError || taskError)
      throw new Error(
        affiliateError?.message ??
          resultError?.message ??
          taskError?.message ??
          "Não foi possível carregar os indicadores.",
      );
    const names = new Map((affiliates ?? []).map((row) => [row.id, row.full_name]));
    const revenue = (results ?? []).reduce((sum, row) => sum + row.revenue_cents, 0);
    const orders = (results ?? []).reduce((sum, row) => sum + row.orders, 0);
    const commission = (results ?? []).reduce((sum, row) => sum + row.commission_cents, 0);
    const today = new Date().toISOString().slice(0, 10);
    const lateTasks = (tasks ?? []).filter(
      (task) => task.status !== "CONCLUIDA" && task.due_date && task.due_date < today,
    ).length;
    const latest = (results ?? [])
      .slice(0, 8)
      .map((row) => ({ ...row, name: names.get(row.influencer_id) ?? "Afiliada" }));
    return { affiliates: affiliates?.length ?? 0, revenue, orders, commission, lateTasks, latest };
  });

export const listMeetingAgendas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    tenantInput.extend({ influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("meeting_agendas")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .eq("influencer_id", data.influencerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
