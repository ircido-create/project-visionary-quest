/**
 * Normaliza o @ do Instagram.
 *
 * Quem cadastra costuma colar o link do perfil, às vezes com parâmetros de rastreio
 * (`?stkn=...`) ou barra no fim. A Meta compara o @ exato na hora de conectar, então um
 * "@https://www.instagram.com/fulana?stkn=abc" faz a conexão falhar sem explicação. Aqui
 * o valor vira sempre o nome de usuário, ou nulo quando não dá para extrair.
 */

/** Caracteres aceitos pelo Instagram num nome de usuário. */
const USUARIO = /^[A-Za-z0-9._]{1,30}$/;

export function normalizarHandle(valor: string | null | undefined): string | null {
  if (!valor) return null;
  let texto = valor.trim();
  if (texto === "") return null;

  // Link do perfil, com ou sem protocolo, com ou sem parâmetros.
  const comoLink = texto.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  if (comoLink.toLowerCase().startsWith("instagram.com/")) {
    texto = comoLink.slice("instagram.com/".length);
  }

  texto = texto.split(/[?#]/)[0] ?? "";
  texto = texto.replace(/\/+$/, "");
  texto = texto.replace(/^@+/, "");
  // Sobrou caminho ("fulana/reels"): fica só a primeira parte.
  texto = texto.split("/")[0] ?? "";
  texto = texto.trim();

  return USUARIO.test(texto) ? texto : null;
}

/** Endereço público do perfil, a partir de qualquer forma de @ informada. */
export function urlDoPerfil(valor: string | null | undefined): string | null {
  const handle = normalizarHandle(valor);
  return handle ? `https://instagram.com/${handle}` : null;
}
