/**
 * Prompt da análise de perfil e o schema da resposta.
 *
 * Fica em módulo separado de propósito: `PROMPT_VERSION` é gravado em cada linha de
 * `ai_analyses`, então mudar o texto abaixo sem subir a versão torna impossível
 * explicar depois por que duas candidatas receberam leituras diferentes.
 *
 * Ao editar o prompt ou o schema, **suba a versão**. Trocar de modelo não exige isso:
 * `ai_analyses.model` guarda o modelo em coluna própria, então a procedência já fica
 * registrada sem confundir as duas coisas.
 *
 * v2: migrado para Gemini. O payload deixou de enviar cidade e estado: eles quase não
 * contribuem para a leitura e, combinados com o nicho, podiam identificar a candidata
 * num serviço de camada gratuita, que costuma treinar com o que recebe.
 */

import * as z from "zod/v4";

/** Versão do prompt. Subir a cada alteração no texto ou no schema. */
export const PROMPT_VERSION = "v2";

/** Modelo usado. Gravado junto da análise — resultado sem modelo não é auditável. */
export const ANALYSIS_MODEL = "gemini-3.6-flash";

export const analysisSchema = z.object({
  resumo: z.string().describe("Duas ou três frases sobre onde a candidata está hoje."),
  pontos_fortes: z.array(z.string()).describe("O que já funciona no perfil."),
  lacunas: z.array(z.string()).describe("O que falta, em ordem de impacto."),
  proximos_passos: z
    .array(z.string())
    .describe("Ações concretas, executáveis nas próximas duas semanas."),
  confianca: z
    .enum(["ALTA", "MEDIA", "BAIXA"])
    .describe("Quanto os dados disponíveis sustentam a leitura."),
  dados_faltantes: z
    .array(z.string())
    .describe("O que precisaria ser levantado para a leitura melhorar."),
});

export type AnalysisOutput = z.infer<typeof analysisSchema>;

export const SYSTEM_PROMPT = `Você apoia gestoras do Método Criadora Blessing (MCB) na leitura de perfis
de candidatas a criadora de conteúdo no Instagram.

O método tem cinco etapas: Estruture (nicho, bio, organização do perfil),
Apareça, Conecte, Ensine e Converta. Sua leitura deve situar a candidata nessas etapas.

Regras que não se quebram:

1. Trabalhe apenas com os dados fornecidos. Nunca estime, complete ou invente número
   que não esteja na entrada. Se um dado falta, diga que falta.
2. Você não decide se a candidata é aprovada. A qualificação é feita por regras
   determinísticas fora daqui, e a decisão final é de uma pessoa.
3. Nunca afirme nem sugira que a candidata será aprovada em qualquer programa.
4. Escreva em português do Brasil, direto, sem jargão de marketing e sem elogio vazio.
   A gestora precisa de leitura útil, não de animação.
5. Em "proximos_passos", proponha ações que a candidata consiga executar sozinha nas
   próximas duas semanas. Nada de "aumente o engajamento" — diga o que fazer.

Se os dados forem escassos, marque "confianca" como BAIXA e liste o que falta em
"dados_faltantes". Leitura honesta e curta vale mais que leitura longa e inventada.`;

type PromptInput = {
  metrics: Record<string, unknown>;
  profile: Record<string, unknown>;
  /** Legendas de prints que uma pessoa já conferiu. Print não confirmado não entra. */
  confirmedEvidence: string[];
};

export function buildAnalysisPrompt(input: PromptInput): string {
  const evidencia =
    input.confirmedEvidence.length > 0
      ? input.confirmedEvidence.map((item, i) => `${i + 1}. ${item}`).join("\n")
      : "(nenhuma evidência confirmada por uma pessoa até agora)";

  return `Analise esta candidata.

## Métricas
${JSON.stringify(input.metrics, null, 2)}

## Dados do perfil
${JSON.stringify(input.profile, null, 2)}

## Evidências confirmadas por uma pessoa
${evidencia}`;
}
