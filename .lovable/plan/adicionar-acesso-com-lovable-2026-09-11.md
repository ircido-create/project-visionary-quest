# Adicionar acesso com Lovable

## O que será feito

1. Ativar o provedor de acesso Lovable no projeto.
2. Atualizar a biblioteca oficial de autenticação para uma versão que inclua o botão visual oficial.
3. Adicionar “Continuar com Lovable” à tela atual de entrada e cadastro, mantendo Google e e-mail/senha disponíveis.
4. Após o acesso, sincronizar nome, e-mail e foto fornecidos pela conta Lovable com o perfil já usado pela plataforma, sem apagar dados existentes quando algum campo não vier preenchido.
5. Encaminhar a pessoa ao portal de candidata ou ao painel de gestão conforme as regras atuais.
6. Validar a tela, o retorno do acesso e a compilação do aplicativo.

## Detalhes técnicos

- Usar o fluxo oficial `lovable.auth.signInWithOAuth("lovable")` com retorno para a origem pública.
- Importar os estilos oficiais do botão em vez de recriar a marca.
- Manter a sincronização protegida pelas regras de acesso já existentes na tabela de perfis.
- Não alterar papéis, ambientes, candidaturas nem outras regras do sistema.
