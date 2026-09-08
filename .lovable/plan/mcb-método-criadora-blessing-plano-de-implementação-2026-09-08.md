# MCB — Método Criadora Blessing — Plano de Implementação

Plataforma SaaS onde gestoras acompanham candidatas a criadoras de conteúdo, cada gestora com seu ambiente totalmente isolado.

## Decisões já definidas

- Entrega **por fases**, começando pela base funcional.
- Cobrança recorrente **fica para uma fase posterior**; planos e limites já ficam registrados no sistema.
- Dados do Instagram: **preenchimento manual + envio opcional de prints** com confirmação humana. Integração oficial da Meta fica preparada, não ativada.
- Idioma: português do Brasil.

## Ajuste técnico necessário

O documento pede Next.js. Nesta plataforma o aplicativo roda em React com TanStack Start, e o banco de dados, o login, o armazenamento de arquivos e o código de servidor vêm do Lovable Cloud. Todos os requisitos de produto e de segurança do documento são mantidos — apenas a tecnologia de base muda. Isso ficará registrado em `docs/architecture.md`.

## Identidade visual

Sistema visual proprietário em tokens: vinho profundo `#50152E`, ameixa `#2B0D1C`, dourado `#C5A15A`, champagne `#E8D4AE`, creme `#F8F3EA`, rosa queimado `#B96D84`, grafite `#181116`, branco suave `#FFFDFC`. Vidro sofisticado com transparência moderada, gradientes vinho/dourado, grão discreto, títulos editoriais e texto altamente legível. Contraste AA, movimento discreto, respeito a `prefers-reduced-motion`. Fotos oficiais entram depois; enquanto isso, espaços reservados claramente identificados.

## Fase 1 (esta entrega)

**Base e segurança**
- Ativar o Lovable Cloud.
- Banco com: gestoras (tenants), participações da equipe, marca da gestora, planos, candidatas, inscrições e respostas, métricas informadas, prints enviados, conjuntos de requisitos, resultados de qualificação, tarefas, notas, feedbacks, arquivos, histórico de status, consentimentos, auditoria.
- `tenant_id` em todo dado de negócio, índices começando por ele, permissões explícitas e políticas de acesso por linha; papéis em tabela separada (nunca no perfil).
- Isolamento garantido no banco: trocar IDs ou endereços na URL não expõe nada de outra gestora.

**Público**
- Página inicial de venda do sistema, `/metodo`, `/para-gestoras`, `/precos`, `/privacidade`, `/termos`.
- Login, cadastro e recuperação de senha.
- Landing individual de cada gestora em `/g/[slug]`, formulário "Porta de Entrada" em etapas (21 campos do documento, rascunho local, consentimento obrigatório) e página de agradecimento. A inscrição é atribuída à gestora correta no servidor.

**Painel da gestora**
- Dashboard com números reais: total, novas inscrições, qualificadas, em desenvolvimento, aguardando dados, prontas para auditoria, mais próximas da meta, tarefas atrasadas.
- Lista de candidatas com filtros e busca, visão em tabela e em quadro por etapa.
- Perfil completo da candidata: respostas, métricas, checklist de requisitos, medidor de progresso, linha do tempo das 5 etapas, comparação Hoje x Meta, tarefas, notas, feedbacks, arquivos, histórico.
- Configurações: marca, link de candidatura, equipe (convites), assinatura (somente leitura nesta fase).

**Motor de qualificação (determinístico)**
- 500+ seguidores; 31+ publicações; 12 últimas publicações nos últimos 6 meses; perfil de criadora; público feminino acima de 50%.
- Resultados `QUALIFIED` / `NOT_QUALIFIED` / `NEEDS_EVIDENCE` / `MANUAL_REVIEW`, mostrando valor atual, mínimo, diferença, fonte e data.
- Índice de progresso com os pesos do documento (soma 100%) e níveis Estruturar / Produzir / Crescer / Pronta para auditoria / Qualificada.
- Testes de borda 499/500, 30/31, 50/50,01 e "sem dados nunca qualifica".

**Dados de demonstração**
- Migração com inserções reais: "Equipe Blessing", "Gestora Aline — Demo", "Gestora Patrícia — Demo", candidatas em níveis diferentes (uma qualificada, uma perto da meta, uma aguardando dados). Nenhum dado pessoal real.

**Documentação**
- `README.md`, `.env.example`, `docs/product.md`, `docs/architecture.md`, `docs/database.md`, `docs/multi-tenancy.md`, `docs/security.md`, `docs/privacy.md`, `docs/testing.md`, com pontos que exigem revisão jurídica sinalizados.

## Fases seguintes (após aprovação desta)

2. Análise com IA: envio só dos dados consentidos, resposta estruturada e validada, versões, evidências, nível de confiança, plano de 7 e 30 dias, ideias de conteúdo, revisão humana obrigatória. Extração assistida dos prints com confirmação.
3. Assinaturas: planos, limites de uso aplicados, checkout, portal do cliente, ativação por webhook idempotente.
4. Superadmin da Monique: gestoras, assinaturas, uso, planos, templates globais, auditoria, saúde, chaves de recurso.
5. Portal da candidata, relatórios em PDF/CSV, exportação e exclusão de dados, testes ponta a ponta, acessibilidade e desempenho.

## Detalhes técnicos

- Regras de qualificação em módulo puro e testado, versionadas por conjunto de regras editável.
- Leitura de dados por rota com cache do TanStack Query; escrita por funções de servidor validadas com Zod e autorização verificada no servidor.
- Arquivos em armazenamento privado com URLs assinadas temporárias, validação de tipo e tamanho.
- Auditoria em toda visualização sensível, exportação, mudança de status e decisão manual.
- Vitest para regras de qualificação e testes de isolamento entre duas gestoras.
- Cada página com seus próprios título e descrição.
