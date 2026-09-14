/**
 * Fase 10 — Encerrar o ambiente: as regras que não dependem de rede.
 *
 * A exclusão pede o nome do ambiente digitado de novo. A comparação ignora maiúsculas,
 * espaços nas pontas e espaços repetidos — o que importa é a intenção, não a digitação.
 */

function normalizar(texto: string): string {
  return texto.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function confirmacaoDoAmbienteConfere(digitado: string, nome: string): boolean {
  const alvo = normalizar(nome);
  return alvo.length > 0 && normalizar(digitado) === alvo;
}

export function nomeDoArquivoDeExportacao(slug: string, agora: Date = new Date()): string {
  return `mcb-${slug}-${agora.toISOString().slice(0, 10)}.json`;
}

const ROTULOS: Array<[string, string, string]> = [
  ["candidatas", "candidata", "candidatas"],
  ["tarefas", "tarefa", "tarefas"],
  ["feedbacks", "feedback", "feedbacks"],
  ["arquivos", "arquivo", "arquivos"],
  ["membros", "pessoa da equipe", "pessoas da equipe"],
  ["pagamentos", "pagamento", "pagamentos"],
];

/** "2 candidatas, 5 tarefas, 1 pessoa da equipe" — só o que havia. */
export function resumoDaExclusaoDoAmbiente(contagem: Record<string, number>): string {
  const partes = ROTULOS.flatMap(([chave, um, varios]) => {
    const n = contagem[chave] ?? 0;
    return n > 0 ? [`${n} ${n === 1 ? um : varios}`] : [];
  });
  return partes.length > 0 ? partes.join(", ") : "o ambiente estava vazio";
}
