/**
 * Fase 4 — Integração oficial Meta/Instagram: constantes e leitura das respostas.
 *
 * Aqui fica só o que é puro — montar URL, interpretar json. As chamadas de rede e o
 * acesso ao banco estão em `instagram.functions.ts`, que roda no servidor.
 *
 * QUAL DAS APIs DA META
 *
 * "Instagram API with Instagram Login" (host `graph.instagram.com`), não a que passa
 * pelo Facebook. A diferença que decide: o caminho pelo Facebook exige que a conta do
 * Instagram esteja vinculada a uma Página do Facebook, e as candidatas do MCB
 * tipicamente não têm Página. Pelo Instagram Login, ela entra com a conta dela e
 * pronto.
 *
 * O QUE A META NÃO ENTREGA
 *
 * `follower_demographics` — de onde sai o público feminino — **só existe a partir de
 * 100 seguidores**. Abaixo disso a Meta não devolve o dado, e não há contorno pela
 * API. Por isso o fluxo de print com confirmação humana continua existindo: ele não
 * é redundante com a integração, é o que cobre as contas pequenas.
 *
 * A conta também precisa ser Profissional (Business ou Criador). Conta pessoal não é
 * aceita pela API — o que casa com a tarefa "migrar para conta de criador" que o
 * método já pede.
 */

/** Fixada de propósito: a Meta muda o padrão e uma versão flutuante quebraria sozinha. */
export const META_API_VERSION = "v25.0";

export const OAUTH_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const OAUTH_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export const GRAPH_HOST = "https://graph.instagram.com";

/**
 * `instagram_business_basic` dá perfil, seguidores e publicações;
 * `instagram_business_manage_insights` é o que libera `follower_demographics`.
 * Nada além disso: pedir escopo que não se usa atrasa a revisão da Meta sem motivo.
 */
export const SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"] as const;

/** Token longo dura 60 dias. Renovamos antes disso, com folga. */
export const DIAS_ANTES_DE_RENOVAR = 10;

export function montarUrlDeAutorizacao(params: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("state", params.state);
  return url.toString();
}

export type PerfilInstagram = {
  id: string;
  username: string | null;
  seguidores: number | null;
  publicacoes: number | null;
};

/**
 * Lê a resposta de `/me?fields=...`. Devolve nulo em campo ausente em vez de zero:
 * "não veio" e "é zero" são coisas diferentes, e o motor de qualificação trata
 * ausência como desconhecido, não como reprovação.
 */
export function lerPerfil(json: unknown): PerfilInstagram | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  if (typeof o["id"] !== "string") return null;

  const inteiro = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;

  return {
    id: o["id"],
    username: typeof o["username"] === "string" ? o["username"] : null,
    seguidores: inteiro(o["followers_count"]),
    publicacoes: inteiro(o["media_count"]),
  };
}

/**
 * Extrai o percentual de público feminino de `follower_demographics` com quebra por
 * gênero.
 *
 * A resposta é aninhada e a Meta já mudou esse formato antes. A leitura aqui é
 * defensiva de propósito: qualquer desvio do esperado devolve `null`, e `null`
 * significa "não sei", que preserva o valor anterior em vez de sobrescrever um dado
 * bom com lixo. Errar para o lado de não gravar é barato; gravar número inventado
 * numa decisão de qualificação, não.
 *
 * A Meta devolve as dimensões como F, M e U (não informado). O denominador inclui U:
 * a pergunta do método é "que fração do público é feminina", e quem não informou
 * gênero faz parte do público.
 */
export function lerPublicoFeminino(json: unknown): number | null {
  if (typeof json !== "object" || json === null) return null;
  const dados = (json as Record<string, unknown>)["data"];
  if (!Array.isArray(dados) || dados.length === 0) return null;

  const primeiro = dados[0] as Record<string, unknown> | undefined;
  const totalValue = primeiro?.["total_value"] as Record<string, unknown> | undefined;
  const breakdowns = totalValue?.["breakdowns"];
  if (!Array.isArray(breakdowns) || breakdowns.length === 0) return null;

  const resultados = (breakdowns[0] as Record<string, unknown>)?.["results"];
  if (!Array.isArray(resultados) || resultados.length === 0) return null;

  let feminino = 0;
  let total = 0;
  for (const linha of resultados) {
    const r = linha as Record<string, unknown>;
    const dimensoes = r["dimension_values"];
    const valor = r["value"];
    if (!Array.isArray(dimensoes) || typeof valor !== "number" || !Number.isFinite(valor)) continue;

    total += valor;
    if (String(dimensoes[0]).toUpperCase() === "F") feminino += valor;
  }

  if (total <= 0) return null;
  return Math.round((feminino / total) * 1000) / 10;
}

/** Erro da Meta vem embrulhado; queremos a frase útil, não "[object Object]". */
export function lerErroDaMeta(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const erro = (json as Record<string, unknown>)["error"];
  if (typeof erro !== "object" || erro === null) return null;
  const m = (erro as Record<string, unknown>)["message"];
  return typeof m === "string" ? m : null;
}

/** Precisa renovar? Token sem validade conhecida conta como "sim", por segurança. */
export function precisaRenovar(expiraEm: string | null, agora = new Date()): boolean {
  if (!expiraEm) return true;
  const limite = new Date(expiraEm).getTime() - DIAS_ANTES_DE_RENOVAR * 24 * 60 * 60 * 1000;
  return agora.getTime() >= limite;
}

/** Os três nomes que a integração lê do ambiente. */
export const VARIAVEIS_META = ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"] as const;

export type DiagnosticoConfig = {
  disponivel: boolean;
  /** Nomes esperados que não existem ou estão vazios. */
  faltando: string[];
  /**
   * Nomes que existem no ambiente, lembram os esperados, mas não batem exatamente —
   * maiúscula trocada, espaço sobrando, erro de digitação. É a causa mais comum de
   * "cadastrei e não funciona", e `faltando` sozinho não explicaria o motivo.
   */
  parecidos: string[];
};

/**
 * Diz o que falta na configuração **sem expor valor nenhum**: devolve só nomes, que
 * já são públicos neste repositório. Nunca incluir aqui o conteúdo de uma variável.
 */
export function diagnosticarConfig(env: Record<string, string | undefined>): DiagnosticoConfig {
  const faltando = VARIAVEIS_META.filter((nome) => !env[nome]?.trim());
  const normalizar = (nome: string) =>
    nome
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
  const alvos = new Set(VARIAVEIS_META.map(normalizar));
  const parecidos = Object.keys(env).filter(
    (nome) =>
      !(VARIAVEIS_META as readonly string[]).includes(nome) &&
      (alvos.has(normalizar(nome)) || /meta/i.test(nome)),
  );
  return { disponivel: faltando.length === 0, faltando, parecidos };
}
