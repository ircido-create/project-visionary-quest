# Roadmap MCB

## Fase 1 — Base funcional (concluída)
- [x] Banco multi-tenant com RLS, grants e dados de demonstração
- [x] Motor determinístico de qualificação + testes
- [x] Landing pública e página por gestora com Porta de Entrada
- [x] Autenticação (e-mail/senha e Google) e área protegida
- [x] Visão geral, candidatas, detalhe, tarefas e configurações
- [x] Consentimento LGPD, histórico e auditoria
- [x] Documentação da fase 1
- [x] Acesso com Lovable, preservando nome, e-mail e foto no perfil existente

## Fase 2 — Evidências e IA auditável
- [x] Upload de prints com confirmação humana (Storage + tabela `files`)
- [x] Análise de perfil com IA registrando entrada, saída e versão do prompt
- [x] Portal da candidata com tarefas e evolução

## Fase 3 — Operação e cobrança
- [x] Limites por plano aplicados (candidatas, equipe, análises no mês, armazenamento)
- [x] Painel de superadministração, com troca de plano e suspensão de ambiente
- [x] Exportação de candidatas e tarefas em CSV, registrada em `audit_logs`
- [ ] ~~Stripe (checkout, assinatura)~~ — **adiado por decisão, não por falta de tempo.**
      Os limites já são aplicados e o superadministrador troca o plano à mão, o que
      sustenta a operação com as primeiras gestoras. Automatizar cobrança antes de haver
      volume adicionaria chave secreta, webhook e ambiente de teste sem retorno.
      Quando voltar ao assunto, decidir o provedor primeiro: cobrança em BRL pelo Stripe
      exige conta brasileira e tem particularidades de boleto e Pix; alternativas locais
      (Asaas, Pagar.me) costumam dar menos atrito para público brasileiro. A estrutura de
      webhook e assinatura muda conforme a escolha, então ela vem antes do código.

## Fase 4 — Integrações e qualidade
- [x] Integração oficial Meta/Instagram, pelo caminho "Instagram API with Instagram
      Login" — a candidata conecta a própria conta, sem exigir Página do Facebook. O
      token fica cifrado no Vault e a gestora nunca o lê, o que está verificado em
      `supabase/tests/instagram.test.sql` com controle embutido no teste.
      **Chega desligada**: sem `META_APP_ID`/`META_APP_SECRET`/`META_REDIRECT_URI` a
      seção some da tela. Ligar depende de duas coisas que só o dono da conta faz —
      criar o app na Meta e passar pela revisão dela. Passo a passo em
      `docs/integracao-meta.md`.
      Dois limites que não são contornáveis: a divisão de público por gênero só existe
      a partir de 100 seguidores (por isso o fluxo de print continua necessário), e o
      sync é sob demanda, não noturno — agendar exigiria a service role key, que este
      projeto não usa.
      **Não exercitado de ponta a ponta**: sem app na Meta, o fluxo de OAuth real nunca
      rodou. O que está verificado é o banco, o módulo puro (18 testes) e a compilação.
- [x] Testes automatizados em duas camadas: 41 casos em vitest (motor de qualificação,
      limites por plano, CSV, evidências) e 18 verificações de integração em
      `supabase/tests/rls.test.sql`, cobrindo políticas de RLS e funções
      `security definer` contra o banco real, dentro de transação desfeita.
      **Os de integração não rodam no `bun run test`** — precisariam de conexão direta
      ao banco, que a máquina de desenvolvimento não tem. São verificação sob demanda.
      As políticas de Storage seguem sem cobertura: só existem no ambiente Supabase.
- [x] Auditoria de acessibilidade: `lang` do documento corrigido para pt-BR, nome
      acessível em 4 selects, 6 inputs e 2 checkboxes que eram anunciados sem dizer a
      que tarefa pertenciam. O `eslint-plugin-jsx-a11y` entrou como rede de proteção,
      **mas ela tem um furo conhecido**: nenhuma regra pega `<select>` sem nome
      acessível, porque a regra procura o rótulo dentro do controle e um `<select>`
      sempre tem `<option>` com texto. Verificado por teste de mutação — removendo o
      `aria-label` de um checkbox o lint acusa; removendo o de um select, passa. Os
      `aria-label` dos selects estão corretos e sem cobertura automática.
      Fora do escopo: teste com leitor de tela de verdade e contraste de cores.
- [x] Otimização de desempenho na camada de dados. O `QueryClient` estava sem
      configuração, e o padrão do TanStack Query é `staleTime: 0`: eram 3 chamadas ao
      servidor por navegação, 2 delas para dados constantes na sessão. Passou a 0 ao
      voltar a uma página já visitada e 1 ao abrir uma nova. Cachear expôs duas lacunas
      de invalidação que o `staleTime: 0` mascarava, ambas corrigidas.
      **Ficou de fora o tamanho do bundle**: 743 KB de JS, 525 KB no chunk principal.
      A divisão por rota já funciona e o `@google/genai` está corretamente fora do
      cliente; o peso restante é o supabase-js, que embarca o cliente de Realtime mesmo
      sem o app assinar nada — mexer nisso é trabalho de biblioteca, não de configuração.
      Também não foi feito: preload de rota no hover, e `select("*")` nas listagens,
      que traz colunas a mais mas não foi o que a medição apontou como gargalo.

