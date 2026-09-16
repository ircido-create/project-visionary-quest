# Importar dados pelo @Instagram e remover acesso Lovable

## Resultado esperado

Na **Visão geral**, a gestora terá a ação **Importar pelo Instagram**. Ela informa o @ de uma candidata já cadastrada e o sistema:

- localiza a candidata pelo @ dentro do ambiente atual;
- se o Instagram estiver conectado, importa seguidores, total de publicações e público feminino disponível;
- atualiza os indicadores, o histórico e a qualificação da candidata;
- se ainda não houver autorização, explica que a candidata precisa conectar a própria conta no portal e oferece o convite já existente pelo WhatsApp;
- informa claramente quando o @ não estiver cadastrado.

A consulta não tentará extrair dados de perfis públicos sem autorização. A API oficial da Meta não permite importar os dados de uma conta arbitrária apenas pelo @.

Também será removido da página `/auth` o botão **Continuar com Lovable**, mantendo acesso por Google, e-mail e senha.

## Alterações na interface

1. Adicionar **Importar pelo Instagram** às ações da Visão geral.
2. Abrir uma janela com campo para o @, busca, estados de carregamento e resultado.
3. Para conta conectada, mostrar a candidata encontrada e pedir confirmação antes de atualizar.
4. Para conta não conectada, mostrar o caminho de autorização pelo portal e o convite por WhatsApp quando houver número cadastrado.
5. Após a importação, atualizar os números da Visão geral e da lista/detalhe de candidatas sem recarregar a página.
6. Remover o botão Lovable e o código usado exclusivamente para sincronizar perfil vindo desse provedor.

## Regras e segurança

- Somente gestora dona ou administradora poderá iniciar a atualização pela Visão geral.
- A busca ficará limitada às candidatas do ambiente selecionado.
- Tokens do Instagram continuarão invisíveis para a gestora e para o navegador.
- A operação será registrada no histórico de auditoria.
- Contas pessoais, dados demográficos indisponíveis e autorização vencida terão mensagens específicas.
- O fluxo manual com prints continuará disponível quando a Meta não fornecer o dado.

## Detalhes técnicos

- Criar uma função autenticada para localizar a candidata pelo @ e solicitar a sincronização, com validação de ambiente e papel.
- Reaproveitar a leitura e gravação já existentes da integração oficial, sem duplicar regras de interpretação dos dados.
- Ajustar com segurança a autorização atual, que hoje restringe a sincronização à própria candidata, permitindo à gestora autorizada solicitar atualização sem receber o token.
- Adicionar testes para isolamento entre ambientes, papéis permitidos, @ inexistente, conexão ausente e atualização bem-sucedida.
- Atualizar o roadmap com as duas entregas.

## Validação

- Confirmar o fluxo na Visão geral em computador e celular.
- Confirmar que Google, e-mail, senha e recuperação continuam funcionando em `/auth` sem o botão Lovable.
- Executar testes automatizados e conferir compilação, erros no navegador e registros de rede.
- A importação real de ponta a ponta dependerá de os secrets da Meta estarem disponíveis no ambiente publicado e da conta ter autorizado o app.
