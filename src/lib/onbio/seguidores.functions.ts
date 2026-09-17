import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit } from "@/lib/mcb/audit";
import {
  crescimentoNoPeriodo,
  historicoDeCrescimento,
  intervaloDoPeriodo,
  resumoDoPainel,
  situacaoDaIntegracao,
  ROTULO_FONTE,
  ROTULO_SITUACAO,
  type Fonte,
  type Registro,
} from "@/lib/onbio/seguidores";

type Cliente = { from: (t: string) => any; rpc: (n: string, a?: Record<string, unknown>) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const periodoSchema = z.union([
  z.object({ dias: z.number().int().min(1).max(3650) }),
  z.object({
    de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

async function exigirOnbio(supabase: Cliente, tenantId: string) {
  const { data } = await supabase
    .from("tenants")
    .select("id, instagram_intervalo_horas")
    .eq("id", tenantId)
    .eq("module", "ONBIO")
    .maybeSingle();
  if (!data) throw new Error("Este recurso está disponível somente no ambiente ONBIO.");
  return data as { id: string; instagram_intervalo_horas: number };
}

type Conexao = {
  influencer_id: string;
  usuario: string | null;
  expira_em: string | null;
  ultimo_sync: string | null;
  ultimo_erro: string | null;
};

async function conexoesDoAmbiente(supabase: Cliente, tenantId: string) {
  const { data, error } = await supabase.rpc("instagram_conexoes_do_ambiente", {
    p_tenant: tenantId,
  });
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as Conexao[]).map((c) => [c.influencer_id, c]));
}

async function montarPainel(
  supabase: Cliente,
  tenantId: string,
  periodo: z.infer<typeof periodoSchema>,
) {
  const ambiente = await exigirOnbio(supabase, tenantId);
  const { inicio, fim } = intervaloDoPeriodo(periodo);

  const [afiliadas, registros, conexoes] = await Promise.all([
    supabase
      .from("influencers")
      .select("id, full_name, instagram_handle, instagram_url, followers, data_source")
      .eq("tenant_id", tenantId)
      .is("archived_at", null)
      .order("full_name"),
    supabase
      .from("metric_snapshots")
      .select("influencer_id, captured_at, followers, source")
      .eq("tenant_id", tenantId)
      .not("followers", "is", null)
      .order("captured_at"),
    conexoesDoAmbiente(supabase, tenantId),
  ]);
  if (afiliadas.error) throw new Error(afiliadas.error.message);
  if (registros.error) throw new Error(registros.error.message);

  const porAfiliada = new Map<string, Registro[]>();
  for (const s of (registros.data ?? []) as Array<{
    influencer_id: string;
    captured_at: string;
    followers: number;
    source: Fonte;
  }>) {
    const lista = porAfiliada.get(s.influencer_id) ?? [];
    lista.push({ capturedAt: s.captured_at, followers: s.followers, source: s.source });
    porAfiliada.set(s.influencer_id, lista);
  }

  const linhas = (
    (afiliadas.data ?? []) as Array<{
      id: string;
      full_name: string;
      instagram_handle: string | null;
      instagram_url: string | null;
      followers: number | null;
      data_source: Fonte;
    }>
  ).map((a) => {
    const conexao = conexoes.get(a.id) ?? null;
    const c = crescimentoNoPeriodo(porAfiliada.get(a.id) ?? [], inicio, fim);
    return {
      id: a.id,
      nome: a.full_name,
      instagram: a.instagram_handle,
      link:
        a.instagram_url ??
        (a.instagram_handle ? `https://instagram.com/${a.instagram_handle}` : null),
      situacao: situacaoDaIntegracao(conexao ? { ultimoErro: conexao.ultimo_erro } : null),
      ultimoErro: conexao?.ultimo_erro ?? null,
      ultimaConsulta: conexao?.ultimo_sync ?? null,
      // Sem registro no histórico, vale o número do cadastro (com a fonte do cadastro).
      seguidores: c.atual ?? a.followers,
      fonte: c.fonte ?? (a.followers !== null ? a.data_source : null),
      atualizadoEm: c.atualizadoEm,
      inicioDoPeriodo: c.inicio,
      crescimento: c.absoluta,
      percentual: c.percentual,
    };
  });

  return {
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    intervaloHoras: ambiente.instagram_intervalo_horas,
    resumo: resumoDoPainel(linhas),
    afiliadas: linhas,
  };
}

export type PainelSeguidores = Awaited<ReturnType<typeof montarPainel>>;

export const getPainelSeguidores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid(), periodo: periodoSchema }).parse(input),
  )
  .handler(async ({ data, context }) =>
    montarPainel(context.supabase as unknown as Cliente, data.tenantId, data.periodo),
  );

export const getHistoricoSeguidores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid(), influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    const ambiente = await exigirOnbio(supabase, data.tenantId);
    const [registros, conexoes] = await Promise.all([
      supabase
        .from("metric_snapshots")
        .select("captured_at, followers, source")
        .eq("tenant_id", data.tenantId)
        .eq("influencer_id", data.influencerId)
        .order("captured_at"),
      conexoesDoAmbiente(supabase, data.tenantId),
    ]);
    if (registros.error) throw new Error(registros.error.message);
    const lista = (
      (registros.data ?? []) as Array<{
        captured_at: string;
        followers: number | null;
        source: Fonte;
      }>
    ).map((s) => ({ capturedAt: s.captured_at, followers: s.followers, source: s.source }));
    const conexao = conexoes.get(data.influencerId) ?? null;
    return {
      intervaloHoras: ambiente.instagram_intervalo_horas,
      situacao: situacaoDaIntegracao(conexao ? { ultimoErro: conexao.ultimo_erro } : null),
      conexao: conexao
        ? {
            usuario: conexao.usuario,
            ultimaConsulta: conexao.ultimo_sync,
            ultimoErro: conexao.ultimo_erro,
            expiraEm: conexao.expira_em,
          }
        : null,
      historico: historicoDeCrescimento(lista),
      grafico: lista
        .filter((s): s is Registro & { followers: number } => s.followers !== null)
        .map((s) => ({
          data: new Date(s.capturedAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
          seguidores: s.followers,
        })),
    };
  });

