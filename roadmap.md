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
- [ ] **O envio de e-mail não funciona.** O SMTP embutido do Supabase não entrega, e o
      customizado (Hostinger) ainda não foi configurado. O portal foi validado com uma
      conta já confirmada à mão: o vínculo, a listagem e a conclusão de tarefa funcionam,
      mas **uma candidata real não consegue confirmar o e-mail**, então não chega até lá.
      Configurar SPF e DKIM junto, senão a mensagem sai e cai em spam.
- [ ] O código ignora o erro dos inserts em `audit_logs`. Foi por isso que a trilha
      passou a fase 1 inteira sem gravar nada sem ninguém notar — a política de INSERT
      não existia. A política foi corrigida, mas o padrão de engolir o erro continua e
      esconderia a próxima falha do mesmo tipo.
- [ ] A camada gratuita do Gemini devolve 503 com frequência. Há retry com espera, mas
      uma análise pode levar mais de um minuto e ainda falhar. Se virar incômodo, o
      caminho é tornar a análise assíncrona em vez de prender a requisição.
- [ ] Revisar aviso do verificador de segurança sobre funções auxiliares de permissão
      (`is_tenant_member`, `has_tenant_role`, `tenant_is_demo`, `has_platform_role`,
      `can_read_tenant`, `storage_tenant_id`) — hoje necessárias para as políticas de acesso.
- [ ] As políticas do bucket `evidencias` foram criadas pela UI de Storage, não por
      migração: o SQL editor não é dono de `storage.objects`. O arquivo
      `supabase/migrations/20260909190000_fase2_evidencias_storage.sql` guarda a
      definição, mas recriar o banco do zero exige repetir esse passo à mão.
