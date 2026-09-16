# Link de acesso para afiliadas ONBIO

## Objetivo
Permitir que a gestora copie, no perfil da afiliada, uma mensagem pronta com o link de cadastro e o e-mail correto para acesso.

## Fluxo
1. No perfil de cada afiliada ONBIO, adicionar a ação **Copiar acesso da afiliada**.
2. Ao clicar, copiar uma mensagem pronta contendo:
   - nome da afiliada;
   - link `https://mcblessing.com.br/auth?modo=cadastro`, que já abre em **Criar conta**;
   - o e-mail exato cadastrado pela gestora;
   - orientação curta para confirmar o e-mail e depois conectar o Instagram em **Seu acompanhamento**.
3. Exibir uma confirmação visual de que a mensagem foi copiada.
4. Manter o link sem nome, e-mail ou outros dados pessoais na URL; os dados aparecem somente na mensagem copiada pela gestora.

## Regras de acesso
- A afiliada deve criar a conta usando o mesmo e-mail informado na mensagem.
- Após a confirmação do e-mail e o primeiro acesso, a plataforma vincula automaticamente a conta ao cadastro ONBIO.
- A afiliada entra somente no próprio acompanhamento e não recebe acesso à gestão nem às demais afiliadas.
- Se a conta já existir, a mensagem orientará a afiliada a entrar normalmente ou recuperar a senha.

## Validação
- Testar a cópia da mensagem no perfil ONBIO em computador e celular.
- Confirmar que o link abre diretamente em **Criar conta**.
- Confirmar que uma conta com o e-mail correto é direcionada ao portal da afiliada.
- Confirmar que outro e-mail não visualiza o cadastro.
- Verificar que o fluxo Ybera continua inalterado.

## Detalhes técnicos
- Reutilizar o modo de cadastro já aceito pela página de acesso.
- Usar a área de transferência do navegador com mensagem de sucesso e tratamento de falha.
- Não criar convite de equipe, novo papel de usuário ou informação pessoal em parâmetros da URL.
