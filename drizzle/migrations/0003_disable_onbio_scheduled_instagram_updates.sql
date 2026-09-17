DO $$
DECLARE
  _job_id bigint;
BEGIN
  SELECT jobid INTO _job_id
    FROM cron.job
   WHERE jobname = 'onbio-instagram-hourly'
   LIMIT 1;
  IF _job_id IS NOT NULL THEN
    PERFORM cron.unschedule(_job_id);
  END IF;
END
$$;

REVOKE EXECUTE ON FUNCTION public.instagram_fila_de_atualizacao(integer) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.instagram_token_servico(uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.instagram_gravar_servico(uuid, integer, integer, uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.instagram_erro_servico(uuid, text) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.instagram_segredo_da_rotina() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.instagram_definir_intervalo(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.instagram_desconectar_pela_gestora(uuid) FROM authenticated;