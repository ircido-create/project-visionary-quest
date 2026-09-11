/**
 * Leitura de variáveis de ambiente no servidor.
 *
 * POR QUE DOIS LUGARES
 *
 * No Cloudflare Worker onde o app roda, uma variável pode chegar por dois caminhos:
 *
 * - `process.env`, do módulo `node:process`, que o Cloudflare preenche;
 * - `globalThis.__env__`, os bindings do Worker, que o nitro atribui a cada
 *   requisição (ver `nitro/dist/presets/cloudflare/runtime/_module-handler.mjs`).
 *
 * O diagnóstico em produção mostrou `SUPABASE_URL` (vindo do `.env`) em
 * `process.env`, e os secrets de Cloud → Secrets (GEMINI_API_KEY e os da Meta) fora
 * dele. O post do Lovable diz que secrets são injetados "como bindings". Ler os dois
 * lugares cobre esse caso sem mudar nada onde `process.env` já funciona.
 *
 * `process.env` tem prioridade: é o comportamento que existia antes deste arquivo.
 */

type Ambiente = Record<string, string | undefined>;

/**
 * Os bindings também carregam objetos (o `ASSETS`, por exemplo). Só texto interessa
 * aqui, e só texto pode ser tratado como variável.
 */
export function somenteTexto(obj: unknown): Ambiente {
  if (typeof obj !== "object" || obj === null) return {};
  const saida: Ambiente = {};
  for (const [nome, valor] of Object.entries(obj)) {
    if (typeof valor === "string") saida[nome] = valor;
  }
  return saida;
}

export function mesclarAmbiente(doProcesso: Ambiente, dosBindings: Ambiente): Ambiente {
  const mesclado: Ambiente = { ...dosBindings };
  for (const [nome, valor] of Object.entries(doProcesso)) {
    if (valor !== undefined && valor.trim() !== "") mesclado[nome] = valor;
  }
  return mesclado;
}

/** Quais destes nomes têm valor. Devolve só nomes — nunca o conteúdo. */
export function nomesPresentes(env: Ambiente, nomes: readonly string[]): string[] {
  return nomes.filter((nome) => Boolean(env[nome]?.trim()));
}

export function ambienteServidor() {
  const doProcesso = somenteTexto(process.env);
  const dosBindings = somenteTexto((globalThis as { __env__?: unknown }).__env__);
  return { doProcesso, dosBindings, mesclado: mesclarAmbiente(doProcesso, dosBindings) };
}

export function lerEnv(nome: string): string | undefined {
  const valor = ambienteServidor().mesclado[nome]?.trim();
  return valor ? valor : undefined;
}
