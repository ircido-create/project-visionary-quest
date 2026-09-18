/**
 * Fase 6 — Primeiros passos da gestora e a escolha de aparecer na lista pública do MCB.
 *
 * As duas funções são da dona e da administradora do ambiente: a política de UPDATE de
 * `tenants` já exige esses papéis, e a checagem aqui existe para devolver uma mensagem
 * compreensível em vez de "nenhuma linha alterada".
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "@/lib/mcb/audit";
import { paginaFoiAjustada, type EstadoDoAmbiente } from "@/lib/mcb/primeirosPassos";

type Cliente = Parameters<typeof audit>[0];

async function ehDonaOuAdministradora(supabase: Cliente, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_tenant_role", {
    _tenant: tenantId,
    _roles: ["manager_owner", "manager_admin"],
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export type PrimeirosPassos =
  { podeVer: false } | ({ podeVer: true; slug: string; listadaNoMcb: boolean } & EstadoDoAmbiente);

export const obterPrimeirosPassos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) =>
    z.object({ tenantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PrimeirosPassos> => {
    const { supabase } = context;
    if (!(await ehDonaOuAdministradora(supabase, data.tenantId))) return { podeVer: false };

    const [ambiente, marca, modelos, afiliadas, convites, membros] = await Promise.all([
      supabase
        .from("tenants")
        .select("slug, is_demo, created_at, is_listed_on_home")
        .eq("id", data.tenantId)
        .maybeSingle(),
      supabase
        .from("tenant_branding")
        .select("updated_at")
        .eq("tenant_id", data.tenantId)
        .maybeSingle(),
      supabase
        .from("task_templates")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", data.tenantId),
      supabase
        .from("influencers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", data.tenantId),
      supabase
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", data.tenantId),
      supabase
        .from("tenant_memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", data.tenantId),
    ]);
    for (const r of [ambiente, marca, modelos, afiliadas, convites, membros]) {
      if (r.error) throw new Error(r.error.message);
    }
    if (!ambiente.data || ambiente.data.is_demo) return { podeVer: false };

    return {
      podeVer: true,
      slug: ambiente.data.slug,
      listadaNoMcb: ambiente.data.is_listed_on_home,
      paginaAjustada: paginaFoiAjustada(ambiente.data.created_at, marca.data?.updated_at ?? null),
      modelosCarregados: (modelos.count ?? 0) > 0,
      primeiraCandidata: (afiliadas.count ?? 0) > 0,
      // Quem criou o ambiente já é membro: equipe convidada é convite enviado ou mais alguém.
      equipeConvidada: (convites.count ?? 0) > 0 || (membros.count ?? 0) > 1,
    };
  });

export const definirListagemNoMcb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; listar: boolean }) =>
    z.object({ tenantId: z.string().uuid(), listar: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await ehDonaOuAdministradora(supabase, data.tenantId))) {
      throw new Error("Só a dona ou a administradora do ambiente decide sobre a lista do MCB.");
    }
    const { data: linhas, error } = await supabase
      .from("tenants")
      .update({ is_listed_on_home: data.listar })
      .eq("id", data.tenantId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!linhas || linhas.length === 0) throw new Error("Ambiente não encontrado.");

    await audit(supabase, {
      tenant_id: data.tenantId,
      actor_id: userId,
      action: "tenant.lista_do_mcb",
      entity: "tenants",
      entity_id: data.tenantId,
      meta: { listada: data.listar },
    });
    return { ok: true };
  });