## Fase 5 — Rotina da gestora

Montada em 2026-09-12 a partir do que o produto faz hoje e do que está parado no banco,
não de pedidos das gestoras — **as prioridades são premissas a confirmar com quem usa**.
O retrato que as orientou (inclui os ambientes de demonstração): 15 candidatas, só 2 com
login no portal; 15 tarefas abertas, 4 atrasadas; 5 candidatas paradas em "Pronta para
auditoria". Os quatro primeiros itens não dependem de secret nenhum — de propósito,
porque tudo que depende de secret está travado em produção (ver Pendências).

- [x] **Fluxo de auditoria.** A página da candidata em "Pronta para auditoria" mostra
      cada requisito (valor atual, meta, situação, origem do dado) e registra a decisão
      em `qualification_results.manual_decision`, com autor, nota e entrada em
      `audit_logs`. Aprovar leva a "Qualificada para análise"; com requisito pendente,
      exige justificativa e fica gravado como "Aprovada com exceção". Devolver exige
      motivo, volta para uma etapa anterior e cria a tarefa do que falta (prioridade
      alta, 7 dias). O painel lista quem aguarda auditoria. Só dona e administradora
      decidem. O seletor comum de etapa não leva mais a "Qualificada" nem às etapas
      seguintes sem a auditoria — regra conferida no servidor. Testado em produção em
      2026-09-12: uma aprovação, uma devolução e a recusa do seletor.
      Atenção ao testar publicações novas: uma aba aberta antes da publicação pode
      continuar falando com o servidor anterior. Testar em aba nova.
- [x] **Modelos de tarefa por nível.** Biblioteca por ambiente em Configurações: nível,
      título, orientação, prazo em dias e prioridade; dona e administradora editam
      (regra conferida no servidor). Na página da candidata, as tarefas do nível dela que
      ainda faltam aparecem como sugestão, todas marcadas; a gestora desmarca o que não
      servir e confirma — nada é criado sozinho. Cada tarefa guarda o modelo de origem
      (`tasks.template_id`), o que evita sugerir de novo e duplicar. Conjunto inicial de
      18 tarefas do método, aprovado, carregado por botão quando a biblioteca está
      vazia. Migração aditiva aplicada em 2026-09-12. Testado em produção no mesmo dia:
      conjunto carregado e duas tarefas criadas a partir das sugestões.
      Fica para depois: modelos gerais do método (`tenant_id` nulo), válidos para todos
      os ambientes — exigem mudar as regras de acesso de leitura.
- [x] **Convite e lembrete pelo WhatsApp, sem API.** Na página da candidata, botões
      que abrem o WhatsApp da gestora com a mensagem pronta: "Convidar para o portal"
      (só para quem ainda não tem acesso; diz o e-mail da inscrição, que é o que
      vincula a conta) e "Lembrar tarefas atrasadas". No painel, cada tarefa atrasada
      ganha o lembrete. O número é normalizado para o formato do `wa.me` (55 + DDD);
      sem número confiável, não há botão. O sistema não registra envio — quem envia é
      a gestora. Junto: `/auth?modo=cadastro` abre direto em "criar conta"; a
      confirmação de e-mail volta para `/auth`, que vincula a candidatura e leva ao
      portal (antes caía em `/dashboard`, na tela de criar ambiente); tarefas
      canceladas saem das abertas e atrasadas do painel. Conferido em produção em
      2026-09-12, nos ambientes de demonstração: botões, mensagens e lembretes do
      painel. Convite real de ponta a ponta feito em 2026-09-13 (ver Fase 6): o
      Supabase aceita `/auth` como retorno da confirmação de e-mail.
- [x] **Relatório de evolução para compartilhar.** Botão "Relatório" na página da
      candidata abre `/relatorio/<id>`, um documento em A4 para salvar em PDF pela
      impressão do navegador: nível, índice, requisitos cumpridos, números de início e de
      agora com a variação, gráfico de seguidores, situação de cada requisito e tarefas
      concluídas. Controle de quem vê: sem link público (decisão de 2026-09-12) — só a
      gestora logada abre a página, e o PDF sai quando ela decide mandar. O documento
      mostra uma lista fechada; contato, notas internas, leitura da IA e prints de
      evidência ficam de fora. Conferido em produção no mesmo dia com os números de uma
      candidata. O valor atual dos requisitos sai no formato brasileiro ("12.400",
      "72,5%") desde o mesmo dia, também na página da candidata.
      Fica para depois, se as gestoras pedirem: link público com prazo e revogação.

**Depois que os secrets funcionarem em produção:**

- [ ] Avisos automáticos por e-mail ou WhatsApp com API — resumo semanal para a
      gestora, lembrete de prazo para a candidata. Exigem credencial do provedor de
      envio e um job agendado (`pg_cron`, disponível no banco mas não instalado; ligar é
      configuração da plataforma).
- [ ] Análise de IA em produção (Fase 2), hoje sem a chave do Gemini no servidor.

## Fase 6 — Pronta para as primeiras gestoras

Montada em 2026-09-13. Diferente da Fase 5, não há uso real para orientar: a única
gestora é a dona da plataforma, as 8 candidatas de "Gestora Ircido" são dados de teste
(`seed`), as únicas inscrições reais são 2, e todos os números foram digitados à mão. O
gargalo não é funcionalidade — é a plataforma ainda não estar pronta para receber gente
de verdade com segurança. Recursos novos ficam para quando houver uso para orientar.

