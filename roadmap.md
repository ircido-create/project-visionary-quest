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

- [ ] **Fluxo de auditoria.** Hoje a etapa "Pronta para auditoria" só tem um contador no
      painel: não há tela para auditar, e é por isso que as candidatas param ali. O banco
      já tem `qualification_results.manual_decision`, `manual_decision_by` e
      `manual_decision_note`, sem uso. A tela mostra cada requisito com o valor atual, a
      meta e as evidências confirmadas, e registra a decisão — aprovar (Qualificada ou
      Enviada para análise oficial) ou devolver com motivo, criando a tarefa do que
      falta —, com autor, data e entrada em `audit_logs`.
- [ ] **Modelos de tarefa por nível.** A tabela `task_templates` (nível, título,
      descrição; `tenant_id` opcional, para modelos gerais do método e da gestora) existe
      e está vazia, sem tela — hoje cada tarefa é criada à mão, candidata por candidata.
      Biblioteca de modelos em Configurações e, quando a candidata muda de nível, a
      sugestão das tarefas do modelo para a gestora confirmar (não criar sozinho). Falta
      uma coluna de prazo padrão em dias — migração pequena.
- [ ] **Convite e lembrete pelo WhatsApp, sem API.** O telefone da candidata já é
      coletado na Porta de Entrada. Botões que abrem `wa.me/<número>?text=` com a
      mensagem pronta — convite para o portal, com o link, e lembrete de tarefa
      atrasada — para a gestora enviar do próprio WhatsApp. Sem secret e sem custo por
      mensagem; o envio continua sendo um gesto da gestora.
- [ ] **Relatório de evolução para compartilhar.** Uma página por candidata com a
      evolução dos números (`metric_snapshots`), os requisitos e as tarefas concluídas,
      para a gestora mandar à candidata ou a quem avalia. Os dados já existem; é
      apresentação e controle de quem pode ver.

**Depois que os secrets funcionarem em produção:**

- [ ] Avisos automáticos por e-mail ou WhatsApp com API — resumo semanal para a
      gestora, lembrete de prazo para a candidata. Exigem credencial do provedor de
      envio e um job agendado (`pg_cron`, disponível no banco mas não instalado; ligar é
      configuração da plataforma).
- [ ] Análise de IA em produção (Fase 2), hoje sem a chave do Gemini no servidor.

## Pendências conhecidas
- [ ] **Secrets não gravam no Lovable — integração da Meta e análise de IA sem
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
