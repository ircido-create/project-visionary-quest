# Excluir afiliadas na gestão ONBIO

## O que será entregue
- Adicionar “Excluir afiliada” no perfil da afiliada, disponível somente para dona e administradora com permissão de edição.
- Exigir a digitação do e-mail cadastrado antes de liberar a exclusão definitiva.
- Excluir o cadastro ONBIO e seus dados vinculados, incluindo resultados, pautas, tarefas, histórico, conexão e arquivos.
- Preservar a conta de acesso e a identidade compartilhada com outros ambientes.
- Registrar a ação no histórico de auditoria sem manter nome ou e-mail no registro da exclusão.
- Após concluir, voltar para a lista de afiliadas e atualizar os indicadores.

## Segurança e validação
- Confirmar no servidor que o registro pertence ao ambiente ONBIO selecionado e que a pessoa é dona ou administradora.
- Fazer a limpeza de arquivos antes da exclusão do banco e retornar mensagens claras em caso de falha.
- Validar compilação, testes relacionados e o fluxo em tela.

## Detalhes técnicos
- Reutilizar a rotina transacional de exclusão já existente no banco, sem excluir a conta de autenticação.
- Criar uma função de servidor específica da ONBIO para autorização, limpeza do armazenamento e auditoria.
- Usar os controles e avisos visuais já existentes no projeto.
