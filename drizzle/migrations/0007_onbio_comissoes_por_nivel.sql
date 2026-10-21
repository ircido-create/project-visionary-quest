-- ONBIO — percentuais de comissão por nível da rede (2026-10-21).
--
-- Cada venda paga a vendedora e até cinco pessoas acima dela na rede de indicações. Os
-- percentuais ficam no ambiente, na ordem: venda própria, 1º nível acima, 2º, 3º, 4º e 5º.
-- O padrão é o da ONBIO: 15%, 5%, 2,5%, 2,5%, 2,5% e 1%.
--
-- O cálculo em si não fica no banco: é feito na aplicação (`calcularComissoes`, com
-- testes), a partir das vendas importadas e da rede. Aqui só se guardam as regras.

alter table public.tenants
  add column if not exists onbio_comissao_percentuais numeric(5, 2)[] not null
  default array[15, 5, 2.5, 2.5, 2.5, 1]::numeric(5, 2)[];

alter table public.tenants
  drop constraint if exists tenants_onbio_comissao_percentuais_validos;
alter table public.tenants
  add constraint tenants_onbio_comissao_percentuais_validos check (
    array_length(onbio_comissao_percentuais, 1) = 6
    and 0 <= all (onbio_comissao_percentuais)
    and 100 >= all (onbio_comissao_percentuais)
  );

create or replace function public.onbio_definir_comissoes(p_tenant uuid, p_percentuais numeric[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes numeric[];
begin
  if not exists (select 1 from public.tenants where id = p_tenant and module = 'ONBIO') then
    raise exception 'As comissões por nível existem só no ambiente ONBIO.' using errcode = '22023';
  end if;
  if not public.has_tenant_role(p_tenant, array['manager_owner'::tenant_role, 'manager_admin'::tenant_role]) then
    raise exception 'Só a dona ou uma administradora do ambiente muda as comissões.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_percentuais is null or array_length(p_percentuais, 1) is distinct from 6 then
    raise exception 'Informe seis percentuais: venda própria e cinco níveis.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_percentuais) v where v is null or v < 0 or v > 100) then
    raise exception 'Cada percentual precisa estar entre 0 e 100.' using errcode = '22023';
  end if;
  if (select sum(v) from unnest(p_percentuais) v) > 100 then
    raise exception 'A soma dos percentuais não pode passar de 100%%.' using errcode = '22023';
  end if;

  select onbio_comissao_percentuais into v_antes from public.tenants where id = p_tenant;
  update public.tenants
     set onbio_comissao_percentuais = p_percentuais::numeric(5, 2)[]
   where id = p_tenant;

  insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, meta)
  values (p_tenant, auth.uid(), 'onbio.comissoes_definidas', 'tenants', p_tenant,
          jsonb_build_object('antes', to_jsonb(v_antes), 'depois', to_jsonb(p_percentuais)));
end
$$;

revoke all on function public.onbio_definir_comissoes(uuid, numeric[]) from public, anon;
grant execute on function public.onbio_definir_comissoes(uuid, numeric[]) to authenticated;