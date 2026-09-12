/**
 * Páginas públicas de candidatura: qual delas o botão da página inicial abre e o que uma
 * página de demonstração pode receber.
 *
 * Ambiente de demonstração é legível por qualquer conta logada (`can_read_tenant`), de
 * propósito, para quem está conhecendo a plataforma. Por isso ele não pode receber
 * inscrição de verdade. Em 2026-09-12 havia duas inscrições reais num ambiente de
 * demonstração: o botão da página inicial abria a primeira página criada, e ela era de
 * demonstração.
 */

export type PaginaPublica = { name: string; slug: string; is_demo: boolean };

/** Reais primeiro, na ordem em que vieram; demonstrações depois. */
export function ordenarPaginas<T extends PaginaPublica>(paginas: T[]): T[] {
  return [...paginas.filter((p) => !p.is_demo), ...paginas.filter((p) => p.is_demo)];
}

/**
 * A página do botão principal: a primeira real. Sem nenhuma real, a primeira de
 * demonstração — que mostra o formulário, mas não aceita envio.
 */
export function paginaPrincipal<T extends PaginaPublica>(paginas: T[]): T | null {
  return ordenarPaginas(paginas)[0] ?? null;
}

/** Resposta do servidor a um envio numa página de demonstração. */
export const MENSAGEM_DEMONSTRACAO =
  "Esta é uma página de demonstração e não recebe candidaturas. Use o link enviado pela sua gestora.";

/** Aviso fixo na própria página de demonstração, antes do formulário. */
export const AVISO_PAGINA_DEMONSTRACAO =
  "Página de demonstração: ela mostra como a candidatura funciona, mas não recebe inscrições. Para se candidatar, use o link enviado pela sua gestora.";
