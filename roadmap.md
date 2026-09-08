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
- [ ] Upload de prints com confirmação humana (Storage + tabela `files`)
- [ ] Análise de perfil com IA registrando entrada, saída e versão do prompt
- [ ] Portal da candidata com tarefas e evolução

## Fase 3 — Operação e cobrança
- [ ] Stripe (checkout, assinatura, limites por plano)
- [ ] Painel de superadministração
- [ ] Relatórios e exportações

## Fase 4 — Integrações e qualidade
- [ ] Integração oficial Meta/Instagram
- [ ] Testes ponta a ponta e auditoria de acessibilidade
- [ ] Otimização de desempenho

## Pendências conhecidas
- [ ] Revisar aviso do verificador de segurança sobre funções auxiliares de permissão
      (`is_tenant_member`, `has_tenant_role`, `tenant_is_demo`, `has_platform_role`,
      `can_read_tenant`) — hoje necessárias para as políticas de acesso.
