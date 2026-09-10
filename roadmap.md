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
- [ ] Relatórios e exportações
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
- [ ] Testes ponta a ponta e auditoria de acessibilidade
- [ ] Otimização de desempenho

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
