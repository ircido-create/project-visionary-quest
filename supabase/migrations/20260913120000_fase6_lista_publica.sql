-- Fase 6 — Página de candidatura só entra na lista pública do MCB por escolha da gestora.
--
-- Roda inteira de uma vez no SQL editor: mexe só no schema `public`.
--
-- Até aqui, todo ambiente com a página ligada aparecia sozinho em "Páginas de
-- candidatura", na página inicial do MCB — inclusive o de uma gestora que acabou de se
-- cadastrar e ainda nem ajustou o texto. A página continua no ar para quem tem o link
-- (`is_public_page_enabled`); aparecer na lista vira uma escolha à parte, desligada por
-- padrão. A gestora liga em Configurações.
--
-- O visitante lê a coluna nova: `listPublicManagers` filtra por ela com o cliente
-- público, e a política `tenants_public_pages` já libera a linha de página ligada.

alter table public.tenants
  add column if not exists is_listed_on_home boolean not null default false;

-- Quem continua na lista (decisão de 2026-09-13): a Equipe Blessing, para onde aponta o
-- botão principal da página inicial, e as duas demonstrações, que servem de exemplo e
-- não recebem inscrição. Os demais saem até a gestora escolher.
update public.tenants
   set is_listed_on_home = true
 where slug in ('blessing', 'aline-demo', 'patricia-demo');
