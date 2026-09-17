# Plano — acompanhamento autorizado do Instagram na ONBIO

## Objetivo

Completar o acompanhamento de seguidores das afiliadas ONBIO usando somente a API oficial da Meta. Cada afiliada autoriza a própria conta profissional; os números são importados na autorização e atualizados quando ela solicitar pelo portal. O sistema mantém histórico, mostra crescimento e oferece relatórios. Perfis sem autorização continuam com atualização manual claramente identificada.

## O que já existe e será preservado

- Cadastro separado de afiliadas ONBIO, com nome, e-mail, `@Instagram`, link, seguidores e publicações.
- Autorização oficial pela afiliada, comparação entre a conta autorizada e o `@` cadastrado, token protegido no servidor, renovação, desconexão e registro de erros.
- Atualização manual pelo portal e histórico em registros de métricas com origem `Meta`, `manual` ou `comprovante`.
- Isolamento entre ambientes, acesso da gestora somente ao próprio ambiente e portal da afiliada restrito ao próprio cadastro.
- Funcionalidades da Ybera, qualificação e resultados comerciais da ONBIO não serão alterados.

## Limites oficiais que a interface deixará claros

- Não é possível consultar qualquer perfil público apenas pelo `@`.
- A atualização automática só funcionará após a própria afiliada autorizar uma conta profissional compatível.
- Perfis pessoais ou sem autorização permanecerão como `Pendente` e poderão receber números manuais.
- Os dados automáticos serão marcados como vindos da Meta; dados digitados nunca poderão ser apresentados como consulta oficial.

## Implementação

### 1. Dados, origem e estado da integração

- Reaproveitar os campos existentes; não duplicar nome, usuário, URL, seguidores, publicações ou histórico.
- Derivar o estado exibido como:
  - **Conectado:** autorização ativa e última consulta sem erro;
  - **Pendente:** sem autorização;
  - **Erro:** autorização existente com falha registrada.
- Usar o registro mais recente do histórico como data da informação, sem confundir edição de contato com atualização de seguidores.
- Criar operações específicas da ONBIO para lançamento manual, sempre gravando origem `MANUAL`, data, autora e novo ponto no histórico.
- Impedir que uma edição manual seja marcada como `META_API`.

### 2. Atualização pela afiliada

- Reutilizar a leitura oficial de `followers_count` e `media_count` na autorização inicial e no botão **Atualizar seguidores** do portal.
- Renovar o token quando estiver próximo do vencimento, sem expô-lo ao navegador, respostas ou logs.
- Registrar cada atualização bem-sucedida no histórico e guardar a data e o erro da última tentativa.
- Não criar rotina diária, agendamento em segundo plano ou consulta sem ação da afiliada.
- Na gestão, mostrar o estado e a idade do dado, sem conceder à gestora acesso ao token nem permitir que ela consulte a Meta em nome da afiliada.

### 3. Histórico e cálculos

- Criar uma consulta segura por afiliada e período usando os registros existentes.
- Mostrar: data, `@`, origem, seguidores anteriores, seguidores atuais, variação absoluta e percentual.
- Fórmulas:
  - variação absoluta = atual − anterior;
  - variação percentual = `(atual − anterior) / anterior × 100`;
  - quando o anterior for zero ou inexistente, o percentual será exibido como indisponível, nunca infinito ou 0% inventado.
- Adicionar gráfico e tabela de evolução no perfil ONBIO, distinguindo atualização oficial, manual e comprovada.

### 4. Lista e filtros de afiliadas

- Atualizar a listagem ONBIO para exibir: afiliada, Instagram, seguidores, crescimento no período, estado da integração e última atualização.
- Formatar números em português e usar sinais visuais acessíveis para crescimento positivo, negativo e ausência de dados.
- Adicionar filtros por nome/`@`, período e estado `Conectado`, `Pendente` ou `Erro`.
- Preservar busca, cadastro, vínculo entre ambientes e navegação existentes.

### 5. Indicadores da visão geral ONBIO

Adicionar indicadores calculados somente sobre dados válidos:

- total de afiliadas;
- perfis conectados;
- perfis pendentes;
- perfis com erro;
- soma de seguidores das contas com valor conhecido;
- crescimento total no período selecionado;
- data da atualização mais recente.

Valores ausentes permanecerão ausentes e não entrarão na soma como zero. O painel terá filtro de período e acesso rápido às afiliadas que precisam conectar ou corrigir a integração.

### 6. Relatório e exportação

- Criar relatório ONBIO por período com nome, `@`, seguidores no início, seguidores atuais, crescimento absoluto, crescimento percentual, origem e última atualização.
- Disponibilizar CSV compatível com Excel, com formatação brasileira e nome de arquivo datado.
- Registrar a exportação na auditoria, incluindo autora, ambiente, período e quantidade de registros.
- Não incluir e-mail, WhatsApp, tokens ou outros dados pessoais desnecessários nesse relatório.

### 7. Segurança e LGPD

- Manter tokens cifrados e acessíveis apenas ao processamento interno autorizado.
- Validar em todas as leituras e ações que o ambiente é ONBIO e que a gestora possui o papel permitido.
- Preservar a desconexão pela afiliada, removendo o token armazenado; após desconectar, o histórico permanece para acompanhamento, mas novas consultas param.
- Não registrar tokens, códigos OAuth ou segredos em auditoria e mensagens de erro.

### 8. Testes e validação

- Testes unitários para variação absoluta/percentual, zero, ausência de dados, estados e filtros.
- Testes de segurança para isolamento entre ambientes, impossibilidade de a gestora ler tokens ou sincronizar em nome da afiliada e bloqueio de origem `META_API` em edição manual.
- Testes da atualização solicitada: sucesso, token renovado, token expirado, limite da Meta e conta indisponível.
- Testes das telas em computador e celular: lista, filtros, histórico, painel, lançamento manual, exportação e estados vazios/erro.
- Regressão do portal da afiliada, do módulo Ybera e dos resultados comerciais ONBIO.
- Validar o fluxo completo com uma conta profissional real autorizada quando as credenciais da Meta, a revisão do aplicativo e essa conta estiverem disponíveis.

## Dependências externas

Para uso real, o aplicativo da Meta precisa ter URL de retorno correta, os escopos mínimos da Instagram API with Instagram Login e acesso aprovado para contas de terceiros quando exigido. As configurações esperadas continuam sendo `META_APP_ID`, `META_APP_SECRET` e `META_REDIRECT_URI`; nenhum valor será colocado no código.

A entrega técnica incluirá tudo que pode ser implementado e testado localmente. A validação real da Meta será registrada como concluída somente após uma afiliada autorizar uma conta profissional válida; se essa autorização externa ainda não estiver disponível, o resumo final indicará exatamente esse bloqueio, sem declarar a integração real como validada.

## Resultado esperado

A gestão ONBIO passará a acompanhar seguidores e crescimento das contas autorizadas, identificar pendências, dados desatualizados e erros, consultar o histórico, registrar valores manuais com origem correta e exportar um relatório consistente. A consulta oficial ocorrerá na autorização e quando a afiliada tocar em **Atualizar seguidores**, sem scraping, rotina diária ou alterações em áreas não relacionadas.
