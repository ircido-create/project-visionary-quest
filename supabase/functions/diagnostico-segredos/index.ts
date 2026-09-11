/**
 * Diagnóstico: quais secrets esta Edge Function enxerga. Só nomes, nunca valores.
 *
 * Existe para responder duas perguntas antes de mover a Meta e o Gemini para cá:
 *
 * 1. O Lovable faz o deploy de Edge Functions que chegam pelo GitHub?
 * 2. Os secrets de Cloud → Secrets chegam aqui? No servidor do app, comprovadamente,
 *    não chegam — a checagem `integracaoMetaDisponivel` mostrou isso em produção.
 *
 * É pública (`verify_jwt = false`) porque responde apenas nomes, que já estão no
 * repositório. Apagar quando a decisão estiver tomada.
 */

const NOMES = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_REDIRECT_URI",
  "GEMINI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const presentes = NOMES.filter((nome) => Boolean(Deno.env.get(nome)?.trim()));
  return new Response(JSON.stringify({ presentes }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