export const atualizarSeguidoresAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid(), influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    await exigirOnbio(supabase, data.tenantId);

    // Membro do ambiente: a leitura da afiliada passa pela RLS do usuário.
    const { data: afiliada } = await supabase
      .from("influencers")
      .select("id, instagram_handle")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .maybeSingle();
    if (!afiliada) throw new Error("Afiliada não encontrada neste ambiente.");
    const { data: membro } = await supabase.rpc("is_tenant_member", { _tenant: data.tenantId });
    if (!membro) throw new Error("Só a equipe do ambiente atualiza seguidores.");

    const conexao = (await conexoesDoAmbiente(supabase, data.tenantId)).get(data.influencerId);
    if (!conexao) {
      throw new Error(
        "Esta afiliada ainda não autorizou o Instagram. Informe o número manualmente ou envie o acesso a ela.",
      );
    }
    // Evita consultas repetidas: a Meta limita requisições por conta.
    if (conexao.ultimo_sync && Date.now() - new Date(conexao.ultimo_sync).getTime() < 5 * 60_000) {
      throw new Error(
        "Esta conta foi consultada há menos de 5 minutos. Aguarde um pouco para atualizar de novo.",
      );
    }

    const { consultarSeguidores } = await import("@/lib/onbio/rotinaInstagram.server");
    const resultado = await consultarSeguidores({
      influencerId: data.influencerId,
      usuarioCadastrado:
        (afiliada as { instagram_handle: string | null }).instagram_handle ?? conexao.usuario,
      expiraEm: conexao.expira_em,
      ator: context.userId,
    });
    if (!resultado.ok) throw new Error(resultado.erro);
    return resultado;
  });

export const registrarSeguidoresManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        influencerId: z.string().uuid(),
        followers: z.number().int().min(0).max(1_000_000_000),
        postsCount: z.number().int().min(0).max(1_000_000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    await exigirOnbio(supabase, data.tenantId);
    const mudancas: Record<string, unknown> = { followers: data.followers, data_source: "MANUAL" };
    if (data.postsCount !== null) mudancas["posts_count"] = data.postsCount;

    const { data: atualizada, error } = await supabase
      .from("influencers")
      .update(mudancas)
      .eq("tenant_id", data.tenantId)
      .eq("id", data.influencerId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!atualizada) throw new Error("Afiliada não encontrada neste ambiente.");

    const { error: erroRegistro } = await supabase.from("metric_snapshots").insert({
      tenant_id: data.tenantId,
      influencer_id: data.influencerId,
      followers: data.followers,
      posts_count: data.postsCount,
      source: "MANUAL",
      created_by: context.userId,
    });
    if (erroRegistro) throw new Error(erroRegistro.message);

    await audit(context.supabase, {
      tenant_id: data.tenantId,
      actor_id: context.userId,
      action: "instagram.seguidores_informados",
      entity: "influencers",
      entity_id: data.influencerId,
      meta: { seguidores: data.followers, publicacoes: data.postsCount },
    });
    return { ok: true };
  });

export const definirIntervaloInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        horas: z.union([z.literal(6), z.literal(12), z.literal(24), z.literal(48), z.literal(168)]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    await exigirOnbio(supabase, data.tenantId);
    const { error } = await supabase.rpc("instagram_definir_intervalo", {
      p_tenant: data.tenantId,
      p_horas: data.horas,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const desconectarInstagramPelaGestora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid(), influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as Cliente;
    await exigirOnbio(supabase, data.tenantId);
    const { error } = await supabase.rpc("instagram_desconectar_pela_gestora", {
      p_influencer_id: data.influencerId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportarRelatorioSeguidores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        periodo: periodoSchema,
        ids: z.array(z.string().uuid()).max(5000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const painel = await montarPainel(
      context.supabase as unknown as Cliente,
      data.tenantId,
      data.periodo,
    );
    const filtro = data.ids ? new Set(data.ids) : null;
    const num = (v: number | null) => (v === null ? "" : v);
    const dia = (iso: string) =>
      new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const dataHora = (iso: string | null) =>
      iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";

    await audit(context.supabase, {
      tenant_id: data.tenantId,
      actor_id: context.userId,
      action: "instagram.relatorio_exportado",
      entity: "tenants",
      entity_id: data.tenantId,
    });

    return {
      nomeDoArquivo: `seguidores-onbio-${painel.inicio.slice(0, 10)}-a-${painel.fim.slice(0, 10)}.csv`,
      cabecalho: [
        "Afiliada",
        "Instagram",
        "Seguidores atuais",
        `Seguidores no início (${dia(painel.inicio)})`,
        "Crescimento no período",
        "Crescimento (%)",
        "Última atualização",
        "Origem do número",
        "Integração",
      ],
      linhas: painel.afiliadas
        .filter((a) => !filtro || filtro.has(a.id))
        .map((a) => [
          a.nome,
          a.instagram ? `@${a.instagram}` : "",
          num(a.seguidores),
          num(a.inicioDoPeriodo),
          num(a.crescimento),
          a.percentual === null ? "" : String(a.percentual).replace(".", ","),
          dataHora(a.atualizadoEm),
          a.fonte ? ROTULO_FONTE[a.fonte] : "Sem dados",
          ROTULO_SITUACAO[a.situacao],
        ]),
    };
  });
