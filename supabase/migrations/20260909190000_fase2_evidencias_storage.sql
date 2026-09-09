-- Fase 2 (item 1) — Evidências: bucket privado para prints de insights.
--
-- Não altera nenhuma tabela: `public.files` (fase 1) já tem `confirmed`, `uploaded_by`
-- e `storage_path`, e a trilha de confirmação humana (quem confirmou, quando e o que
-- leu no print) fica em `public.audit_logs`, que é onde o projeto já registra isso.
--
-- ATENÇÃO — este arquivo NÃO roda inteiro de uma vez. Aplicado à mão em 2026-09-09,
-- em duas partes, porque:
--
--   * o runner do Lovable não executa migração que chega pelo GitHub (ele relata
--     sucesso e não aplica nada);
--   * o SQL editor do Supabase não cria política em storage.objects — a tabela é do
--     supabase_storage_admin e o erro é `must be owner of table objects`. Pior: o
--     editor reverte o script inteiro quando um statement falha, então uma verificação
--     rodada no mesmo lote mostra um estado que some depois.
--
-- Como aplicar:
--   1. Bucket e função (abaixo): SQL editor, um passo por execução.
--   2. As quatro políticas: painel do Supabase, Storage → Policies → New policy →
--      Custom, papel `authenticated`, com as mesmas expressões declaradas aqui.
--
-- Os `create policy` ficam registrados abaixo como a fonte da verdade do que a UI
-- deve conter, e vêm precedidos de `drop policy if exists` porque aplicação manual
-- costuma ser repetida.

-- Bucket privado. Convenção de caminho: {tenant_id}/{influencer_id}/{arquivo}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias',
  'evidencias',
  false,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Extrai o tenant do caminho. Devolve null (em vez de estourar a política) quando o
-- nome do objeto não segue a convenção — null faz can_read_tenant/is_tenant_member
-- retornarem false, então o acesso é negado em silêncio.
create or replace function public.storage_tenant_id(_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return split_part(_name, '/', 1)::uuid;
exception
  when others then return null;
end
$$;

revoke execute on function public.storage_tenant_id(text) from anon, public;
grant execute on function public.storage_tenant_id(text) to authenticated;

-- Leitura acompanha can_read_tenant (membros + ambientes de demonstração).
drop policy if exists "evidencias_member_read" on storage.objects;
create policy "evidencias_member_read" on storage.objects
for select to authenticated
using (bucket_id = 'evidencias' and public.can_read_tenant(public.storage_tenant_id(name)));

-- Escrita exige participação real: quem só enxerga a demo não é membro, então o
-- ambiente de demonstração fica somente leitura também no Storage.
drop policy if exists "evidencias_member_insert" on storage.objects;
create policy "evidencias_member_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'evidencias' and public.is_tenant_member(public.storage_tenant_id(name)));

drop policy if exists "evidencias_member_update" on storage.objects;
create policy "evidencias_member_update" on storage.objects
for update to authenticated
using (bucket_id = 'evidencias' and public.is_tenant_member(public.storage_tenant_id(name)))
with check (bucket_id = 'evidencias' and public.is_tenant_member(public.storage_tenant_id(name)));

drop policy if exists "evidencias_member_delete" on storage.objects;
create policy "evidencias_member_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'evidencias' and public.is_tenant_member(public.storage_tenant_id(name)));
