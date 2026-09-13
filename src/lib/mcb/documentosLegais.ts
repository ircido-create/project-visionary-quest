/**
 * Fase 6 — Política de Privacidade e Termos de Uso.
 *
 * O texto descreve o que o sistema faz de fato — conferido no código e no banco em
 * 2026-09-13 —, não um modelo genérico. Ao mudar o que a plataforma coleta, com quem
 * compartilha ou como exclui, mude aqui e suba a versão: cada inscrição grava a versão da
 * política aceita em `consent_logs.version`.
 *
 * Pontos que pedem revisão de quem cuida da parte legal estão marcados com REVISAR.
 */

export const CONTROLADOR = {
  /** Como consta no CNPJ. */
  razaoSocial: "MONIQUE ANNELINE DA SILVA KALLAGIAN" as string | null,
  nomeFantasia: "MCB — Método Criadora Blessing",
  cnpj: "31.293.212/0001-38",
  email: "contato@mcblessing.com.br",
  /** Cidade/UF da sede, para a cláusula de foro dos Termos. */
  foro: "Osasco/SP" as string | null,
};

export const VERSAO_POLITICA = "2026-09-13";
export const VERSAO_TERMOS = "2026-09-13";
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

export type Bloco = { tipo: "p"; texto: string } | { tipo: "lista"; itens: string[] };
export type Secao = { id: string; titulo: string; blocos: Bloco[] };

const p = (texto: string): Bloco => ({ tipo: "p", texto });
const lista = (...itens: string[]): Bloco => ({ tipo: "lista", itens });

export function politicaDePrivacidade(): Secao[] {
  const { cnpj, email } = CONTROLADOR;
  const nome = nomeDoControlador();
  return [
    {
      id: "responsavel",
      titulo: "Quem é o responsável",
      blocos: [
        p(
          `${nome}, CNPJ ${cnpj}, é a responsável pela plataforma MCB. Para qualquer assunto sobre seus dados — dúvidas e pedidos de acesso, correção ou exclusão — escreva para ${email}. Esse é também o canal do encarregado pelo tratamento de dados.`,
        ),
        // REVISAR: papéis de controladora e operadora entre a MCB e cada gestora.
        p(
          "A plataforma é usada por gestoras que acompanham candidatas. Quando você se inscreve pela página de uma gestora, ela e a equipe dela passam a acompanhar seus dados na plataforma.",
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
          "Registro do consentimento: data, finalidade, página de origem e a versão desta política que foi aceita.",
          "Ao longo do acompanhamento: números atualizados, prints enviados como comprovação, tarefas, avaliações dos requisitos, notas e retornos da gestora e o histórico de etapas.",
          "Se você criar conta no portal: e-mail e dados de acesso.",
          "Se você conectar seu Instagram: identificador e nome de usuário da conta, os números lidos pela API da Meta e o token de acesso, que fica guardado cifrado e não é visto pela gestora.",
        ),
        p(
          "De gestoras e equipe: nome, e-mail, foto (se informada), dados de acesso, os textos e contatos da página de candidatura e o registro das ações feitas na plataforma.",
        ),
        p(
          "De quem visita o site: os dados de navegação descritos em “Cookies e armazenamento no navegador”.",
        ),
      ],
    },
    {
      id: "finalidades",
      titulo: "Para que usamos os dados",
      blocos: [
        // REVISAR: bases legais de cada finalidade.
        lista(
          "Candidatas: analisar o perfil e acompanhar a jornada no método — organizar tarefas, conferir os requisitos de qualificação e registrar a evolução dos números. A base é o consentimento dado na inscrição.",
          "Comunicação: permitir que a gestora fale com você. Mensagens de WhatsApp são enviadas pela própria gestora, do WhatsApp dela; a plataforma só prepara o texto.",
          "Gestoras e equipe: prestar o serviço contratado — contas, ambientes e limites do plano.",
          "Segurança e prestação de contas: manter registros das ações feitas na plataforma, prevenir abuso e cumprir obrigações legais.",
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
          "Quando a gestora usa a análise assistida, a plataforma envia ao Google (modelo Gemini) os números do perfil, o tipo de conta, a frequência de stories e reels, os temas, o que você busca com o perfil, a principal dificuldade e as descrições dos prints já conferidos. Não são enviados nome, e-mail, WhatsApp, cidade, estado nem o @ do Instagram.",
        ),
        p(
          "O resultado é uma leitura de apoio, revisada pela gestora. Cada análise fica registrada com o que foi enviado, o que voltou e a versão das instruções usadas.",
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
          "Prestadores que operam a plataforma: Supabase (banco de dados, autenticação e armazenamento de arquivos), Lovable e Cloudflare (hospedagem e entrega do site), Tinybird (estatísticas de acesso, pela hospedagem) e Hostinger (envio dos e-mails de acesso).",
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
        // REVISAR: hipótese de transferência internacional aplicável a cada prestador.
        p(
          "Alguns desses prestadores processam dados em servidores fora do Brasil. Nesses casos, a transferência se apoia nas hipóteses previstas na LGPD, como as garantias contratuais oferecidas por eles.",
        ),
      ],
    },
    {
      id: "prazo",
      titulo: "Por quanto tempo guardamos",
      blocos: [
        p(
          "Guardamos os dados enquanto durar o acompanhamento com a gestora, ou até que você ou a gestora peçam a exclusão.",
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
          `Para exercer esses direitos, escreva para ${email} a partir do e-mail que você usou na inscrição. Respondemos em até 15 dias.`,
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
          "Estatísticas: o cookie session-id, da hospedagem (Lovable), com envio à Tinybird das páginas visitadas, de métricas de desempenho e do país estimado pelo fuso horário do navegador.",
        ),
        p("Não usamos cookies de publicidade."),
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
          "Nenhum sistema é totalmente imune a falhas. Se houver um incidente de segurança que possa trazer risco ou dano relevante, avisaremos as pessoas afetadas e a ANPD, como manda a lei.",
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
          `Esta é a versão de ${dataPorExtenso(VERSAO_POLITICA)}. Quando mudarmos algo relevante, a nova versão será publicada nesta página, com a data, e as inscrições passarão a registrar a versão aceita.`,
        ),
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
          "Para usar a área de gestora ou o portal da candidata, é preciso criar uma conta com dados verdadeiros. A senha é pessoal, e você responde pelo que for feito com a sua conta. A dona do ambiente decide quem entra na equipe e com qual papel.",
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
          "Cada ambiente tem um plano, com limites de candidatas, pessoas na equipe, análises assistidas e armazenamento. A cobrança é combinada diretamente com a MCB, e a troca de plano é feita pela administração da plataforma.",
        ),
      ],
    },
    {
      id: "suspensao",
      titulo: "Suspensão e encerramento",
      blocos: [
        p(
          "A MCB pode suspender um ambiente por falta de pagamento, uso indevido ou violação destes termos. Um ambiente suspenso continua disponível só para leitura. A gestora pode encerrar o uso a qualquer momento; a exclusão de dados segue a Política de Privacidade.",
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
        // REVISAR: limites de responsabilidade.
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
          `Podemos atualizar estes termos. A versão vigente fica nesta página; esta é a de ${dataPorExtenso(VERSAO_TERMOS)}.`,
        ),
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
