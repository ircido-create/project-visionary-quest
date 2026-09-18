-- Um e-mail por ambiente, e @ do Instagram sem link colado (2026-09-18).
--
-- Dois problemas apareceram no primeiro uso real da ONBIO:
--
-- 1. Dois cadastros iguais, criados com 0,3 s de diferença — clique repetido no botão.
--    O formulário agora trava durante o envio, e o banco passa a recusar o segundo.
-- 2. Cadastros com o link do perfil no lugar do @, inclusive com parâmetro de rastreio
--    (`?stkn=...`). A Meta compara o @ exato ao conectar, então esses cadastros nunca
--    conectariam. A normalização passou a acontecer no servidor, em
--    `src/lib/mcb/instagramHandle.ts`, e os valores existentes são corrigidos aqui.

update public.influencers
   set instagram_handle = substring(instagram_handle from 'instagram\.com/([A-Za-z0-9._]+)'),
       instagram_url = 'https://instagram.com/'
         || substring(instagram_handle from 'instagram\.com/([A-Za-z0-9._]+)')
 where instagram_handle ilike '%instagram.com/%'
   and substring(instagram_handle from 'instagram\.com/([A-Za-z0-9._]+)') is not null;

-- Arquivadas ficam de fora: a mesma pessoa pode voltar depois de um encerramento.
create unique index if not exists idx_influencers_tenant_email_unico
  on public.influencers (tenant_id, lower(email))
  where archived_at is null;
