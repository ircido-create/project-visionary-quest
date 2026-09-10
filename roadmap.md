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
- [ ] Stripe (checkout, assinatura, limites por plano)
- [ ] Painel de superadministração
- [ ] Relatórios e exportações

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
