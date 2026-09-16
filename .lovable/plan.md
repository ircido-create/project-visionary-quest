# Plano — Módulo ONBIO para gestão de afiliadas

## Objetivo
Criar um ambiente ONBIO separado da Ybera, administrado somente por Monique, com as mesmas ferramentas de gestão já existentes, sem requisitos para afiliação e com IA para preparar pautas de reunião a partir de resultados comerciais.

## Experiência entregue

### 1. Dois ambientes realmente separados
- Adicionar o tipo de operação de cada ambiente: **Ybera** ou **ONBIO**.
- Criar o ambiente ONBIO e liberar acesso somente para Monique.
- Manter afiliadas, tarefas, notas, arquivos, histórico, indicadores e análises separados por ambiente.
- Ajustar títulos e termos conforme o ambiente: na ONBIO, usar “afiliadas” e remover linguagem de candidatura, auditoria e aprovação.
- Preservar integralmente os dados e regras atuais da Ybera.

### 2. Cadastro e gestão das afiliadas ONBIO
- Entrada exclusivamente pela gestora, sem formulário público de inscrição.
- Cadastro com identidade, contato, Instagram e informações de acompanhamento.
- Visão geral, lista, etapas de acompanhamento, página individual, tarefas, notas, arquivos, feedbacks, avisos, relatórios e histórico equivalentes ao módulo atual.
- Fluxo ONBIO começa ativo, sem pontuação mínima, requisitos de seguidores ou decisão de qualificação.

### 3. Vínculo opcional entre Ybera e ONBIO
- Criar uma identidade central para nome, e-mail e WhatsApp.
- Cada participação continua sendo um registro independente dentro de sua empresa.
- A gestora poderá localizar uma pessoa já cadastrada e vinculá-la manualmente ao segundo ambiente.
- Somente identidade e contato serão compartilhados; métricas, tarefas, notas, arquivos, etapas e histórico não serão misturados.
- Exibir claramente em quais ambientes a pessoa participa e permitir desfazer um vínculo incorreto sem apagar os registros.

### 4. Resultados comerciais
- Adicionar lançamentos por período com faturamento, pedidos, comissão, meta, campanha/produto e observações.
- Mostrar evolução, comparação com a meta e histórico na página da afiliada.
- Permitir correção e exclusão com registro de auditoria.
- Usar esses dados apenas no ambiente ao qual pertencem.

### 5. IA para pautas de reunião
- Criar a ação **Gerar pauta de reunião** na página da afiliada ONBIO.
- A IA usará resultados comerciais, evolução, metas, campanhas e observações do período selecionado.
- Entrega estruturada: resumo executivo, conquistas, pontos de atenção, perguntas, decisões necessárias e próximos passos.
- Permitir revisão humana antes de salvar; guardar entrada, saída, modelo, versão e autoria para auditoria.
- Exibir erros reais de configuração, créditos ou indisponibilidade e preservar o trabalho da gestora.

### 6. Identidade visual ONBIO
- Criar um tema próprio inspirado no site público da ONBIO: tipografia sans-serif limpa, superfícies claras, contraste forte e linguagem visual ligada a bem-estar e sustentabilidade.
- Usar cores e imagens próprias da ONBIO sem alterar o tema vinho/dourado da Ybera.
- Aplicar o tema automaticamente ao alternar o ambiente, inclusive em celular.

### 7. Segurança e privacidade
- Reutilizar o isolamento atual por ambiente e adicionar políticas específicas para os novos dados comerciais e pautas.
- Garantir que somente Monique consiga acessar e alterar a ONBIO.
- Não compartilhar dados entre Ybera e ONBIO sem a ação explícita de vínculo.
- Registrar criação, edição, vínculo, desvinculação e geração de pauta.

## Implementação técnica
- Evoluir `tenants` com um identificador de módulo, sem duplicar toda a plataforma.
- Manter uma participação por ambiente na estrutura atual de afiliadas e adicionar uma entidade de pessoa para compartilhar somente identidade e contato.
- Criar tabelas próprias para resultados comerciais e pautas de reunião, com permissões e índices por ambiente/afiliada.
- Tornar textos, etapas, indicadores e regras orientados pelo tipo de ambiente; a qualificação determinística continua exclusiva da Ybera.
- Implementar a geração de pautas no servidor com Lovable AI, resposta estruturada, streaming interno e trilha auditável.
- Incluir os novos dados nos processos de encerramento, exclusão e relatórios do ambiente.

## Validação
- Confirmar que Monique alterna entre Ybera e ONBIO e nenhuma outra usuária acessa ONBIO.
- Confirmar que cadastrar ou editar uma afiliada ONBIO não altera a lista Ybera.
- Testar vínculo e desvínculo, incluindo atualização compartilhada apenas de nome, e-mail e WhatsApp.
- Testar cadastro, filtros, etapas, tarefas, notas, arquivos, resultados e relatórios ONBIO.
- Executar uma geração real de pauta com dados comerciais e validar histórico e mensagens de erro.
- Verificar desktop e celular, permissões, isolamento entre ambientes e ausência de regressões na Ybera.
