-- Promote only an existing AI-created open deal from the first pipeline stage
-- to the second (Qualified) stage. Never create deals, change value, or
-- overwrite human-managed later stages.
CREATE OR REPLACE FUNCTION public.promote_ai_qualified_deal(
  p_account_id uuid,
  p_contact_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal uuid;
  v_pipeline uuid;
  v_current uuid;
  v_new uuid;
  v_qualified uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contacts WHERE id = p_contact_id AND account_id = p_account_id
  ) THEN
    RAISE EXCEPTION 'contact does not belong to account';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_account_id::text || ':' || p_contact_id::text, 0));

  SELECT id, pipeline_id, stage_id INTO v_deal, v_pipeline, v_current
  FROM public.deals
  WHERE account_id = p_account_id AND contact_id = p_contact_id AND status = 'open'
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_deal IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_new FROM public.pipeline_stages
  WHERE pipeline_id = v_pipeline ORDER BY position ASC LIMIT 1;
  SELECT id INTO v_qualified FROM public.pipeline_stages
  WHERE pipeline_id = v_pipeline ORDER BY position ASC OFFSET 1 LIMIT 1;
  IF v_new IS NULL OR v_qualified IS NULL OR v_current IS DISTINCT FROM v_new THEN
    RETURN false;
  END IF;

  UPDATE public.deals SET stage_id = v_qualified, updated_at = now()
  WHERE id = v_deal AND account_id = p_account_id AND stage_id = v_new;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_ai_qualified_deal(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_ai_qualified_deal(uuid,uuid) TO service_role;
