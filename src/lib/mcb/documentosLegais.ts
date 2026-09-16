/**
 * Fase 6 — Política de Privacidade e Termos de Uso.
 *
 * O texto descreve o que o sistema faz de fato — conferido no código e no banco em
 * 2026-09-13 —, não um modelo genérico. Ao mudar o que a plataforma coleta, com quem
 * compartilha ou como exclui, mude aqui e suba a versão: cada inscrição grava a versão da
 * política aceita em `consent_logs.version`.
 *
 * Revisão jurídica validada em 2026-09-13 (P1 a P11 e T1 a T6). Ao mudar o texto, suba a
 * versão; se a mudança pedir novo aceite de quem já tem conta, suba também
 * `VERSAO_ACEITE_EXIGIDO`.
 */

import { DIAS_PARA_EXCLUSAO } from "./inatividade";

export const CONTROLADOR = {
  /** Como consta no CNPJ. */
  razaoSocial: "MONIQUE ANNELINE DA SILVA KALLAGIAN" as string | null,
  nomeFantasia: "MCB — Método Criadora Blessing",
  cnpj: "31.293.212/0001-38",
  email: "contato@mcblessing.com.br",
  /** Cidade/UF da sede, para a cláusula de foro dos Termos. */
  foro: "Osasco/SP" as string | null,
};

export const VERSAO_POLITICA = "2026-09-13.6";
export const VERSAO_TERMOS = "2026-09-13.6";

/**
 * Aceite mínimo para usar a área logada (T1). Só sobe quando a mudança pede novo aceite de
 * quem já tem conta; correção de texto não.
 */
export const VERSAO_ACEITE_EXIGIDO = "2026-09-13.4";
export const IDADE_MINIMA = 18;

export function nomeDoControlador(): string {
  return CONTROLADOR.razaoSocial ?? CONTROLADOR.nomeFantasia;
}

/** O que falta preencher antes de publicar os documentos. */
export function pendenciasDosDocumentos(): string[] {
  const faltam: string[] = [];
  if (!CONTROLADOR.razaoSocial) faltam.push("razão social");
  if (!CONTROLADOR.foro) faltam.push("cidade do foro");
  return faltam;
}

