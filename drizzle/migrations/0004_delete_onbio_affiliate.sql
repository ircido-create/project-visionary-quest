CREATE OR REPLACE FUNCTION public.excluir_afiliada_onbio(p_influencer_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _modulo text;
BEGIN
  SELECT i.tenant_id, t.module
    INTO _tenant, _modulo
    FROM public.influencers i
    JOIN public.tenants t ON t.id = i.tenant_id
   WHERE i.id = p_influencer_id;

  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'Afiliada não encontrada.' USING ERRCODE = 'no_data_found';
  END IF;

  IF _modulo <> 'ONBIO' THEN
    RAISE EXCEPTION 'Esta exclusão está disponível somente para afiliadas ONBIO.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('mcb.acao_exclusao', 'onbio.afiliada_excluida', true);
  RETURN public.excluir_candidata(p_influencer_id, p_actor);
END
$$;

REVOKE EXECUTE ON FUNCTION public.excluir_afiliada_onbio(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_afiliada_onbio(uuid, uuid) TO service_role;