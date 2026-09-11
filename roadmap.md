# Roadmap MCB

## Fase 1 — Base funcional (concluída)
- [x] Banco multi-tenant com RLS, grants e dados de demonstração
- [x] Motor determinístico de qualificação + testes
- [x] Landing pública e página por gestora com Porta de Entrada
- [x] Autenticação (e-mail/senha e Google) e área protegida
- [x] Visão geral, candidatas, detalhe, tarefas e configurações
- [x] Consentimento LGPD, histórico e auditoria
- [x] Documentação da fase 1

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
      enviam por `notify.mcblessing.com.br`, cuja verificação de DNS (NS e TXT) ainda
      não concluiu. Até lá as mensagens saem no formato padrão do Supabase, que entrega
      normalmente. Acompanhar em Cloud → Emails.
- [ ] Só depois que a IA funcionar em produção (item acima): a camada gratuita do
      Gemini devolve 503 com frequência. Há retry com espera, mas
      uma análise pode levar mais de um minuto e ainda falhar. Se virar incômodo, o
      caminho é tornar a análise assíncrona em vez de prender a requisição.