/** Confere os dois dígitos verificadores do CNPJ. */
export function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digito = (base: string) => {
    let peso = base.length - 7;
    let soma = 0;
    for (const c of base) {
      soma += Number(c) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const primeiro = digito(d.slice(0, 12));
  const segundo = digito(d.slice(0, 12) + primeiro);
  return d.endsWith(`${primeiro}${segundo}`);
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-09-13" → "13 de setembro de 2026". */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return `${dia} de ${MESES[(mes ?? 1) - 1]} de ${ano}`;
}

/**
 * "2026-09-13.3" → "13 de setembro de 2026, revisão 2". Mudou o texto no mesmo dia, sobe a
 * revisão: cada consentimento guarda a versão exata que foi aceita.
 */
export function descreverVersao(versao: string): string {
  const [data = versao, revisao] = versao.split(".");
  return revisao ? `${dataPorExtenso(data)}, revisão ${revisao}` : dataPorExtenso(data);
}

export type Bloco = { tipo: "p"; texto: string } | { tipo: "lista"; itens: string[] };
export type Secao = { id: string; titulo: string; blocos: Bloco[] };

const p = (texto: string): Bloco => ({ tipo: "p", texto });
const lista = (...itens: string[]): Bloco => ({ tipo: "lista", itens });

function partesDaVersao(versao: string): [string, number] {
  const [data = "", revisao] = versao.split(".");
  return [data, revisao ? Number(revisao) : 1];
}

/** Se alguma das versões aceitas é igual ou posterior à exigida. */
export function aceiteEmDia(versoesAceitas: string[], exigida: string): boolean {
  const [dataExigida, revisaoExigida] = partesDaVersao(exigida);
  return versoesAceitas.some((versao) => {
    const [data, revisao] = partesDaVersao(versao);
    return data > dataExigida || (data === dataExigida && revisao >= revisaoExigida);
  });
}

/** Aviso do formulário de candidatura sobre as respostas abertas (P8). */
export const AVISO_DADOS_SENSIVEIS =
  "Não inclua nas respostas informações sobre saúde, religião, opinião política, vida sexual, origem racial ou outros dados sensíveis.";

const AVISO_DE_MUDANCAS =
  "Mudanças relevantes serão avisadas por e-mail com 15 dias de antecedência. Se mudarmos a finalidade do uso dos dados de candidatas, pediremos um novo consentimento.";

export function politicaDePrivacidade(): Secao[] {
  const { cnpj, email } = CONTROLADOR;
  const nome = nomeDoControlador();
  return [
    {
      id: "responsavel",
      titulo: "Quem é o responsável",
      blocos: [
        p(
          `${nome}, CNPJ ${cnpj}, é a responsável pela plataforma MCB. Pedidos sobre seus dados — dúvidas, acesso, correção ou exclusão — podem ser feitos à sua gestora ou à MCB, pelo e-mail ${email}; a MCB encaminha e apoia a resposta. Por se enquadrar como agente de tratamento de pequeno porte (Resolução CD/ANPD nº 2/2022), a MCB não indicou encarregado; esse é o canal para assuntos de dados pessoais.`,
        ),
        p(
          "Cada gestora é a controladora dos dados das candidatas que se inscrevem pela página dela: é ela quem decide como acompanhar cada candidata. A MCB opera a plataforma para as gestoras e trata esses dados em nome delas, conforme as instruções delas e esta política. A MCB é controladora dos dados das contas das gestoras e não usa os dados das candidatas para fins próprios.",
        ),
      ],
    },
    {
      id: "a-quem-se-aplica",
      titulo: "A quem esta política se aplica",
      blocos: [
        lista(
          "Candidatas que se inscrevem pela página de candidatura de uma gestora e, se quiserem, usam o portal da candidata.",
          "Gestoras e pessoas da equipe delas, que usam a plataforma para acompanhar candidatas.",
          "Quem visita o site.",
        ),
      ],
    },
    {
      id: "dados",
      titulo: "Dados que tratamos",
      blocos: [
        p("De candidatas:"),
        lista(
          "Identificação e contato: nome, e-mail, WhatsApp, cidade e estado.",
          "Perfil do Instagram: @, link do perfil, número de seguidores e de publicações, se as 12 últimas publicações são dos últimos 6 meses, tipo de conta, percentual de público feminino e frequência de stories e reels.",
          "Respostas da inscrição: temas de que gosta de falar, o que costumam perguntar a você, o que você busca com o perfil, a principal dificuldade, o tempo disponível e o objetivo com o Instagram.",
          "Registro do consentimento e da declaração de idade: data, finalidade, página de origem e a versão desta política que foi aceita.",
          "Ao longo do acompanhamento: números atualizados, prints enviados como comprovação, tarefas, avaliações dos requisitos, notas e retornos da gestora e o histórico de etapas.",
          "Se você criar conta no portal: e-mail e dados de acesso.",
          "Se você conectar seu Instagram: identificador e nome de usuário da conta, os números lidos pela API da Meta e o token de acesso, que fica guardado cifrado e não é visto pela gestora.",
        ),
        p(
          "Não pedimos dados sensíveis. Se algum chegar pelas respostas abertas, ele é usado só para o acompanhamento e pode ser excluído a pedido.",
        ),
        p(
          "De gestoras e equipe: nome, e-mail, foto (se informada), dados de acesso, os textos e contatos da página de candidatura, o registro das ações feitas na plataforma, o do aceite dos Termos de Uso e desta política (versão e data) e os pagamentos registrados (valor, data e período).",
        ),
        p(
          "De quem visita o site: só o necessário para o site funcionar, descrito em “Cookies e armazenamento no navegador”. Não coletamos estatísticas de visita.",
        ),
      ],
    },
    {
      id: "finalidades",
      titulo: "Para que usamos os dados",
      blocos: [
        lista(
          "Candidatas: analisar o perfil e acompanhar a jornada no método — organizar tarefas, conferir os requisitos de qualificação e registrar a evolução dos números. A base é o consentimento dado na inscrição (LGPD, art. 7º, I), que você pode revogar a qualquer momento; a revogação encerra o acompanhamento e leva à exclusão dos dados.",
          "Comunicação: permitir que a gestora fale com você. Mensagens de WhatsApp são enviadas pela própria gestora, do WhatsApp dela; a plataforma só prepara o texto. A base é o mesmo consentimento.",
          "Gestoras e equipe: prestar o serviço contratado — contas, ambientes e limites do plano. A base é a execução do contrato (art. 7º, V).",
          "Segurança e prestação de contas: manter registros das ações feitas na plataforma, prevenir abuso e cumprir obrigações legais. A base é o legítimo interesse em manter a plataforma segura (art. 7º, IX) e, quando houver, o cumprimento de obrigação legal (art. 7º, II).",
        ),
        p(
          "Os requisitos de qualificação seguem critérios fixos, e a decisão de auditoria é sempre de uma pessoa. A plataforma não toma decisões automatizadas sobre você.",
        ),
      ],
    },
    {
      id: "inteligencia-artificial",
      titulo: "Análise assistida por inteligência artificial",
      blocos: [
        p(
          "Quando a gestora usa a análise assistida, a plataforma envia ao Google (modelo Gemini), por meio do serviço de IA do Lovable, os números do perfil, o tipo de conta, a frequência de stories e reels, os temas, o que você busca com o perfil, a principal dificuldade e as descrições dos prints já conferidos. Não são enviados nome, e-mail, WhatsApp, cidade, estado nem o @ do Instagram.",
        ),
        p(
          "O resultado é uma leitura de apoio, revisada pela gestora. Cada análise fica registrada com o que foi enviado, o que voltou e a versão das instruções usadas. A base é o mesmo consentimento do acompanhamento.",
        ),
      ],
    },
    {
      id: "compartilhamento",
      titulo: "Com quem compartilhamos",
      blocos: [
        p("Não vendemos dados. Eles são acessados por:"),
        lista(
          "A gestora da página em que você se inscreveu e a equipe dela.",
          "Prestadores que operam a plataforma: Supabase (banco de dados, autenticação e armazenamento de arquivos), Lovable (hospedagem do site e intermediação da análise assistida), Cloudflare (entrega do site) e Hostinger (envio dos e-mails de acesso).",
          "Google, quando você entra com a conta Google ou quando a gestora usa a análise assistida.",
          "Meta, quando você conecta o seu Instagram.",
          "Autoridades públicas, quando a lei exigir.",
        ),
      ],
    },
    {
      id: "transferencia",
      titulo: "Transferência para fora do Brasil",
      blocos: [
        p(
          "Alguns prestadores processam dados em servidores fora do Brasil. Nesses casos, a transferência se apoia em cláusulas contratuais firmadas com cada prestador, como prevê a LGPD (art. 33, II):",
        ),
        lista(
          "Supabase — banco de dados, autenticação e arquivos: Estados Unidos.",
          "Lovable e Cloudflare — hospedagem, entrega do site e intermediação da análise assistida: rede de servidores em vários países, inclusive no Brasil.",
          "Hostinger — envio dos e-mails de acesso: servidores que podem ficar fora do Brasil.",
          "Google — entrada com a conta Google e análise assistida: Estados Unidos e outros países.",
          "Meta — conexão com o Instagram: Estados Unidos e outros países.",
        ),
      ],
    },
    {
      id: "prazo",
      titulo: "Por quanto tempo guardamos",
      blocos: [
        p(
          `Guardamos os dados enquanto durar o acompanhamento. Se a candidatura ficar ${DIAS_PARA_EXCLUSAO} dias sem nenhuma atividade — nenhuma ação da gestora ou da candidata na plataforma —, os dados são excluídos automaticamente; antes disso, a gestora é avisada no painel. Você ou a gestora podem pedir a exclusão a qualquer momento.`,
        ),
        p(
          "Depois de uma exclusão, fica só o registro de que o pedido foi atendido, sem nome nem contato, para comprovar o atendimento. Cópias de segurança dos prestadores podem manter dados por um período limitado, até serem substituídas.",
        ),
      ],
    },
    {
      id: "direitos",
      titulo: "Seus direitos",
      blocos: [
        p("Você pode, a qualquer momento e sem custo:"),
        lista(
          "confirmar se tratamos seus dados e acessá-los;",
          "corrigir dados incompletos, inexatos ou desatualizados;",
          "pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em desconformidade com a lei;",
          "pedir a portabilidade dos seus dados;",
          "saber com quem compartilhamos seus dados;",
          "revogar o consentimento e pedir a exclusão dos dados tratados com base nele;",
          "saber que pode não consentir e quais são as consequências disso.",
        ),
        p(
          `Para exercer esses direitos, escreva para ${email} a partir do e-mail que você usou na inscrição. Confirmamos se tratamos seus dados assim que possível e enviamos a declaração completa em até 15 dias.`,
        ),
        p(
          "A exclusão apaga de vez o cadastro, a inscrição, os consentimentos, as tarefas, as notas, os números, as avaliações, as análises e os arquivos enviados e, se você pedir, a conta de acesso ao portal. Planilhas que a gestora tenha exportado antes do pedido ficam sob a responsabilidade dela.",
        ),
        p("Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD)."),
      ],
    },
    {
      id: "cookies",
      titulo: "Cookies e armazenamento no navegador",
      blocos: [
        lista(
          "Essenciais: a sessão de acesso, guardada no armazenamento do navegador; o cookie __cf_bm, da Cloudflare, que protege o site contra robôs; e o cookie __dpl, que mantém a mesma versão do site durante a visita.",
          "Preferências: o ambiente escolhido e se o roteiro de primeiros passos foi ocultado, guardados no seu navegador.",
        ),
        p("Não usamos cookies de estatística nem de publicidade."),
      ],
    },
    {
      id: "seguranca",
      titulo: "Segurança",
      blocos: [
        p(
          "Os dados de cada ambiente ficam isolados, o acesso depende do papel de cada pessoa, os arquivos ficam em armazenamento privado, o token do Instagram fica cifrado e as ações ficam registradas.",
        ),
        p(
          "Nenhum sistema é totalmente imune a falhas. Se houver um incidente de segurança que possa trazer risco ou dano relevante, avisaremos as pessoas afetadas e a ANPD no prazo definido pela autoridade.",
        ),
      ],
    },
    {
      id: "idade",
      titulo: "Idade mínima",
      blocos: [
        p(
          `A inscrição é para maiores de ${IDADE_MINIMA} anos. Se soubermos que recebemos dados de alguém com menos de ${IDADE_MINIMA} anos, eles serão excluídos.`,
        ),
      ],
    },
    {
      id: "mudancas",
      titulo: "Mudanças nesta política",
      blocos: [
        p(
          `Esta é a versão de ${descreverVersao(VERSAO_POLITICA)}. Quando mudarmos algo relevante, a nova versão será publicada nesta página, com a data, e as inscrições passarão a registrar a versão aceita.`,
        ),
        p(AVISO_DE_MUDANCAS),
      ],
    },
  ];
}

export function termosDeUso(): Secao[] {
  const { cnpj, email, foro } = CONTROLADOR;
  const nome = nomeDoControlador();
  return [
    {
      id: "quem-somos",
      titulo: "Quem somos",
      blocos: [p(`${nome}, CNPJ ${cnpj}. Contato: ${email}.`)],
    },
    {
      id: "plataforma",
      titulo: "O que é a plataforma",
      blocos: [
        p(
          "Uma ferramenta para gestoras organizarem candidaturas, acompanharem a jornada de candidatas a criadoras de conteúdo e auditarem os requisitos de qualificação com critérios claros. Inclui a página pública de candidatura de cada gestora e o portal da candidata.",
        ),
      ],
    },
    {
      id: "sem-garantia",
      titulo: "Sem garantia de aprovação",
      blocos: [
        p(
          "A plataforma organiza e acompanha a preparação. Atender aos requisitos não garante aprovação em nenhum programa, marca ou empresa de terceiros. A MCB é uma plataforma independente e não representa esses programas.",
        ),
      ],
    },
    {
      id: "contas",
      titulo: "Contas",
      blocos: [
        p(
          "Para usar a área de gestora ou o portal da candidata, é preciso criar uma conta com dados verdadeiros e aceitar estes termos e a Política de Privacidade; a plataforma registra a versão e a data do aceite. A senha é pessoal, e você responde pelo que for feito com a sua conta. A dona do ambiente decide quem entra na equipe e com qual papel.",
        ),
      ],
    },
    {
      id: "gestora",
      titulo: "Responsabilidades da gestora",
      blocos: [
        lista(
          "Tratar os dados das candidatas só para o acompanhamento no método, conforme a LGPD e a Política de Privacidade.",
          "Manter os dados corretos e atender, com a MCB, aos pedidos das candidatas sobre os dados delas.",
          "Cuidar das planilhas que exportar e das mensagens que enviar do próprio WhatsApp.",
          "Não publicar na página de candidatura conteúdo ilegal, enganoso ou que prometa resultados que a plataforma não garante.",
        ),
      ],
    },
    {
      id: "operacao",
      titulo: "Operação de dados",
      blocos: [
        p(
          "Para os dados das candidatas, a gestora é controladora e a MCB é operadora. A MCB se compromete a: tratar os dados só para prestar o serviço e conforme as instruções da gestora; manter sigilo e medidas de segurança; usar apenas os prestadores listados na Política de Privacidade, com obrigações equivalentes; comunicar à gestora, sem demora, incidentes de segurança que envolvam esses dados; apoiar a gestora no atendimento a pedidos de titulares; e excluir os dados ao fim do uso, salvo guarda exigida por lei.",
        ),
      ],
    },
    {
      id: "candidata",
      titulo: "Candidatas",
      blocos: [
        p(
          `A inscrição exige ${IDADE_MINIMA} anos ou mais. A plataforma não cobra nada da candidata; o que for combinado entre ela e a gestora fica entre as duas. A candidata pode acompanhar a própria jornada no portal e pedir a exclusão dos dados a qualquer momento, pelo e-mail ${email}.`,
        ),
      ],
    },
    {
      id: "planos",
      titulo: "Planos e limites",
      blocos: [
        p(
          "Cada ambiente tem um plano, com limites de candidatas, pessoas na equipe, análises assistidas e armazenamento. Os preços estão na página inicial do MCB. Todo ambiente novo começa com 14 dias de avaliação gratuita no plano Essencial. A cobrança é mensal e se renova automaticamente a cada mês. A gestora pode cancelar a qualquer momento, sem multa, em Configurações; o plano vale até o fim do mês já pago. Na primeira contratação, a gestora pode desistir em até 7 dias e recebe de volta o valor pago (Código de Defesa do Consumidor, art. 49). Enquanto a cobrança não é feita pela própria plataforma, ela é combinada diretamente com a MCB, e a troca de plano é feita pela administração. A gestora é avisada no painel 5 dias antes do vencimento. Sem o pagamento, o ambiente segue funcionando por mais 3 dias; depois fica disponível só para leitura, e a página deixa de receber candidaturas, até o pagamento ser registrado.",
        ),
      ],
    },
    {
      id: "suspensao",
      titulo: "Suspensão e encerramento",
      blocos: [
        p(
          "A MCB pode suspender um ambiente por falta de pagamento, uso indevido ou violação destes termos. Antes de suspender, a MCB avisa a gestora por e-mail e dá prazo para regularizar, salvo quando houver risco para candidatas ou uso ilícito. Um ambiente suspenso continua disponível só para leitura. A gestora pode encerrar o uso a qualquer momento. Em Configurações, a dona do ambiente pode baixar todos os dados dele e excluí-lo de vez, com os prints; a exclusão não desfaz cobranças já pagas. Os demais pedidos de exclusão seguem a Política de Privacidade.",
        ),
      ],
    },
    {
      id: "propriedade",
      titulo: "Propriedade intelectual",
      blocos: [
        p(
          "O método, a marca MCB e o software pertencem à MCB. Os textos que a gestora publica na página dela são dela, e os dados registrados pertencem a quem se referem, conforme a Política de Privacidade.",
        ),
      ],
    },
    {
      id: "responsabilidade",
      titulo: "Disponibilidade e responsabilidade",
      blocos: [
        p(
          "Trabalhamos para manter a plataforma no ar e segura, mas ela pode ter interrupções. Recursos que dependem de terceiros, como a conexão com o Instagram e a análise assistida por IA, podem mudar ou ficar indisponíveis por decisão desses terceiros.",
        ),
        p(
          "A MCB não responde por decisões de programas de terceiros nem pelo uso que a gestora faz dos dados fora da plataforma.",
        ),
      ],
    },
    {
      id: "mudancas",
      titulo: "Mudanças nestes termos",
      blocos: [
        p(
          `Podemos atualizar estes termos. A versão vigente fica nesta página; esta é a de ${descreverVersao(VERSAO_TERMOS)}.`,
        ),
        p(AVISO_DE_MUDANCAS),
      ],
    },
    {
      id: "foro",
      titulo: "Lei e foro",
      blocos: [
        p(
          `Estes termos seguem a lei brasileira. Fica eleito o foro da comarca de ${foro ?? "(a definir)"} para resolver questões sobre eles, ressalvado o direito de quem se enquadra como consumidor de propor ação no próprio domicílio.`,
        ),
      ],
    },
  ];
}
