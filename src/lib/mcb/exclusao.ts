/**
 * Fase 6 — Exclusão de dados a pedido: as regras, sem rede nem banco.
 *
 * A exclusão é definitiva e não tem volta, então as regras aqui existem para errar do
 * lado seguro: confirmação digitada, busca por e-mail sem curinga, conta de acesso só
 * apagada quando ela não serve a mais nada.
 */

export type ContagemExclusao = {
  inscricoes: number;
  consentimentos: number;
  tarefas: number;
  notas: number;
  feedbacks: number;
  registros_de_numeros: number;
  avaliacoes: number;
  historico: number;
  analises_ia: number;
  arquivos: number;
};

/** A confirmação é o e-mail da candidata digitado de novo — ignora maiúsculas e espaços. */
export function confirmacaoConfere(digitado: string, email: string): boolean {
  const confirmacao = digitado.trim().toLowerCase();
  return confirmacao.length > 0 && confirmacao === email.trim().toLowerCase();
}

/**
 * Escapa `%`, `_` e `\` para uma busca `ilike` que compara o texto exato, sem diferenciar
 * maiúsculas. Sem isto, "ana_b@x.com" também acharia "anaxb@x.com".
 */
export function escaparIlike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type SituacaoConta = {
  temConta: boolean;
  outrasCandidaturas: number;
  membroDeAmbiente: boolean;
  papelNaPlataforma: boolean;
};

/**
 * Por que a conta de acesso não pode ser apagada junto, ou `null` se pode. A conta é da
 * pessoa, não da candidatura: se ela também é gestora, administra a plataforma ou se
 * candidatou em outro ambiente, apagar a conta tiraria dela o que ela não pediu para
 * perder.
 */
export function motivoParaManterConta(situacao: SituacaoConta): string | null {
  if (!situacao.temConta) return "ela não criou conta de acesso ao portal.";
  if (situacao.papelNaPlataforma) return "a conta tem papel na administração da plataforma.";
  if (situacao.membroDeAmbiente) return "a conta também é de gestora ou equipe de um ambiente.";
  if (situacao.outrasCandidaturas > 0) {
    return situacao.outrasCandidaturas === 1
      ? "a conta tem outra candidatura, em outro ambiente."
      : `a conta tem outras ${situacao.outrasCandidaturas} candidaturas, em outros ambientes.`;
  }
  return null;
}

const ROTULOS: Array<[keyof ContagemExclusao, string, string]> = [
  ["inscricoes", "inscrição", "inscrições"],
  ["consentimentos", "consentimento", "consentimentos"],
  ["tarefas", "tarefa", "tarefas"],
  ["notas", "nota", "notas"],
  ["feedbacks", "feedback", "feedbacks"],
  ["registros_de_numeros", "registro de números", "registros de números"],
  ["avaliacoes", "avaliação", "avaliações"],
  ["historico", "mudança de etapa", "mudanças de etapa"],
  ["analises_ia", "análise de IA", "análises de IA"],
  ["arquivos", "arquivo", "arquivos"],
];

/** "1 inscrição, 3 tarefas, 5 registros de números" — só o que tinha. */
export function resumoExclusao(contagem: Partial<ContagemExclusao>): string {
  const partes = ROTULOS.flatMap(([chave, singular, plural]) => {
    const n = contagem[chave] ?? 0;
    return n > 0 ? [`${n} ${n === 1 ? singular : plural}`] : [];
  });
  return partes.length > 0 ? partes.join(", ") : "só o cadastro";
}

/**
 * Caminhos completos no bucket a partir do que a listagem da pasta devolve. A pasta da
 * candidata é `{tenant_id}/{influencer_id}/`; entradas vazias ou de subpasta ficam fora.
 */
export function caminhosDeEvidencia(
  tenantId: string,
  influencerId: string,
  nomes: string[],
): string[] {
  const pasta = `${tenantId}/${influencerId}`;
  return nomes.filter((n) => n.length > 0 && !n.includes("/")).map((n) => `${pasta}/${n}`);
}
