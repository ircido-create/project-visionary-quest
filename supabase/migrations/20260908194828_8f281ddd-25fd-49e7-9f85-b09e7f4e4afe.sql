revoke execute on function public.is_tenant_member(uuid) from anon, public;
revoke execute on function public.has_tenant_role(uuid, public.tenant_role[]) from anon, public;
revoke execute on function public.tenant_is_demo(uuid) from anon, public;
revoke execute on function public.has_platform_role(uuid, public.platform_role) from anon, public;
revoke execute on function public.can_read_tenant(uuid) from anon, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;