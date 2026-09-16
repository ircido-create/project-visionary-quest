CREATE OR REPLACE FUNCTION public.restrict_onbio_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if exists (select 1 from public.tenants where id = new.tenant_id and module = 'ONBIO')
     and new.user_id <> '90bd9514-26c8-4876-94b7-23208ab082f5'::uuid then
    raise exception 'O ambiente ONBIO é exclusivo da Monique.' using errcode = '42501';
  end if;
  return new;
end
$function$;

CREATE TRIGGER mcb_restrict_onbio_membership
BEFORE INSERT OR UPDATE ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.restrict_onbio_membership();