- [x] **Exclusão de dados a pedido.** Na administração da plataforma, "Exclusão de dados
      a pedido": busca por e-mail em todos os ambientes (sem curinga), mostra o que vai
      sumir e só libera o botão com o e-mail digitado de novo. Ordem: arquivos no
      Storage; depois o banco, pela função `excluir_candidata` (só a chave de serviço
      executa), que apaga o token do Vault, a candidata com a cascata das 11 tabelas e
      grava `candidata.excluida_a_pedido` no log só com contagens; por fim a conta de
      acesso ao portal e o perfil, se pedidos e se a conta não for de gestora, da
      administração ou de outra candidatura. Só a dona da plataforma usa. Testado em
      produção em 2026-09-13 com uma candidatura de teste enviada pelo formulário
      público: nada sobrou em nenhuma das 12 tabelas, e o log ficou com o registro da
      exclusão sem nome nem e-mail. Não foi exercitada ainda a exclusão de conta de
      acesso nem de arquivo no Storage — a candidatura de teste não tinha nenhum dos dois.
      Fora do alcance: CSVs já exportados e os logs do próprio Supabase.
- [x] **Política de privacidade e termos de uso.** `/privacidade` e `/termos`, escritas
      a partir do que o sistema faz de fato, conferido no código e no banco: dados de
      candidatas, gestoras e visitantes; o que vai e o que não vai para a IA (nome,
      contato, cidade e @ não vão); prestadores (Supabase, Lovable, Cloudflare, Tinybird,
      Hostinger, Google, Meta); exclusão como ela funciona; cookies e as estatísticas de
      acesso que o script do Lovable (`/~flock.js`) envia à Tinybird; idade mínima de 18
      anos; dados guardados até o pedido de exclusão. Responsável: MONIQUE ANNELINE DA
      SILVA KALLAGIAN, CNPJ 31.293.212/0001-38, contato@mcblessing.com.br; foro em
      Osasco/SP. Links no rodapé, no consentimento do formulário (que passou a dizer
      "Tenho 18 anos ou mais") e no cadastro, cujo título ficou "Criar sua conta", neutro
      para gestora e candidata. Cada consentimento grava a versão aceita em
      `consent_logs.version`. Conferido em produção em 2026-09-13. Revisão técnica feita
      no mesmo dia (não é parecer jurídico): 17 pontos — P1 a P11 na política, T1 a T6
      nos termos; 3 de risco alto (papéis de controladora e operadora, cookie de
      estatística sem escolha, transferência internacional sem hipótese por prestador),
      5 pedindo decisão de negócio —, entregue à dona como página privada para levar ao
      jurídico. Decisões da dona aplicadas na revisão `2026-09-13.2`: **P1/T2** cada
      gestora é controladora dos dados das candidatas e a MCB opera a plataforma, sem uso
      próprio desses dados (seção "Operação de dados" nos Termos); **P4** base legal em
      cada finalidade (consentimento para o acompanhamento); **P5** exclusão após 90 dias
      sem atividade (item abaixo); **T3** preços na página inicial, cobrança mensal com
      renovação automática, cancelamento sem multa valendo até o fim do mês pago e 7 dias
      de arrependimento (CDC art. 49). **P2**: o Lovable não deixa condicionar o script
      de estatísticas a consentimento, então "Visitor analytics" foi desligado nas
      configurações do projeto em 2026-09-13 (o `/~flock.js` sumiu das páginas); na
      revisão `2026-09-13.3` saíram da política o cookie session-id, a Tinybird e a
      menção às estatísticas em P1. Religar exige consentimento antes e nova versão da
      política. **Validação jurídica concluída em 2026-09-13** para os pontos restantes,
      aplicados na revisão `2026-09-13.4`: **P3** transferência por cláusulas contratuais
      (art. 33, II), com a lista de onde cada prestador processa — o banco fica nos EUA
      (AWS us-west-2, conferido pelo endereço do servidor); Lovable e Hostinger estão
      descritos sem região exata, a confirmar nos contratos deles; **P6** o art. 15 do
      Marco Civil não se aplica, nada muda; **P7** agente de pequeno porte, sem
      encarregado; **P8** aviso de dados sensíveis no formulário e frase na política;
      **P9** duas caixas obrigatórias (idade e consentimento, que agora cita a gestora, a
      MCB e a IA), exigidas também pelo servidor; **P10** prazo de incidente pela
      referência à ANPD; **P11** confirmação imediata e declaração completa em 15 dias;
      **T4** mantido; **T5** aviso de mudanças relevantes por e-mail com 15 dias de
      antecedência (envio manual, pela dona); **T6** aviso antes de suspender. Texto e
      versão mudam juntos: ao alterar, subir `VERSAO_POLITICA`/`VERSAO_TERMOS`.
- [x] **Aceite dos Termos registrado (T1).** Migração
      `20260913160000_fase6_aceite_dos_termos`, aplicada em 2026-09-13: tabela
      `aceites_de_termos` (versão dos termos e da política, origem e data). O cadastro por
      e-mail tem a caixa obrigatória "Li e aceito", e o gatilho em `auth.users` grava o
      aceite na criação da conta, a partir dos metadados. Quem entra pelo Google ou pelo
      Lovable, ou tinha conta antes, vê uma vez na área logada o pedido de aceite
      (`aceitar_termos`, com a hora do banco). A exigência segue `VERSAO_ACEITE_EXIGIDO`,
      que só sobe quando uma mudança pede novo aceite; se a consulta falhar, a área logada
      não trava.
