# Perfis de usuário e gestão de equipe

Tudo dentro da página **Configurações**, em duas novas seções, visíveis apenas para gestora dona ou administradora do ambiente.

## 1. Meus dados

Uma seção "Meu perfil" com:
- Nome, e-mail de contato e link da foto (avatar), salvos no próprio perfil.
- Alterar senha (senha nova + confirmação), com aviso de sucesso ou erro.
- A foto e o nome passam a aparecer no menu lateral, no lugar do texto fixo "Gestora".

## 2. Equipe

A lista de equipe hoje mostra apenas identificadores. Ela passa a mostrar nome e e-mail de cada pessoa, com:
- Seletor de papel (Dona, Administradora, Membro) — **somente a dona do ambiente** pode alterar.
- Botão de remover acesso — também somente a dona.
- A dona não pode rebaixar nem remover a si mesma; o ambiente sempre mantém uma dona.
- Em ambiente de demonstração, os controles ficam desativados com o aviso já existente.
- Cada alteração é registrada no histórico interno de auditoria.

## 3. Dados das candidatas

Na página de uma candidata, um formulário "Editar dados" para corrigir: nome, e-mail, WhatsApp, cidade, estado, @ do Instagram, tipo de perfil, frequência de stories e reels, temas, objetivo e dificuldade. Métricas (seguidores, publicações, público feminino) continuam no bloco de métricas atual, que já recalcula a qualificação.

## Detalhes técnicos

Banco (migration):
- Nova política de atualização em `tenant_memberships` restrita a `has_tenant_role(tenant_id, ARRAY['manager_owner'])`; ajustar a política de remoção para apenas `manager_owner`.
- `profiles` hoje só permite leitura do próprio registro. Adicionar política de leitura para perfis de pessoas que compartilham um tenant com o leitor, via nova função `security definer` `shares_tenant_with(_user uuid)`.

Server functions em `src/lib/mcb/app.functions.ts` (todas com `requireSupabaseAuth`):
- `saveProfile` já existe — estender para `avatar_url`; a troca de senha ocorre no cliente via `supabase.auth.updateUser`.
- `getSettings`: incluir join com `profiles` para nome/e-mail dos membros e devolver o papel do usuário atual.
- Novas: `setMemberRole`, `removeMember` (validam `manager_owner`, bloqueiam auto-alteração e a última dona, gravam em `audit_logs`).
- Nova `updateInfluencerProfile` para os campos cadastrais da candidata, com validação Zod e escrita em `audit_logs`.

Frontend: novas seções em `src/routes/_authenticated/configuracoes.tsx`, formulário de edição em `src/routes/_authenticated/candidatas.$id.tsx`, e exibição de nome/avatar em `src/components/mcb/AppShell.tsx`.
