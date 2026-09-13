-- Fase 6 — Registro do aceite dos Termos de Uso e da Política de Privacidade.
--
-- Revisão jurídica validada em 2026-09-13, ponto T1: o aceite de quem cria conta tem de
-- ficar registrado, com a versão e a data, como já acontece com o consentimento das
-- candidatas (`consent_logs`, que exige um ambiente e por isso não serve aqui).
--
-- DUAS PORTAS DE ENTRADA
--
-- - Cadastro por e-mail: a caixa "Li e aceito" é obrigatória, e o app manda as versões
--   aceitas nos metadados do cadastro. O gatilho em `auth.users` grava o aceite na mesma
--   transação que cria a conta — o registro não depende do navegador depois disso.
-- - Google, Lovable e contas anteriores a esta migração: a área logada pede o aceite uma
--   vez, e `aceitar_termos` grava para a pessoa logada, com a hora do banco.
--
-- O gatilho nunca impede um cadastro: se a gravação falhar, a conta é criada e o aceite
-- é pedido na primeira entrada.

create table if not exists public.aceites_de_termos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  versao_termos text not null,
  versao_politica text not null,
  origem text not null check (origem in ('cadastro', 'entrada')),
  aceito_em timestamptz not null default now()
);

create index if not exists aceites_de_termos_user_id_idx
  on public.aceites_de_termos (user_id, versao_termos);

alter table public.aceites_de_termos enable row level security;

revoke all on public.aceites_de_termos from anon, authenticated;
grant select on public.aceites_de_termos to authenticated;

drop policy if exists aceites_de_termos_ler on public.aceites_de_termos;
create policy aceites_de_termos_ler on public.aceites_de_termos
  for select to authenticated
  using (user_id = auth.uid() or public.has_platform_role(auth.uid(), 'platform_owner'));

-- Aceite na entrada: sempre da pessoa logada e com a hora do banco.
create or replace function public.aceitar_termos(p_versao_termos text, p_versao_politica text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.aceites_de_termos (user_id, versao_termos, versao_politica, origem)
  select auth.uid(), left(p_versao_termos, 40), left(p_versao_politica, 40), 'entrada'
   where auth.uid() is not null
$$;

revoke execute on function public.aceitar_termos(text, text) from public, anon;
grant execute on function public.aceitar_termos(text, text) to authenticated;

-- Aceite no cadastro por e-mail, a partir dos metadados enviados pelo app.
create or replace function public.registrar_aceite_no_cadastro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ? 'aceite_termos' then
    begin
      insert into public.aceites_de_termos (user_id, versao_termos, versao_politica, origem, aceito_em)
      values (
        new.id,
        left(new.raw_user_meta_data ->> 'aceite_termos', 40),
        left(coalesce(new.raw_user_meta_data ->> 'aceite_politica', new.raw_user_meta_data ->> 'aceite_termos'), 40),
        'cadastro',
        coalesce(new.created_at, now())
      );
    exception when others then
      raise warning 'aceite dos termos não registrado no cadastro: %', sqlerrm;
    end;
  end if;
  return new;
end
$$;

revoke execute on function public.registrar_aceite_no_cadastro() from public, anon, authenticated;

drop trigger if exists mcb_aceite_no_cadastro on auth.users;
create trigger mcb_aceite_no_cadastro
  after insert on auth.users
  for each row execute function public.registrar_aceite_no_cadastro();
