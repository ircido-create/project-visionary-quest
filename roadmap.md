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
- [ ] Integração oficial Meta/Instagram
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
- [ ] **Modelos de e-mail com a identidade MCB, ainda não ativos.** O envio de
      autenticação já funciona pelo SMTP da Hostinger — cadastro, confirmação e login
      foram exercidos de ponta a ponta. O que falta é a camada de marca: os 6 modelos
      enviam por `notify.mcblessing.com.br`, cuja verificação de DNS (NS e TXT) ainda
      não concluiu. Até lá as mensagens saem no formato padrão do Supabase, que entrega
      normalmente. Acompanhar em Cloud → Emails.
- [ ] A camada gratuita do Gemini devolve 503 com frequência. Há retry com espera, mas
      uma análise pode levar mais de um minuto e ainda falhar. Se virar incômodo, o
      caminho é tornar a análise assíncrona em vez de prender a requisição.
