-- Endurece o que um visitante sem login (papel `anon`) alcança. Revisão de 2026-09-12,
-- feita depois do caso das inscrições reais em ambiente de demonstração.
--
-- Roda inteira de uma vez no SQL editor: mexe só no schema `public`. Só retira acesso de
-- quem não está logado; nada muda para contas logadas nem para o servidor.
--
-- NADA DISTO ERA EXPLORÁVEL NO DIA — é defesa em profundidade:
--
-- 1. As oito funções da integração com o Instagram (fase 4) ganharam `grant ... to
--    authenticated`, mas ninguém tirou o EXECUTE que o Postgres dá a PUBLIC por padrão —
--    as migrações das fases 2 e 3 faziam esse `revoke`. Todas conferem
--    `is_influencer_owner` (`influencers.user_id = auth.uid()`), que nunca é verdade sem
--    login, e não havia nenhuma conexão nem token no Vault. Mas uma função que devolve
--    token não deve depender só da checagem interna.
--
-- 2. `tenant_branding` tinha leitura pública com `using (true)`, em todas as colunas e de
--    todos os ambientes — inclusive o WhatsApp da gestora e ambientes com a página pública
--    desligada. No dia, nenhuma marca tinha WhatsApp e todas as páginas estavam ligadas. A
--    página pública (`getManagerPage`) só lê as colunas liberadas abaixo.

-- 1. Funções do Instagram: só contas logadas (o app as chama com a sessão da pessoa).
revoke execute on function public.instagram_connect(uuid, text, text, text, timestamptz, text) from public, anon;
revoke execute on function public.instagram_token(uuid) from public, anon;
revoke execute on function public.instagram_status(uuid) from public, anon;
revoke execute on function public.instagram_record_sync(uuid, integer, integer, numeric, text, numeric, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.instagram_record_error(uuid, text) from public, anon;
revoke execute on function public.instagram_disconnect(uuid) from public, anon;
revoke execute on function public.is_influencer_owner(uuid) from public, anon;
revoke execute on function public.instagram_qualification_input(uuid) from public, anon;

-- 2a. Marca: visitante lê só as colunas que a página pública mostra (e o tenant_id, que
-- ela usa no filtro). WhatsApp, imagens e datas ficam de fora.
revoke select on public.tenant_branding from anon;
grant select (tenant_id, manager_name, headline, subheadline, authority_quote, bio, instagram_handle, accent_color)
  on public.tenant_branding to anon;

-- 2b. Marca: visitante lê só a de ambiente com página pública ligada e ativo — o mesmo
-- critério que `getManagerPage` usa para mostrar a página.
drop policy if exists branding_public_read on public.tenant_branding;
create policy branding_public_read on public.tenant_branding
  for select to anon
  using (
    exists (
      select 1 from public.tenants t
       where t.id = tenant_branding.tenant_id
         and t.is_public_page_enabled
         and t.status = 'ACTIVE'
    )
  );
