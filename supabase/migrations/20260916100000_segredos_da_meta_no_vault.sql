-- Credenciais do app da Meta no Vault do banco (2026-09-16).
--
-- Os secrets META_APP_ID, META_APP_SECRET e META_REDIRECT_URI cadastrados na tela do
-- Lovable nunca chegaram ao servidor publicado (ver docs/integracao-meta.md). Em vez de
-- esperar, eles passam a poder morar no Vault: o servidor do app lê primeiro o ambiente
-- e completa o que faltar por esta função.
--
-- Só a chave de serviço executa, e só estes três nomes saem. O valor nunca chega ao
-- navegador: quem chama é o servidor, e o diagnóstico público devolve apenas nomes.
--
-- A URL de retorno é pública e já vai gravada aqui. O ID do app e a chave secreta são
-- gravados pela dona do projeto, no editor SQL, com `vault.create_secret` — ninguém
-- além dela precisa ver esses valores.

create or replace function public.segredos_da_meta()
returns table (nome text, valor text)
language sql
stable
security definer
set search_path = public
as $$
  select name, decrypted_secret
    from vault.decrypted_secrets
   where name in ('META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI')
$$;

revoke execute on function public.segredos_da_meta() from public, anon, authenticated;
grant execute on function public.segredos_da_meta() to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'META_REDIRECT_URI') then
    perform vault.create_secret(
      'https://mcblessing.com.br/instagram/retorno',
      'META_REDIRECT_URI',
      'URL de retorno do login do Instagram (valor público)'
    );
  end if;
end
$$;
