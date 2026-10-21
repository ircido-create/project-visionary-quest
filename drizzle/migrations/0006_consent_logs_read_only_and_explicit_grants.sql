grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid, public.tenant_role[]) to authenticated;
grant execute on function public.tenant_is_demo(uuid) to authenticated;
grant execute on function public.has_platform_role(uuid, public.platform_role) to authenticated;
grant execute on function public.can_read_tenant(uuid) to authenticated;
drop policy if exists "consent_logs_member_write" on public.consent_logs;
drop policy if exists "consent_logs_member_update" on public.consent_logs;
drop policy if exists "consent_logs_member_delete" on public.consent_logs;