/**
 * ONBIO — consulta de seguidores na Meta pelo servidor, com a chave de serviço.
 *
 * Usada pela rotina agendada (`/api/rotinas/instagram`) e pelo botão "Atualizar
 * seguidores" da gestora. O token sai do Vault só aqui dentro, vai para a Meta e não
 * volta em resposta nenhuma. Falha vira `last_sync_error` com a frase da Meta — nunca
 * com o token, que só existe na URL da requisição e não é registrado.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  GRAPH_HOST,
  META_API_VERSION,
  lerErroDaMeta,
  lerPerfil,
  precisaRenovar,
} from "@/lib/mcb/instagram";

type Rpc = (
  nome: string,
  args?: Record<string, unknown>,
) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

const rpc: Rpc = (nome, args) => (supabaseAdmin as unknown as { rpc: Rpc }).rpc(nome, args);

export type ResultadoDaConsulta =
  | { ok: true; influencerId: string; seguidores: number | null; publicacoes: number | null }
  | { ok: false; influencerId: string; erro: string };

async function pedirJson(url: URL): Promise<unknown> {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const json: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 429) {
      throw new Error("Limite de consultas da Meta atingido. A próxima rotina tenta de novo.");
    }
    throw new Error(lerErroDaMeta(json) ?? `Meta respondeu ${resposta.status}.`);
  }
  return json;
}

/** Consulta uma conta conectada e grava o resultado (ou o erro). */
export async function consultarSeguidores(params: {
  influencerId: string;
  usuarioCadastrado: string | null;
  expiraEm: string | null;
  ator: string | null;
}): Promise<ResultadoDaConsulta> {
  const { influencerId } = params;
  try {
    const { data: token, error } = await rpc("instagram_token_servico", {
      p_influencer_id: influencerId,
    });
    if (error) throw new Error(error.message);
    if (typeof token !== "string" || !token) throw new Error("Instagram não conectado.");

    let emUso = token;

    // Token longo dura 60 dias; renovar perto do fim evita a afiliada ter de reconectar.
    if (precisaRenovar(params.expiraEm)) {
      try {
        const url = new URL(`${GRAPH_HOST}/refresh_access_token`);
        url.searchParams.set("grant_type", "ig_refresh_token");
        url.searchParams.set("access_token", emUso);
        const renovado = (await pedirJson(url)) as { access_token?: string; expires_in?: number };
        if (renovado.access_token) {
          emUso = renovado.access_token;
          const { error: erroRenovar } = await rpc("instagram_renovar_token_servico", {
            p_influencer_id: influencerId,
            p_token: emUso,
            p_expira_em: renovado.expires_in
              ? new Date(Date.now() + renovado.expires_in * 1000).toISOString()
              : null,
          });
          if (erroRenovar) throw new Error(erroRenovar.message);
        }
      } catch (erro) {
        // Token já vencido não renova; a leitura abaixo devolve a frase certa da Meta.
        if (params.expiraEm && new Date(params.expiraEm) < new Date()) throw erro;
      }
    }

    const url = new URL(`${GRAPH_HOST}/${META_API_VERSION}/me`);
    url.searchParams.set("fields", "id,username,followers_count,media_count");
    url.searchParams.set("access_token", emUso);
    const perfil = lerPerfil(await pedirJson(url));
    if (!perfil) throw new Error("Não foi possível ler o perfil na Meta.");
    if (perfil.seguidores === null) {
      throw new Error(
        "A Meta não informou os seguidores desta conta. Confirme que ela é profissional.",
      );
    }

    const cadastrado = params.usuarioCadastrado?.replace(/^@/, "").toLowerCase() ?? null;
    const autorizado = perfil.username?.replace(/^@/, "").toLowerCase() ?? null;
    if (cadastrado && autorizado && cadastrado !== autorizado) {
      throw new Error(
        `A conta conectada é @${perfil.username}, mas o cadastro informa @${params.usuarioCadastrado}. Corrija o @ ou peça nova conexão.`,
      );
    }

    const { error: erroGravar } = await rpc("instagram_gravar_servico", {
      p_influencer_id: influencerId,
      p_followers: perfil.seguidores,
      p_posts: perfil.publicacoes,
      p_ator: params.ator,
    });
    if (erroGravar) throw new Error(erroGravar.message);

    return {
      ok: true,
      influencerId,
      seguidores: perfil.seguidores,
      publicacoes: perfil.publicacoes,
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha desconhecida na consulta.";
    await rpc("instagram_erro_servico", { p_influencer_id: influencerId, p_erro: mensagem });
    return { ok: false, influencerId, erro: mensagem };
  }
}

/** Uma passada da rotina: contas vencidas pelo intervalo do ambiente, uma de cada vez. */
export async function executarRotina(limite = 25) {
  const { data, error } = await rpc("instagram_fila_de_atualizacao", { p_limite: limite });
  if (error) throw new Error(error.message);
  const fila = (data ?? []) as Array<{
    influencer_id: string;
    usuario: string | null;
    expira_em: string | null;
  }>;

  const { data: cadastros } = fila.length
    ? await supabaseAdmin
        .from("influencers")
        .select("id, instagram_handle")
        .in(
          "id",
          fila.map((c) => c.influencer_id),
        )
    : { data: [] };
  const handle = new Map((cadastros ?? []).map((c) => [c.id, c.instagram_handle]));

  let atualizadas = 0;
  let falhas = 0;
  // Em série de propósito: cada conta tem o próprio limite na Meta, mas não há pressa
  // que justifique disparar tudo junto e estourar o tempo da função.
  for (const conta of fila) {
    const resultado = await consultarSeguidores({
      influencerId: conta.influencer_id,
      usuarioCadastrado: handle.get(conta.influencer_id) ?? conta.usuario,
      expiraEm: conta.expira_em,
      ator: null,
    });
    if (resultado.ok) atualizadas += 1;
    else falhas += 1;
  }
  return { consultadas: fila.length, atualizadas, falhas };
}

/** Compara o cabeçalho da chamada agendada com o segredo do Vault, sem vazar tempo. */
export async function chamadaDaRotinaValida(recebido: string | null): Promise<boolean> {
  if (!recebido) return false;
  const { data, error } = await rpc("instagram_segredo_da_rotina");
  if (error || typeof data !== "string" || !data) return false;
  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(data);
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) diferenca |= a[i]! ^ b[i]!;
  return diferenca === 0;
}
