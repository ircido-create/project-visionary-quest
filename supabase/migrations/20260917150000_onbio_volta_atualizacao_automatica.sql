-- ONBIO — volta a atualização automática de seguidores (2026-09-17).
--
-- A migração drizzle 0003 retirou as permissões das funções da rotina, mas o job que ela
-- tentou desligar tinha outro nome (`onbio-instagram-hourly`); o `mcb-instagram-seguidores`
-- continuou chamando um endpoint removido. A pedido da dona do projeto, a rotina volta:
-- as permissões são devolvidas e o job segue agendado. Desenho completo em
-- 20260917090000_onbio_seguidores_automaticos.sql.

grant execute on function public.instagram_fila_de_atualizacao(integer) to service_role;
grant execute on function public.instagram_token_servico(uuid) to service_role;
grant execute on function public.instagram_gravar_servico(uuid, integer, integer, uuid) to service_role;
grant execute on function public.instagram_erro_servico(uuid, text) to service_role;
grant execute on function public.instagram_renovar_token_servico(uuid, text, timestamptz) to service_role;
grant execute on function public.instagram_segredo_da_rotina() to service_role;
grant execute on function public.instagram_definir_intervalo(uuid, integer) to authenticated;
grant execute on function public.instagram_desconectar_pela_gestora(uuid) to authenticated;
