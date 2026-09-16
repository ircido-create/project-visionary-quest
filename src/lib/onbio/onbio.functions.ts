import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { audit } from "@/lib/mcb/audit";

const tenantInput = z.object({ tenantId: z.string().uuid() });

async function requireOnbio(
  supabase: { from: (table: "tenants") => any },
  tenantId: string,
) {
  const { data } = await supabase
    .from("tenants")
    .select("id, module")
    .eq("id", tenantId)
    .eq("module", "ONBIO")
    .maybeSingle();
  if (!data) throw new Error("Este recurso está disponível somente no ambiente ONBIO.");
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

    let personId: string | null = null;
    if (data.linkExisting) {
      const { data: existing } = await supabase
        .from("influencers")
        .select("person_id, full_name, email, whatsapp")
        .ilike("email", email)
        .not("person_id", "is", null)
        .limit(1)
        .maybeSingle();
      personId = existing?.person_id ?? null;
    }
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
        status: "EM_PRODUCAO",
        level: "Afiliada ativa",
        progress_score: 100,
        origin: "cadastro_gestora",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "onbio.affiliate_created",
      entity: "influencers",
      entity_id: affiliate.id,
      meta: { linked: data.linkExisting },
    });
    return affiliate;
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
      ? context.supabase.from("commercial_results").update(values).eq("id", data.id).eq("tenant_id", data.tenantId)
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

function extractSseText(source: string): string {
  let output = "";
  for (const line of source.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const raw = line.slice(6);
    if (raw === "[DONE]") continue;
    try {
      const event = JSON.parse(raw) as { type?: string; delta?: string };
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") output += event.delta;
    } catch {
      // Eventos incompletos não fazem parte da resposta final.
    }
  }
  return output;
}

export const generateMeetingAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    tenantInput.extend({ influencerId: z.string().uuid(), periodStart: z.string().nullable(), periodEnd: z.string().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireOnbio(context.supabase, data.tenantId);
    const [{ data: affiliate }, { data: results }] = await Promise.all([
      context.supabase.from("influencers").select("full_name, instagram_handle").eq("tenant_id", data.tenantId).eq("id", data.influencerId).single(),
      context.supabase.from("commercial_results").select("period_start, period_end, revenue_cents, orders, commission_cents, goal_cents, campaign, notes").eq("tenant_id", data.tenantId).eq("influencer_id", data.influencerId).order("period_end", { ascending: false }).limit(12),
    ]);
    if (!affiliate) throw new Error("Afiliada não encontrada.");
    if (!results?.length) throw new Error("Cadastre ao menos um resultado comercial antes de gerar a pauta.");

    const input = { affiliate, period: { start: data.periodStart, end: data.periodEnd }, results };
    const agendaId = crypto.randomUUID();
    const model = "openai/gpt-6-astra";
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
      const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({
          model,
          stream: true,
          reasoning: { effort: "medium", summary: "auto" },
          input: `Crie uma pauta objetiva em português para a reunião com a afiliada ONBIO. Use somente estes resultados comerciais: ${JSON.stringify(input)}. Retorne somente JSON com resumo_executivo e listas conquistas, pontos_de_atencao, perguntas, decisoes_necessarias e proximos_passos. Não invente números.`,
          text: { format: { type: "json_schema", name: "pauta_reuniao", strict: true, schema: { type: "object", additionalProperties: false, properties: { resumo_executivo: { type: "string" }, conquistas: { type: "array", items: { type: "string" } }, pontos_de_atencao: { type: "array", items: { type: "string" } }, perguntas: { type: "array", items: { type: "string" } }, decisoes_necessarias: { type: "array", items: { type: "string" } }, proximos_passos: { type: "array", items: { type: "string" } } }, required: ["resumo_executivo", "conquistas", "pontos_de_atencao", "perguntas", "decisoes_necessarias", "proximos_passos"] } } },
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `A inteligência artificial respondeu ${response.status}.`);
      }
      const text = extractSseText(await response.text());
      const parsed = agendaSchema.parse(JSON.parse(text));
      await context.supabase.from("meeting_agendas").update({ status: "CONCLUIDA", output: parsed as unknown as Json, completed_at: new Date().toISOString() }).eq("id", agendaId);
      await audit(context.supabase, { tenant_id: data.tenantId, actor_id: context.userId, action: "onbio.agenda_generated", entity: "meeting_agendas", entity_id: agendaId });
      return { id: agendaId, output: parsed };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await context.supabase.from("meeting_agendas").update({ status: "ERRO", error: message.slice(0, 1000), completed_at: new Date().toISOString() }).eq("id", agendaId);
      throw new Error(message);
    }
  });

export const listMeetingAgendas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tenantInput.extend({ influencerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("meeting_agendas").select("*").eq("tenant_id", data.tenantId).eq("influencer_id", data.influencerId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });