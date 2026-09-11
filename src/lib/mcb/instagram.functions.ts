/**
 * Fase 4 — Integração oficial Meta/Instagram: chamadas de rede e gravação.
 *
 * QUEM CHAMA O QUÊ
 *
 * `conectar`, `sincronizar` e `desconectar` só funcionam para a **própria candidata**.
 * Isso não é decidido aqui: as funções `security definer` da migração
 * 20260910150000 recusam qualquer outro chamador. Esta camada é conveniência e
 * tradução; a autoridade está no banco.
 *
 * A gestora usa só `getInstagramStatus`, que não devolve segredo nenhum.
 *
 * ONDE MORA O SEGREDO
 *
 * O token fica cifrado no Vault. Ele passa por este processo — que roda no servidor —
 * e nunca é devolvido ao navegador. Nenhuma função deste arquivo retorna token.
 *
 * POR QUE O SYNC É SOB DEMANDA, E NÃO AGENDADO
 *
 * Um sync noturno precisaria rodar sem ninguém logado, e a única credencial capaz
 * disso é a service role key — que este projeto deliberadamente não usa. Então o
 * sync acontece quando a candidata abre o portal e pede. O custo é honesto: o dado
 * tem a idade da última visita dela, e a tela mostra essa data.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateInfluencer } from "@/lib/mcb/app.functions";
import { ambienteServidor, lerEnv, nomesPresentes } from "@/lib/mcb/env";
import {
  GRAPH_HOST,
  META_API_VERSION,
  OAUTH_TOKEN_URL,
  SCOPES,
  VARIAVEIS_META,
  VARIAVEIS_REFERENCIA,
  diagnosticarConfig,
  lerErroDaMeta,
  lerPerfil,
  lerPublicoFeminino,
  montarUrlDeAutorizacao,
  precisaRenovar,
} from "@/lib/mcb/instagram";
import type { Json } from "@/integrations/supabase/types";

/**
 * Credenciais do app da Meta. Em produção são secrets do Lovable; localmente vivem em
 * `.env.local` — nunca no `.env`, que é versionado num repositório público.
 */
function credenciais() {
  const appId = lerEnv("META_APP_ID");
  const appSecret = lerEnv("META_APP_SECRET");
  const redirectUri = lerEnv("META_REDIRECT_URI");
  if (!appId || !appSecret || !redirectUri) {
    throw new Error(
      "Integração com o Instagram não configurada. Faltam META_APP_ID, META_APP_SECRET " +
        "ou META_REDIRECT_URI. Ver docs/integracao-meta.md.",
    );
  }
  return { appId, appSecret, redirectUri };
}

/**
 * Diz se a integração está disponível e, quando não está, **quais nomes faltam** —
 * a tela usa `disponivel` para se esconder; `faltando` e `parecidos` servem para
 * diagnosticar a configuração no Lovable sem precisar de acesso ao painel.
 * Devolve só nomes, nunca valores: ver `diagnosticarConfig`.
 */
export const integracaoMetaDisponivel = createServerFn({ method: "GET" }).handler(async () => {
  const { doProcesso, dosBindings, mesclado } = ambienteServidor();
  const nomes = [...VARIAVEIS_META, ...VARIAVEIS_REFERENCIA];
  return {
    ...diagnosticarConfig(mesclado),
    // De onde cada nome veio. Separa "o secret existe mas mora nos bindings" de
    // "o secret não chega ao Worker de jeito nenhum". Só nomes.
    origem: {
      processEnv: nomesPresentes(doProcesso, nomes),
      bindings: nomesPresentes(dosBindings, nomes),
    },
  };
});

/**
 * Ponte para as funções da migração 20260910150000.
 *
 * `src/integrations/supabase/types.ts` é gerado a partir do schema e ainda não lista
 * estas funções — regerá-lo é passo do Lovable, não daqui. Sem esta ponte, cada
 * chamada precisaria de um `as never` espalhado pelo arquivo. Concentrando a conversão
 * num lugar só, o resto do código continua legível e há um ponto único para remover
 * quando os tipos forem regerados.
 */
type FuncaoInstagram =
  | "is_influencer_owner"
  | "instagram_connect"
  | "instagram_token"
  | "instagram_status"
  | "instagram_qualification_input"
  | "instagram_record_sync"
  | "instagram_record_error"
  | "instagram_disconnect";

function rpc(supabase: unknown, nome: FuncaoInstagram, args?: Record<string, unknown>) {
  const cliente = supabase as { rpc: (n: string, a?: Record<string, unknown>) => unknown };
  return cliente.rpc(nome, args) as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

async function pedirJson(url: string, init?: RequestInit): Promise<unknown> {
  const resposta = await fetch(url, init);
  const json: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    // A frase da Meta é bem mais útil que "400 Bad Request" — é ela que diz se o
    // token venceu, se falta permissão ou se a conta não é profissional.
    throw new Error(lerErroDaMeta(json) ?? `Meta respondeu ${resposta.status}.`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Conectar
// ---------------------------------------------------------------------------

/**
 * Devolve a URL para onde mandar a candidata. O `state` carrega o id da candidatura;
 * ele não é a defesa — quem valida o dono é o banco, no retorno. Serve para o callback
 * saber de qual candidatura se trata sem confiar em nada guardado no navegador.
 */
export const iniciarConexaoInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { influencerId: string }) =>
    z.object({ influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { appId, redirectUri } = credenciais();

    // Falha aqui, e não depois do desvio pela Meta, se a pessoa não for a dona.
    const { data: dono, error } = await rpc(context.supabase, "is_influencer_owner", {
      p_influencer_id: data.influencerId,
    });
    if (error) throw new Error(error.message);
    if (!dono) throw new Error("Só a própria candidata pode conectar o Instagram dela.");

    return {
      url: montarUrlDeAutorizacao({ appId, redirectUri, state: data.influencerId }),
    };
  });

/** Troca o código pelo token longo e guarda. Chamada pela rota de retorno. */
export const concluirConexaoInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; state: string }) =>
    z.object({ code: z.string().min(1), state: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { appId, appSecret, redirectUri } = credenciais();

    // 1. Código -> token curto (1 hora, uso único).
    const corpo = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: data.code,
    });
    const curto = (await pedirJson(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: corpo.toString(),
    })) as { access_token?: string; user_id?: number | string };

    if (!curto.access_token) throw new Error("A Meta não devolveu o token de acesso.");

    // 2. Token curto -> token longo (60 dias).
    const longoUrl = new URL(`${GRAPH_HOST}/access_token`);
    longoUrl.searchParams.set("grant_type", "ig_exchange_token");
    longoUrl.searchParams.set("client_secret", appSecret);
    longoUrl.searchParams.set("access_token", curto.access_token);
    const longo = (await pedirJson(longoUrl.toString())) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!longo.access_token) throw new Error("A Meta não devolveu o token de longa duração.");

    // 3. Quem é essa conta.
    const perfilUrl = new URL(`${GRAPH_HOST}/${META_API_VERSION}/me`);
    perfilUrl.searchParams.set("fields", "id,username,followers_count,media_count");
    perfilUrl.searchParams.set("access_token", longo.access_token);
    const perfil = lerPerfil(await pedirJson(perfilUrl.toString()));
    if (!perfil) throw new Error("Não foi possível ler o perfil na Meta.");

    const expiraEm = longo.expires_in
      ? new Date(Date.now() + longo.expires_in * 1000).toISOString()
      : null;

    const { error } = await rpc(context.supabase, "instagram_connect", {
      p_influencer_id: data.state,
      p_ig_user_id: perfil.id,
      p_username: perfil.username,
      p_token: longo.access_token,
      p_expires_at: expiraEm,
      p_scopes: SCOPES.join(","),
    });
    if (error) throw new Error(error.message);

    return { usuario: perfil.username };
  });

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type StatusInstagram = {
  conectado: boolean;
  usuario?: string | null;
  conectado_em?: string | null;
  expira_em?: string | null;
  ultimo_sync?: string | null;
  ultimo_erro?: string | null;
};

export const getInstagramStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { influencerId: string }) =>
    z.object({ influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: status, error } = await rpc(context.supabase, "instagram_status", {
      p_influencer_id: data.influencerId,
    });
    if (error) throw new Error(error.message);
    return (status ?? { conectado: false }) as StatusInstagram;
  });

// ---------------------------------------------------------------------------
// Sincronizar
// ---------------------------------------------------------------------------

/**
 * Busca os números na Meta e grava. O que a candidata vê depois é o mesmo que a
 * gestora veria se tivesse digitado à mão — a diferença fica registrada em
 * `data_source = 'META_API'` e no snapshot, que é o que torna a origem auditável.
 */
export const sincronizarInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { influencerId: string }) =>
    z.object({ influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Falha cedo e com mensagem clara se a integração não estiver configurada.
    credenciais();

    const { data: token, error: erroToken } = await rpc(supabase, "instagram_token", {
      p_influencer_id: data.influencerId,
    });
    if (erroToken) throw new Error(erroToken.message);
    if (!token) throw new Error("Instagram não conectado.");

    try {
      let emUso = token as string;

      // 1. Perfil primeiro. Além de trazer os números, dá o `ig_user_id` e o
      //    `username` de que a renovação precisa — sem isso, regravar a conexão
      //    apagaria esses dois campos.
      const lerPerfilDaMeta = async (comToken: string) => {
        const url = new URL(`${GRAPH_HOST}/${META_API_VERSION}/me`);
        url.searchParams.set("fields", "id,username,followers_count,media_count");
        url.searchParams.set("access_token", comToken);
        const p = lerPerfil(await pedirJson(url.toString()));
        if (!p) throw new Error("Não foi possível ler o perfil na Meta.");
        return p;
      };

      const perfil = await lerPerfilDaMeta(emUso);

      // 2. Renova quando estiver perto de vencer. Um token que expira no meio do uso
      //    faria a candidata reconectar sem entender por quê.
      const { data: statusAtual } = await rpc(supabase, "instagram_status", {
        p_influencer_id: data.influencerId,
      });
      const expiraEm = (statusAtual as StatusInstagram | null)?.expira_em ?? null;

      if (precisaRenovar(expiraEm)) {
        const renovaUrl = new URL(`${GRAPH_HOST}/refresh_access_token`);
        renovaUrl.searchParams.set("grant_type", "ig_refresh_token");
        renovaUrl.searchParams.set("access_token", emUso);
        const renovado = (await pedirJson(renovaUrl.toString())) as {
          access_token?: string;
          expires_in?: number;
        };
        if (renovado.access_token) {
          emUso = renovado.access_token;
          const { error: erroRenovar } = await rpc(supabase, "instagram_connect", {
            p_influencer_id: data.influencerId,
            p_ig_user_id: perfil.id,
            p_username: perfil.username,
            p_token: emUso,
            p_expires_at: renovado.expires_in
              ? new Date(Date.now() + renovado.expires_in * 1000).toISOString()
              : null,
            p_scopes: SCOPES.join(","),
          });
          if (erroRenovar) throw new Error(erroRenovar.message);
        }
      }

      // 3. Demografia só existe a partir de 100 seguidores. Abaixo disso nem pedimos:
      //    a Meta responderia erro, e derrubar por causa dela invalidaria um sync que
      //    deu certo no resto.
      let publicoFeminino: number | null = null;
      if ((perfil.seguidores ?? 0) >= 100) {
        const insightsUrl = new URL(`${GRAPH_HOST}/${META_API_VERSION}/${perfil.id}/insights`);
        insightsUrl.searchParams.set("metric", "follower_demographics");
        insightsUrl.searchParams.set("period", "lifetime");
        insightsUrl.searchParams.set("metric_type", "total_value");
        insightsUrl.searchParams.set("breakdown", "gender");
        insightsUrl.searchParams.set("access_token", emUso);
        try {
          publicoFeminino = lerPublicoFeminino(await pedirJson(insightsUrl.toString()));
        } catch {
          publicoFeminino = null;
        }
      }

      // 4. A Meta não fornece `recent_posts_6m` nem `profile_type`. Recalcular a
      //    pontuação sem eles rebaixaria a candidata a cada sync, então os valores
      //    atuais entram no cálculo junto com os números novos.
      const { data: atuais, error: erroAtuais } = await rpc(
        supabase,
        "instagram_qualification_input",
        { p_influencer_id: data.influencerId },
      );
      if (erroAtuais) throw new Error(erroAtuais.message);

      // A Meta entrega três números; o resto da qualificação (tipo de perfil, nicho,
      // frequência de stories e reels) só existe no banco. Sobrepondo o que veio da
      // Meta sobre a linha atual e chamando `evaluateInfluencer`, a pontuação sai
      // pela **mesma** regra usada quando a gestora digita à mão — não há uma segunda
      // implementação para divergir.
      const avaliacao = evaluateInfluencer({
        ...(atuais as Record<string, unknown>),
        followers: perfil.seguidores,
        posts_count: perfil.publicacoes,
        female_audience_pct:
          publicoFeminino ?? (atuais as Record<string, unknown>)["female_audience_pct"],
        data_source: "META_API",
      } as Parameters<typeof evaluateInfluencer>[0]);

      const { error: erroGravar } = await rpc(supabase, "instagram_record_sync", {
        p_influencer_id: data.influencerId,
        p_followers: perfil.seguidores,
        p_posts: perfil.publicacoes,
        p_female: publicoFeminino,
        p_level: avaliacao.progress.level,
        p_score: avaliacao.progress.score,
        p_status: avaliacao.status,
        p_rule_set_version: avaliacao.ruleSetVersion,
        p_requirements: avaliacao.requirements as unknown as Json,
        p_progress: avaliacao.progress as unknown as Json,
      });
      if (erroGravar) throw new Error(erroGravar.message);

      return {
        seguidores: perfil.seguidores,
        publicacoes: perfil.publicacoes,
        publicoFeminino,
        // A tela usa isto para explicar por que o público feminino não veio.
        demografiaIndisponivel: publicoFeminino === null,
      };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Falha desconhecida no sync.";
      // Registra a falha para a candidata ver que precisa reconectar, e repassa.
      await rpc(supabase, "instagram_record_error", {
        p_influencer_id: data.influencerId,
        p_error: mensagem,
      });
      throw new Error(mensagem);
    }
  });

// ---------------------------------------------------------------------------
// Desconectar
// ---------------------------------------------------------------------------

/** LGPD: a candidata retira o acesso quando quiser, e o token sai do Vault junto. */
export const desconectarInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { influencerId: string }) =>
    z.object({ influencerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await rpc(context.supabase, "instagram_disconnect", {
      p_influencer_id: data.influencerId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
