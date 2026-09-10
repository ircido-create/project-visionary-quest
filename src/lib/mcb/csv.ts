/**
 * Geração e download de CSV.
 *
 * Duas escolhas feitas para o arquivo abrir certo no Excel em português, que é onde
 * essas planilhas vão parar:
 *
 * - **Ponto e vírgula como separador.** O Excel em pt-BR usa a vírgula como separador
 *   decimal, então um CSV separado por vírgula abre com tudo numa coluna só.
 * - **BOM no início.** Sem ele o Excel lê o arquivo como Latin-1 e "Patrícia" vira
 *   "PatrÃ­cia".
 *
 * Quem abrir em Google Sheets ou LibreOffice não é prejudicado: ambos detectam o
 * separador e o encoding sozinhos.
 */

const SEPARADOR = ";";

/** Escapa um valor. Campo com aspas, separador ou quebra de linha vai entre aspas. */
function campo(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  const texto = String(valor);
  if (texto.includes('"') || texto.includes(SEPARADOR) || /[\r\n]/.test(texto)) {
    return `"${texto.replaceAll('"', '""')}"`;
  }
  return texto;
}

export function gerarCsv(cabecalho: string[], linhas: unknown[][]): string {
  const conteudo = [cabecalho, ...linhas]
    .map((linha) => linha.map(campo).join(SEPARADOR))
    .join("\r\n");

  // O BOM (\uFEFF) vai como escape: o caractere literal é invisível no código e o
  // lint reclama dele com razão. Precisa vir antes de tudo, inclusive do cabeçalho.
  return `\uFEFF${conteudo}`;
}

/** Número no formato brasileiro, para o Excel reconhecer como número e não como texto. */
export function numeroBr(valor: number | null | undefined, casas = 0): string {
  if (valor === null || valor === undefined) return "";
  return valor.toFixed(casas).replace(".", ",");
}

export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Dispara o download no navegador. Fica aqui, e não no componente, porque a criação e
 * a revogação da URL temporária andam juntas — separá-las vaza memória.
 */
export function baixarCsv(nomeDoArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nomeDoArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
