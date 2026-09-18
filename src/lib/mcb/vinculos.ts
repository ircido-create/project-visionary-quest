/**
 * Vínculo de uma mesma pessoa em dois ambientes.
 *
 * O texto abaixo é o que a afiliada lê antes de decidir, e é gravado junto com a resposta
 * dela. Se o texto mudar, o registro antigo continua mostrando o que foi combinado na
 * época — é isso que torna o consentimento auditável.
 */

export const TEXTO_DO_CONSENTIMENTO_DE_VINCULO =
  "Autorizo que meu nome, e-mail e WhatsApp sejam compartilhados entre os dois ambientes " +
  "indicados, para que eu seja acompanhada nos dois programas pela mesma gestora. " +
  "Meus números, tarefas, notas, arquivos, etapas e histórico continuam separados por " +
  "ambiente. Posso desfazer este vínculo quando quiser, e desfazer não apaga meus dados.";

export const SITUACAO_DO_VINCULO = {
  PENDENTE: "Aguardando a resposta da afiliada",
  ACEITO: "Vínculo autorizado pela afiliada",
  RECUSADO: "A afiliada recusou o vínculo",
} as const;

export type SituacaoDoVinculo = keyof typeof SITUACAO_DO_VINCULO;
