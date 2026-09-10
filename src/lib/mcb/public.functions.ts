import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database, Json } from "@/integrations/supabase/types";
import { audit } from "@/lib/mcb/audit";
import { evaluateQualification } from "@/lib/mcb/qualification";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export type ManagerPage = {
  tenant: { id: string; name: string; slug: string; isDemo: boolean };
  branding: {
    managerName: string | null;
    headline: string | null;
    subheadline: string | null;
    authorityQuote: string | null;
    bio: string | null;
    instagramHandle: string | null;
    accentColor: string | null;
  } | null;
};

export const getManagerPage = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }): Promise<ManagerPage | null> => {
    const supabase = publicClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, slug, is_demo, is_public_page_enabled")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!tenant || !tenant.is_public_page_enabled) return null;

    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("manager_name, headline, subheadline, authority_quote, bio, instagram_handle, accent_color")
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, isDemo: tenant.is_demo },
      branding: branding
        ? {
            managerName: branding.manager_name,
            headline: branding.headline,
            subheadline: branding.subheadline,
            authorityQuote: branding.authority_quote,
            bio: branding.bio,
            instagramHandle: branding.instagram_handle,
            accentColor: branding.accent_color,
          }
        : null,
    };
  });

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data } = await supabase
    .from("plans")
    .select("id, code, name, description, price_cents, max_candidates, max_members, max_ai_analyses, custom_branding")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
});

export const listPublicManagers = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data } = await supabase
    .from("tenants")
    .select("name, slug, is_demo")
    .eq("is_public_page_enabled", true)
    .order("created_at");
  return data ?? [];
});

const applicationSchema = z.object({
  slug: z.string().min(1).max(80),
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(160),
  whatsapp: z.string().trim().min(8).max(30),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(40),
  instagramHandle: z.string().trim().min(2).max(60),
  instagramUrl: z.string().trim().url().max(200),
  followers: z.number().int().min(0).max(100_000_000).nullable(),
  postsCount: z.number().int().min(0).max(100_000).nullable(),
  recentPosts6m: z.enum(["SIM", "NAO", "NAO_SEI"]),
  femaleAudiencePct: z.number().min(0).max(100).nullable(),
  profileType: z.enum(["PESSOAL", "CRIADOR", "COMERCIAL", "NAO_SEI"]),
  storiesFrequency: z.string().max(60),
  reelsFrequency: z.string().max(60),
  topics: z.string().trim().max(600),
  askedAbout: z.string().trim().max(600),
  profileGoal: z.string().trim().max(600),
  mainDifficulty: z.string().trim().max(600),
  dailyTime: z.string().max(40),
  instagramGoal: z.string().trim().max(600),
  consent: z.literal(true),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input: ApplicationInput) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // O tenant é sempre resolvido no servidor a partir do slug da landing page.
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, is_public_page_enabled")
      .eq("slug", data.slug)
      .maybeSingle();

    if (tenantError) throw new Error("Não foi possível registrar sua candidatura agora.");
    if (!tenant || !tenant.is_public_page_enabled) {
      return { ok: false as const, reason: "Página de candidatura indisponível." };
    }

    // Proteção simples contra envios duplicados da mesma candidata.
    const { data: existing } = await supabaseAdmin
      .from("influencers")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("email", data.email.toLowerCase())
      .maybeSingle();

    if (existing) {
      return { ok: true as const, duplicated: true as const };
    }

    const evaluation = evaluateQualification({
      followers: data.followers,
      postsCount: data.postsCount,
      recentPosts6m: data.recentPosts6m,
      profileType: data.profileType,
      femaleAudiencePct: data.femaleAudiencePct,
      source: "MANUAL",
      capturedAt: new Date().toISOString(),
    });

    const initialStatus =
      evaluation.status === "QUALIFIED"
        ? "PRONTA_AUDITORIA"
        : evaluation.status === "NEEDS_EVIDENCE"
          ? "AGUARDANDO_EVIDENCIAS"
          : "NOVA_INSCRICAO";

    const { data: influencer, error } = await supabaseAdmin
      .from("influencers")
      .insert({
        tenant_id: tenant.id,
        full_name: data.fullName,
        email: data.email.toLowerCase(),
        whatsapp: data.whatsapp,
        city: data.city,
        state: data.state,
        instagram_handle: data.instagramHandle.replace(/^@/, ""),
        instagram_url: data.instagramUrl,
        followers: data.followers,
        posts_count: data.postsCount,
        recent_posts_6m: data.recentPosts6m,
        female_audience_pct: data.femaleAudiencePct,
        profile_type: data.profileType,
        stories_frequency: data.storiesFrequency,
        reels_frequency: data.reelsFrequency,
        topics: data.topics,
        asked_about: data.askedAbout,
        profile_goal: data.profileGoal,
        main_difficulty: data.mainDifficulty,
        daily_time: data.dailyTime,
        instagram_goal: data.instagramGoal,
        initial_followers: data.followers,
        initial_posts_count: data.postsCount,
        status: initialStatus,
        level: evaluation.progress.level,
        progress_score: evaluation.progress.score,
        data_source: "MANUAL",
        consent_at: new Date().toISOString(),
        origin: `landing:${data.slug}`,
      })
      .select("id")
      .single();

    if (error || !influencer) throw new Error("Não foi possível registrar sua candidatura agora.");

    await Promise.all([
      supabaseAdmin.from("applications").insert({
        tenant_id: tenant.id,
        influencer_id: influencer.id,
        answers: data as unknown as Json,
      }),
      supabaseAdmin.from("qualification_results").insert({
        tenant_id: tenant.id,
        influencer_id: influencer.id,
        rule_set_version: evaluation.ruleSetVersion,
        status: evaluation.status,
        requirements: evaluation.requirements as unknown as Json,
        progress: evaluation.progress as unknown as Json,
      }),
      supabaseAdmin.from("metric_snapshots").insert({
        tenant_id: tenant.id,
        influencer_id: influencer.id,
        followers: data.followers,
        posts_count: data.postsCount,
        female_audience_pct: data.femaleAudiencePct,
        source: "MANUAL",
      }),
      supabaseAdmin.from("consent_logs").insert({
        tenant_id: tenant.id,
        influencer_id: influencer.id,
        purpose: "Análise de perfil e acompanhamento do Método Criadora Blessing",
        source: `landing:${data.slug}`,
      }),
      supabaseAdmin.from("status_history").insert({
        tenant_id: tenant.id,
        influencer_id: influencer.id,
        to_status: initialStatus,
        note: "Candidatura recebida pela landing page da gestora.",
      }),
      audit(supabaseAdmin, {
        tenant_id: tenant.id,
        action: "application.submitted",
        entity: "influencers",
        entity_id: influencer.id,
        meta: { origin: `landing:${data.slug}` },
      }),
    ]);

    return { ok: true as const, duplicated: false as const };
  });