- [x] **Exclusão por inatividade (90 dias).** Migração
      `20260913140000_fase6_inatividade_90_dias`, aplicada em 2026-09-13: `pg_cron`
      ligado e a tarefa `mcb-limpeza-inatividade` roda todo dia às 06h UTC
      (`limpar_candidatas_inativas`), excluindo pela mesma `excluir_candidata` e gravando
      `candidata.excluida_por_inatividade`. Atividade é qualquer rastro da gestora ou da
      candidata (`ultima_atividade_candidata`). Ficam fora: ambientes de demonstração e
      candidatas com arquivos no Storage — estas aparecem na administração ("Inativas com
      arquivos") para exclusão pela ferramenta que apaga os arquivos. A gestora vê
      "Perto da exclusão por inatividade" no painel nos 15 dias anteriores. No dia da
      aplicação, nenhuma candidata real estava na janela de aviso nem vencida.
- [x] **Primeiros passos da gestora nova.** Cartão "Primeiros passos" no painel da dona
      e da administradora de um ambiente real: ajustar a página, carregar os modelos de
      tarefa, receber a primeira candidatura (com o link completo e "Copiar link") e,
      opcional, convidar a equipe. Cada passo sai dos dados — página ajustada é marca
      salva mais de um minuto depois da criação do ambiente —, sem tabela de progresso;
      some quando os três obrigatórios estão feitos ou ao ocultar (preferência de quem vê,
      no navegador). A página de candidatura continua nascendo no ar, mas só entra na
      lista da página inicial do MCB por escolha da gestora (`is_listed_on_home`,
      desligado por padrão), em Configurações, que ganhou também "Copiar link". Na
      migração ficaram na lista a Equipe Blessing e as duas demonstrações; a Gestora
      Ircido (teste) saiu. Conferido em produção em 2026-09-13: lista da página inicial,
      cartão com "2 de 3" na Gestora Ircido e a opção em Configurações. Não exercitado
      ainda: a criação de um ambiente novo por outra conta.
- [x] **Jornada real de ponta a ponta.** Feita em 2026-09-13 com uma pessoa real:
      inscrição pelo celular a partir do botão da página inicial (Equipe Blessing), com o
      consentimento gravando a versão 2026-09-13 da política; convite pelo WhatsApp com o
      número normalizado (+55) e a mensagem certa; cadastro pelo link
      `/auth?modo=cadastro` e confirmação de e-mail em menos de 30 segundos. A
      confirmação voltou por `/auth`, vinculou a inscrição pelo e-mail e levou ao portal.
      Uma inscrição antiga da mesma pessoa, com outro e-mail, ficou sem vínculo, como
      previsto. Observação resolvida no mesmo dia: no portal, "Qualificada para análise"
      aparecia ao lado de "45% de progresso". Havia duas causas. Uma de texto: o
      cabeçalho juntava a etapa com o nível calculado, e o selo não dizia o que media. O
      portal agora mostra só a etapa, o selo virou "Preparação do perfil: X%" e uma
      frase explica que esse índice não decide a qualificação. A outra era de regra: o
      envio da candidatura avaliava sem os sinais de nicho, bio, perfil, stories e
      constância, que só o recálculo da gestora usava; toda inscrição começava com no
      máximo 45%. A regra passou a ser uma só (`sinaisDasRespostas`, com testes).
      Publicado e conferido no mesmo dia. As duas candidatas reais foram recalculadas a
      pedido, pelo próprio motor do app e só se o índice ainda fosse o antigo: Monique de
      45% para 80%, a outra de 30% para 55%, cada uma com avaliação nova e registro
      `influencer.indice_recalculado` no log. As etapas não mudaram.
- [x] **Separar os dados de teste.** Decisão de 2026-09-13: o ambiente "Gestora Ircido"
      foi excluído por inteiro — 8 candidatas de seed com tarefas, notas, feedbacks,
      números, avaliações, histórico e análises de IA, 18 modelos de tarefa, a marca, um
      convite pendente de teste e os 21 registros de log do próprio ambiente. Uma
      operação só, com trava (só apagava se o ambiente estivesse como foi conferido); o
      registro `platform.ambiente_de_teste_excluido` ficou fora do ambiente, só com
      contagens. `/g/gestora-ircido` passou a dar 404. A conta de portal da candidata de
      teste Helena foi mantida por escolha da dona. Outra conta @gmail.com do mesmo dia
      (10/09), sem nome, candidatura, ambiente, papel nem perfil, foi excluída a pedido
      (`platform.conta_orfa_excluida` no log). A plataforma ficou com a Equipe Blessing
      (real) e as duas demonstrações.

## Fase 7 — Assinatura sem cobrança online

Montada em 2026-09-14. O ponto de partida: quem criava um ambiente pelo "Criar meu
ambiente" recebia o Essencial (R$ 97/mês) na hora e sem prazo — na prática, de graça e
para sempre —, enquanto os Termos já prometiam cobrança mensal, renovação, cancelamento
e arrependimento. Não havia tabela de cobrança nenhuma. Cobrança online continua de fora:
depende de escolher o provedor e de os secrets gravarem no Lovable (ver Pendências).

- [x] **Assinatura com prazo** (`20260914100000_fase7_assinatura_e_convites.sql`).
      Decisões de 2026-09-14: ambiente criado por gestora nasce com 14 dias de avaliação
      no Essencial; aviso no painel da gestora a partir de 5 dias antes do vencimento;
      vencido, mais 3 dias de tolerância, e então só leitura — a suspensão que já existia
      — com a página parando de receber candidaturas. A tarefa diária
      `mcb-suspensao-por-vencimento` (06h15 UTC) faz isso; cancelada, suspende no fim do
      período, sem tolerância. O pagamento é combinado pelo contato; na administração,
      "Registrar pagamento" (valor, meses, forma, observação) grava em `pagamentos`,
      calcula o novo vencimento — a partir do fim do período atual, se ainda não venceu —
      e reativa o ambiente suspenso por vencimento (a suspensão manual guarda outro
      motivo e não é desfeita pelo pagamento). A dona cancela em Configurações, sem
      multa; na primeira contratação, em até 7 dias do pagamento, é arrependimento: o
      período acaba na hora e a MCB devolve o valor, fora do sistema. As colunas da
      assinatura só mudam pela administração ou por essas funções (o gatilho de colunas
      de plataforma passou a cobri-las). Ambientes anteriores à fase — o da dona da
      plataforma e as demonstrações — ficaram isentos.
- [x] **Aviso de cobrança por e-mail feito pela dona da plataforma.** O MCB não envia
      e-mail próprio (ver Pendências: DNS). A administração ganhou "Vencimentos": quem
      termina em até 5 dias, está na tolerância ou foi suspenso por vencimento, com um
      link que abre o e-mail da dona da plataforma já escrito para a dona do ambiente.
      O contato vem de `plataforma_contatos_das_donas`, porque a administração não é
      membro dos ambientes. Cumpre o que os Termos (T6) prometem: aviso por e-mail e
      prazo antes de suspender.
- [x] **Convites de equipe que funcionam.** Até aqui o convite era gravado e nada o
      aceitava. Agora quem entra com o e-mail convidado (confirmado), dentro dos 14 dias
      de validade, passa a fazer parte da equipe com o papel do convite
      (`aceitar_convites_pendentes`, chamada na entrada). Convite para "dona" nunca é
      aceito, e só dona e administradora criam, alteram ou apagam convites (antes, pela
      regra do banco, qualquer membro, com qualquer papel). O MCB não envia o e-mail de
      convite: Configurações diz para mandar o link de cadastro à pessoa.
- [x] **Termos e Política, revisão `2026-09-13.5`.** Planos: 14 dias de avaliação,
      cancelamento em Configurações, aviso 5 dias antes, 3 dias de tolerância e só
      leitura depois. Política: os pagamentos registrados entram nos dados das gestoras.
      `VERSAO_ACEITE_EXIGIDO` ficou em `.4`: nenhuma gestora além da dona da plataforma
      existia, e a mudança não pede novo aceite de quem já tem conta.
- [x] **Teste de ponta a ponta em produção, 2026-09-14**, com uma segunda conta da dona
      (e-mail e senha): cadastro gravando o aceite na criação da conta (`.5`, origem
      "cadastro"); ambiente novo nascendo no Essencial, em avaliação até 14 dias depois,
      com a conta como dona; convite aceito na entrada seguinte da conta principal, como
      membro; pagamento registrado na administração com o período começando no fim da
      avaliação (28/09 a 28/10); cancelamento pela dona dentro dos 7 dias, registrado como
      arrependimento, com o período encerrado na hora; e a suspensão diária, rodada à mão,
      pegando o ambiente cancelado. Cada passo ficou no log com quem fez. O ambiente de
      teste foi apagado depois, a pedido (`platform.ambiente_de_teste_excluido` no log,
      só com contagens); a conta de teste ficou para testes futuros. Dois achados:
      (1) convidar quem já está na equipe gravava um convite que ocupava vaga e virava
      "aceito" sem mudar nada — corrigido no mesmo dia
      (`20260914110000_convite_para_quem_ja_esta_na_equipe.sql`): o banco recusa,
      comparando com o e-mail da conta (conta criada por e-mail e senha não ganha perfil
      sozinha), e o app diz "Essa pessoa já faz parte da equipe."; (2) no cancelamento
      com arrependimento o acesso só termina na próxima execução da tarefa diária — até
      um dia a mais, aceito como está. O teste de RLS (`supabase/tests/rls.test.sql`)
      ganhou os casos da correção de membros e colunas de plataforma, mas não foi rodado:
      SQL como usuária simulada foi bloqueado pelo classificador de permissões; ele roda
      colado no SQL editor.

## Fase 8 — O portal mostra o que falta

Montada em 2026-09-14. A candidata via no portal a etapa, a porcentagem de preparação,
as tarefas e os números, mas não o que falta para os requisitos do programa — a
informação que a gestora tem na página dela e que mais orienta a candidata.

- [x] **Requisitos no portal** (`20260914120000_fase8_portal_requisitos.sql`). A seção
      "Requisitos do programa" mostra "X de 5 requisitos cumpridos" e, em cada um, o
      valor de hoje, a meta, a situação (cumprido, falta, a confirmar) e o próximo passo
      escrito para a candidata — "Faltam 88 seguidores para chegar a 500", "Envie à sua
      gestora o print do público nas estatísticas do Instagram". O cálculo é feito no
      servidor do app com o mesmo motor da página da gestora, a partir dos números
      atuais; a função do portal passou a trazer só o que faltava para isso (tipo de
      perfil, recência, origem e data do número). De propósito, não usa a última
      avaliação gravada, que pode estar atrás do cadastro e traz a decisão, a nota e o
      autor da auditoria — internos da gestora. Linguagem em `portalRequisitos.ts`, com
      testes; o teste de RLS ganhou a verificação de que o portal não traz decisão nem
      nota de auditoria.

## Fase 9 — Avisos dentro do app

Montada em 2026-09-14. O MCB não envia e-mail próprio (ver Pendências: DNS), então nada
avisava a gestora de uma candidatura nova ou a candidata de uma tarefa nova — cada uma
tinha de entrar e procurar.

- [x] **Sininho de avisos** (`20260914130000_fase9_avisos.sql`), no topo do painel da
      gestora e do portal da candidata, com a contagem de não lidos e os 20 últimos.
      Equipe do ambiente: nova candidatura e tarefa concluída pela própria candidata no
      portal (a concluída pela gestora não avisa). Dona e administradora: candidata que
      passou para "Pronta para auditoria" depois da inscrição. Candidata com conta: tarefa
      nova e feedback novo. Os avisos nascem em gatilhos do banco, e não no app, para
      valer em todo caminho que cria tarefa, feedback ou etapa; demonstrações não geram
      aviso. Várias tarefas de uma vez viram um aviso só, com a contagem. Pela API, a
      pessoa lê os dela e só consegue marcar como lido. Como trazem o nome da candidata,
      os avisos somem com ela, e a tarefa diária `mcb-limpeza-avisos` apaga os lidos há
      mais de 30 dias e todos com mais de 90. O sininho consulta a cada minuto; se a
      consulta falhar, ele some em vez de mostrar erro.

## Fase 10 — Encerrar o ambiente e levar os dados

Montada em 2026-09-14. Depois da Fase 7, cancelar deixava o ambiente só leitura sem prazo,
e excluir dependia da administração da plataforma. Os Termos já diziam que a gestora pode
encerrar o uso a qualquer momento.

- [x] **Baixar todos os dados e excluir o ambiente de vez**, em Configurações, na seção
      "Encerrar o ambiente" (só para a dona). "Baixar todos os dados" gera um JSON com
      candidatas, inscrições, tarefas, notas, feedbacks, números, avaliações, histórico,
      consentimentos, pagamentos, modelos de tarefa e a lista de prints (os arquivos
      continuam na página de cada candidata); dona e administradora podem baixar, a
      leitura passa pelas regras de sempre e cada exportação fica no log
      (`ambiente.exportado`). Excluir pede o nome do ambiente digitado de novo e segue a
      ordem da exclusão de candidata: arquivos no Storage (registrados e da pasta do
      ambiente) e depois `excluir_ambiente`
      (`20260914140000_fase10_encerrar_ambiente.sql`, só a chave de serviço executa), que
      confere de novo que é a dona, apaga do Vault os tokens do Instagram e o ambiente em
      cascata, e registra no log da plataforma só com contagens
      (`ambiente.excluido_pela_dona`). As contas de acesso das pessoas continuam;
      demonstrações não são excluídas por aqui. Termos na revisão `2026-09-13.6`
      (Política segue na `.5`): a dona baixa e exclui em Configurações, e excluir não
      desfaz cobrança já paga. Não exercitado de ponta a ponta: exige um ambiente de
      teste criado por outra conta.

## Fase 11 — Qualidade técnica

Montada em 2026-09-14, com medição antes de mexer.

- [x] **Relatório sem biblioteca de gráficos.** O gráfico de seguidores do relatório
      usava o recharts: 376 KB de JavaScript para uma linha. Virou SVG próprio
      (`GraficoSeguidores`), com a escala e as posições em `grafico.ts`, puras e testadas
      (marcas redondas sem decimais, eixo mesmo com um valor só, no máximo 8 rótulos). O
      recharts saiu das dependências, e com ele `components/ui/chart.tsx`, que nenhuma
      tela usava. Medido no build: o JavaScript do relatório foi de 376 KB para 1 KB, e o
      total do app de 1.213 KB para 845 KB.
- Ficou como está, de propósito: o pacote principal (527 KB) é quase todo o supabase-js,
  que embarca o cliente de Realtime mesmo sem uso — mexer nisso é trabalho de
  biblioteca. Os `select("*")` rodam todos no servidor e a maioria precisa da linha
  inteira (motor de qualificação, exportação completa); não pesam no navegador. Testes de
  tela exigiriam novas dependências de teste (jsdom, testing-library); as regras de cada
  fase estão cobertas por testes das funções puras.

## Início da operação — base limpa

- [x] **Base zerada para começar a operação, 2026-09-14**, a pedido da dona, sem cópia
      prévia e sem registro no log. Saíram: os dois ambientes de demonstração ("Gestora
      Aline — Demo" e "Gestora Patrícia — Demo") com as 5 candidatas fictícias; a outra
      candidata da Equipe Blessing; 6 contas de teste ou sem uso; todo o log de auditoria,
      os aceites dos termos e os avisos. Ficaram: a Equipe Blessing (página `/g/blessing`,
      plano Premium, isenta de cobrança), as contas ircido@gmail.com (dona da plataforma e
      do ambiente) e monique@mcblessing.com.br, os 3 planos, as regras de qualificação e
      as tarefas diárias. Uma única operação com trava: só apagava se a base estivesse
      como no inventário. Consequências: sem demonstrações, quem entra sem ambiente
      próprio não vê exemplos, só o convite para criar o ambiente (o código de
      demonstração continua e volta a valer se um ambiente for marcado como tal); quem
      tinha aceitado os termos aceita de novo na próxima entrada.
- [x] **Equipe da Blessing, 2026-09-16.** Monique Kallagian incluída como
      Administradora (`equipe.membro_incluido` no log). A candidatura que ela tinha na
      Blessing foi excluída a pedido, pela mesma função da exclusão de dados
      (`candidata.excluida_a_pedido`, só contagens); a conta e o papel na equipe
      continuam. Estado de partida: um ambiente, duas pessoas na equipe (dona e
      administradora) e nenhuma candidatura.

## Pendências conhecidas
- [x] **Inscrições reais em ambiente de demonstração — corrigido em 2026-09-12.**
      Ambiente de demonstração é legível por qualquer conta logada (`can_read_tenant`), e
      o botão "Ver página de candidatura" da página inicial abria a primeira página
      criada, "Equipe Blessing", que era de demonstração. Duas inscrições reais chegaram
      lá em 2026-09-09, com nome, e-mail, WhatsApp e respostas. Na hora da correção só
      existiam a conta da dona da plataforma e duas contas de candidata. No banco:
      "Equipe Blessing" virou ambiente real (plano Premium, dona Ircido), com registro
      `platform.demo_virou_real` em `audit_logs`. No site: o servidor recusa inscrição em
      ambiente de demonstração; a página de demonstração avisa e desativa o envio; o
      botão principal abre a primeira página real e a lista marca as demonstrações
      (`paginasPublicas.ts`). Conferido em produção no mesmo dia.
- [x] **Revisão do que um visitante sem login alcança — 2026-09-12.** Todas as tabelas
      com RLS; bucket de evidências privado; nenhuma view. Dois pontos endurecidos, nenhum
      explorável no dia (`20260912230000_endurece_acesso_publico.sql`): as oito funções
      do Instagram, que conferem a dona da candidatura, deixaram de aceitar chamada de
      visitante (a migração da fase 4 não tinha retirado o EXECUTE padrão); e a marca dos
      ambientes, que era legível por inteiro e de todos os ambientes, passou a mostrar a
      visitante só as colunas da página pública (sem o WhatsApp da gestora) e só de
      ambiente com página ligada e ativo. Conferido pela API como visitante e na página
      pública. Fica como está, de propósito: visitante lê as colunas de `tenants` de
      páginas públicas (nome, slug, plano, situação) — nada sensível.
- [x] **Dois furos nas regras de acesso — corrigidos em 2026-09-14**, achados ao planejar
      a Fase 7 (`20260914090000_corrige_membresia_e_colunas_de_plataforma.sql`).
      (1) A política de inclusão em `tenant_memberships` aceitava `user_id = auth.uid()`
      sem olhar o ambiente: qualquer conta logada podia se incluir como dona de qualquer
      ambiente. Agora, por conta própria, só quem criou o ambiente, como dona e enquanto
      ele não tem membro; dona e administradora seguem incluindo. (2) Dona e
      administradora podiam mudar plano, situação e o marcador de demonstração do
      próprio ambiente (e escolher esses valores ao criá-lo). Um gatilho em `tenants`
      passou a reservar essas colunas à administração da plataforma e força Essencial,
      ativo e não demonstração na criação por gestora. Sem sinal de uso: no dia havia um
      único membro em todo o banco, a dona da Equipe Blessing, e nenhuma troca de plano
      ou situação fora da administração. A prova ao vivo (inclusão como usuária inventada,
      em transação desfeita) foi bloqueada pelo classificador de permissões; o que está
      verificado são as regras aplicadas, lidas do catálogo. Achado junto: **os convites
      de equipe nunca incluíram ninguém** — o convite é gravado, mas nada o aceita. Vai
      para a Fase 7.
- [x] **Análise de IA pelo gateway do Lovable, 2026-09-16.** Para não depender dos
      secrets cadastrados à mão, a análise assistida passou a usar o gateway de IA do
      Lovable (`ai-gateway.ts`, com testes), com a `LOVABLE_API_KEY` que o próprio
      Lovable provisiona; o modelo continua do Google (`google/gemini-2.5-flash`), por
      chamada de ferramenta com o schema da análise e a mesma validação e auditoria.
      Saiu a dependência `@google/genai`. Conferido em produção pelo diagnóstico de
      variáveis: a `LOVABLE_API_KEY` chega ao servidor. Política de Privacidade na
      revisão `2026-09-13.6` (os dados da análise chegam ao Google por meio do Lovable).
      O commit do código saiu com a mensagem do anterior por engano (`8f655f0`); a
      descrição certa está no commit vazio seguinte. **Não exercitado de ponta a ponta**:
      não havia candidata para analisar; o custo sai dos créditos de IA do workspace.
- [x] **Credenciais da Meta pelo Vault do banco, 2026-09-16.** Para contornar os
      secrets que não gravam, `20260916100000_segredos_da_meta_no_vault.sql` criou
      `segredos_da_meta` (só a chave de serviço executa, só os três nomes da Meta) e o
      servidor lê primeiro o ambiente e completa o que faltar pelo Vault
      (`completarComVault`, com testes). A `META_REDIRECT_URI`, pública, já está no
      Vault; conferido em produção pelo diagnóstico (`origem.vault`). **Falta a dona
      gravar `META_APP_ID` e `META_APP_SECRET`** com `vault.create_secret` no editor SQL
      (passo a passo em `docs/integracao-meta.md`, seção 3b) — e o app da Meta
      aprovado para o fluxo real.
- [ ] **Secrets não gravam no Lovable — integração da Meta (a análise de IA foi
      resolvida pelo gateway, item acima) e, antes, análise de IA sem
      funcionar em produção.** Em 2026-09-11, `META_APP_ID`, `META_APP_SECRET`,
      `META_REDIRECT_URI` e `GEMINI_API_KEY` foram cadastrados pela tela do Lovable três
      vezes (More → Cloud → Secrets; Project Settings → Secrets; apagados e regravados).
      A tela lista os nomes, mas o cofre do projeto não os tem: o agente do Lovable só
      lista `LOVABLE_API_KEY` e `LOVABLE_CRON_SECRET`, e nem as server functions nem uma
      Edge Function os enxergam, mesmo depois de republicar. **A análise de IA nunca
      funcionou em produção** pelo mesmo motivo — as análises bem-sucedidas foram todas
      locais, com a chave no `.env.local`. Chamado aberto no suporte do Lovable. O código
      não precisa mudar: quando os secrets existirem, a leitura por `process.env` já
      funciona. Como conferir e o que remover depois: `docs/integracao-meta.md`.
- [ ] **Modelos de e-mail com a identidade MCB, ainda não ativos.** O envio de
      autenticação já funciona pelo SMTP da Hostinger — cadastro, confirmação e login
      foram exercidos de ponta a ponta. O que falta é a camada de marca: os 6 modelos
      enviam por `notify.mcblessing.com.br`, e **não dá para ativá-los com o DNS na
      Hostinger**: o Lovable exige delegar o subdomínio `notify` por `NS` para
      `ns5`/`ns6.lovable.cloud` (TXT, CNAME ou MX não substituem), e a Hostinger não aceita
      `NS` em subdomínio — as duas limitações confirmadas na documentação de cada um, em
      2026-09-11. **Decisão: deixar como está.** As mensagens seguem no formato padrão do
      Supabase, que entrega normalmente, e os modelos ficam prontos no código. Se um dia
      valer a pena, o caminho é mover o DNS de `mcblessing.com.br` para um provedor que
      aceite `NS` em subdomínio (Cloudflare, por exemplo): recriar antes os registros
      atuais a partir da exportação da zona na Hostinger, conferir cada um nos servidores
      novos, só então trocar os nameservers no registro do domínio, e por fim adicionar o
      `NS notify` e o `TXT _lovable-email` pedidos em Cloud → Emails.
- [ ] Só depois que a IA funcionar em produção (item acima): a camada gratuita do
      Gemini devolve 503 com frequência. Há retry com espera, mas
      uma análise pode levar mais de um minuto e ainda falhar. Se virar incômodo, o
      caminho é tornar a análise assíncrona em vez de prender a requisição.

## Módulo ONBIO
- [x] Banco, isolamento e ambiente ONBIO
- [x] Interface e linguagem por ambiente
- [x] Cadastro, vínculo e resultados comerciais
- [x] IA para pautas e auditoria
- [x] Testes e validação — cadastro de afiliada, resultado comercial e pauta por IA exercitados de ponta a ponta em 2026-09-16, sem erros no navegador; os dados temporários foram removidos.
- [x] Autorização da própria afiliada no Instagram, validação do @ e exibição de seguidores/publicações na gestão.

### ONBIO — seguidores autorizados (2026-09-17)
- [x] Situação da integração por afiliada: Conectado, Pendente ou Erro (sem expor token).
- [x] Sem rotina diária: a importação acontece na autorização e a atualização é solicitada
      somente pela própria afiliada em “Seu acompanhamento”. O token é renovado perto do vencimento.
- [x] Gestora visualiza situação, data e histórico, mas não usa o token nem sincroniza pela afiliada.
- [x] Histórico com anterior, atual, variação absoluta e percentual (sem percentual sobre zero).
- [x] Painel: afiliadas, conectadas, pendentes, soma só das contas lidas na Meta, crescimento
      no período, última atualização; filtros por nome, @, período e integração.
- [x] Relatório por período exportado em CSV (abre no Excel).
- [x] Número manual marcado como "informado manualmente", fora da soma da Meta.
- [x] A própria afiliada pode desconectar a conta (token apagado do Vault); o histórico permanece.
- [x] Exclusão definitiva pela dona ou administradora, com confirmação pelo e-mail: apaga
      os dados e arquivos da afiliada na ONBIO, mas preserva a conta de acesso e vínculos
      de identidade com outros ambientes.
- [ ] Validar com uma conta real: depende de `META_APP_ID`/`META_APP_SECRET` no Vault e do
      app aprovado pela Meta. Sem isso, o portal não mostra "Conectar Instagram".
