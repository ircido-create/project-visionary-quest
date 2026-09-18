-- ONBIO: assinatura isenta e acesso de quem administra a plataforma (2026-09-18).
--
-- 1. O ambiente ONBIO foi criado pelo fluxo comum e ficou em avaliação de 14 dias, com
--    vencimento em 30/09/2026. O job `mcb-suspensao-por-vencimento` suspenderia o
--    ambiente com as afiliadas dentro. Como a ONBIO é operação própria da MCB, ela passa
--    a ser isenta, igual ao Equipe Blessing.
--
-- 2. A trava `restrict_onbio_membership` (migração drizzle 0001) prendia a ONBIO a um
--    único uuid. Além de contrariar a decisão da dona do projeto — o ambiente é dela, com
--    a gestora como administradora —, deixava a operação sem saída se aquela conta
--    perdesse o acesso. A regra passa a aceitar também quem tem papel de plataforma, que
--    é o mesmo critério já usado no resto do sistema.

update public.tenants
   set cobranca = 'ISENTA',
       vence_em = null,
       cancelada_em = null,
       suspensao_motivo = null
 where module = 'ONBIO';

create or replace function public.restrict_onbio_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.tenants where id = new.tenant_id and module = 'ONBIO')
     and new.user_id <> '90bd9514-26c8-4876-94b7-23208ab082f5'::uuid
     and not public.has_platform_role(new.user_id, 'platform_owner'::platform_role)
     and not public.has_platform_role(new.user_id, 'platform_admin'::platform_role) then
    raise exception 'O ambiente ONBIO é restrito à gestora e à administração da plataforma.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

-- A dona da plataforma entra como dona do ambiente: a gestora continua como está.
insert into public.tenant_memberships (tenant_id, user_id, role)
select t.id, '6d525d91-a7a3-42ac-9c58-6455b5e503be'::uuid, 'manager_owner'::tenant_role
  from public.tenants t
 where t.module = 'ONBIO'
on conflict (tenant_id, user_id) do update set role = excluded.role;
