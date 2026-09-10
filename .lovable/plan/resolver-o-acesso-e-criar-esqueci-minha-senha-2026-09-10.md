# Resolver o acesso e criar "Esqueci minha senha"

## O que está acontecendo

A conta `ircido@gmail.com` foi criada pelo login do Google. Nas tentativas de hoje, o
sistema recusou repetidamente a entrada por e-mail e senha (credenciais inválidas), e
houve também uma tentativa de trocar a senha que falhou duas vezes: primeiro porque o
sistema pediu a senha atual, depois porque a nova senha escolhida é considerada fraca.

Ou seja: hoje essa conta entra pelo botão "Continuar com Google". Não existe uma senha
válida conhecida para ela.

## Acesso imediato

Na tela de entrada, usar o botão "Continuar com Google" com o e-mail `ircido@gmail.com`.
Isso funciona agora, sem nenhuma alteração.

## O que vou construir

1. **"Esqueci minha senha"** na tela de entrada: você informa o e-mail e recebe um link
   por e-mail para criar uma senha nova.
2. **Página para definir a nova senha**, aberta pelo link do e-mail, com confirmação da
   senha e aviso claro quando a senha for curta ou fraca demais.
3. **Mensagens de erro mais úteis** na entrada, em vez de "e-mail ou senha incorretos"
   para tudo:
   - conta criada pelo Google: aviso para entrar pelo Google (ou definir uma senha pelo
     "Esqueci minha senha");
   - e-mail ainda não confirmado: aviso para confirmar o e-mail;
   - senha fraca ao cadastrar ou trocar: aviso explicando o motivo.
4. **Troca de senha nas Configurações**: passar a pedir a senha atual, que é o que o
   sistema exige hoje — sem isso a troca falha.

## Ponto de atenção

O envio de e-mails do domínio próprio ainda está em verificação (registros de DNS
pendentes no provedor do domínio). Até concluir, o e-mail de recuperação pode não chegar.
Enquanto isso, a entrada pelo Google continua sendo o caminho garantido.

## Detalhes técnicos

- `src/routes/auth.tsx`: modo "forgot" chamando `supabase.auth.resetPasswordForEmail`
  com `redirectTo: ${window.location.origin}/reset-password`; mapeamento de
  `error_code` (`invalid_credentials`, `email_not_confirmed`, `weak_password`) para
  mensagens específicas.
- Nova rota pública `src/routes/reset-password.tsx` (`ssr: false`), detecta a sessão de
  recuperação e chama `supabase.auth.updateUser({ password })` sem `current_password`.
- `src/routes/_authenticated/configuracoes.tsx`: campo "senha atual" e
  `updateUser({ password, current_password })`.
- Nenhuma mudança de banco, RLS ou server functions.
