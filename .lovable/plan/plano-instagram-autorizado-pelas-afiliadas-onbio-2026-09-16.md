# Plano — Instagram autorizado pelas afiliadas ONBIO

## Objetivo
Permitir que cada afiliada ONBIO autorize a própria conta profissional do Instagram e, após a conexão, mostrar automaticamente a quantidade de seguidores e publicações na gestão de afiliadas.

## Experiência entregue

### 1. Acesso da afiliada
- A afiliada cria ou acessa sua conta usando o mesmo e-mail cadastrado pela gestora.
- O sistema vincula com segurança esse acesso ao cadastro ONBIO correspondente, sem transformá-la em gestora e sem expor outras afiliadas.
- O portal identifica o ambiente ONBIO e usa textos de “afiliada”, sem requisitos, pontuação ou linguagem de candidatura da Ybera.

### 2. Autorização do Instagram
- Exibir no portal ONBIO a ação **Conectar Instagram** para a própria afiliada.
- Reutilizar o fluxo oficial já existente: a afiliada autoriza a conta profissional diretamente na Meta.
- Confirmar que o Instagram autorizado corresponde ao @ informado; se houver divergência, mostrar uma mensagem clara e não sobrescrever silenciosamente o cadastro.
- Permitir atualizar os números e desconectar a conta, mantendo as regras atuais de privacidade.

### 3. Seguidores e posts na gestão ONBIO
- Após a autorização, importar seguidores e quantidade de publicações.
- Atualizar o cadastro e registrar a evolução com data e origem oficial.
- Mostrar seguidores e posts na lista de afiliadas ONBIO e no perfil individual.
- Indicar quando a conta ainda não foi conectada ou quando a última atualização falhou.
- Atualizar automaticamente a lista da gestora após uma nova sincronização, sem misturar dados com a Ybera.

## Implementação técnica
- Reutilizar a integração oficial do Instagram, os tokens protegidos e as validações de propriedade já existentes.
- Adaptar o portal para reconhecer registros ONBIO e ocultar seções exclusivas da qualificação Ybera.
- Manter a leitura pela gestora somente para o estado da conexão e métricas; nenhum token será enviado ao navegador ou exibido à gestora.
- Preservar o preenchimento manual existente como estado anterior à conexão, mas os dados oficiais passam a prevalecer após a sincronização autorizada.

## Validação
- Cadastrar uma afiliada ONBIO com @ e acessar o portal com o mesmo e-mail.
- Autorizar uma conta profissional e confirmar seguidores/posts na lista e no perfil ONBIO.
- Testar divergência entre o @ cadastrado e a conta autorizada.
- Testar atualização, desconexão, erro de autorização e conta sem conexão.
- Confirmar que a afiliada não vê dados de outras pessoas e que a Ybera continua sem alterações.
- Verificar o fluxo em computador e celular.
