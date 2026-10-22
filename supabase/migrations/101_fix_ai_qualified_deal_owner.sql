-- Fix AI-qualified deal ownership for accounts whose WhatsApp config owner
-- is not an account profile. Use the existing account-scoped pipeline owner.
-- Preserve the function signature so deployed callers remain compatible.
-- Atomic, account-scoped, idempotent conversion of an AI-qualified inbound enquiry.
-- The AI only supplies the qualification decision; SQL owns tenant validation and deduplication.
CREATE OR REPLACE FUNCTION public.create_ai_qualified_deal(
  p_account_id uuid,
  p_contact_id uuid,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pipeline uuid;
  v_stage uuid;
  v_deal uuid;
  v_name text;
  v_currency text;
  v_owner uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = p_contact_id AND account_id = p_account_id) THEN
    RAISE EXCEPTION 'contact does not belong to account';
  END IF;
  -- Serialize simultaneous webhook deliveries for this account/contact.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_account_id::text || ':' || p_contact_id::text, 0));

  SELECT id INTO v_deal FROM public.deals
  WHERE account_id = p_account_id AND contact_id = p_contact_id AND status = 'open'
  ORDER BY created_at DESC LIMIT 1;
  IF v_deal IS NOT NULL THEN RETURN v_deal; END IF;

  SELECT id, user_id INTO v_pipeline, v_owner FROM public.pipelines
  WHERE account_id = p_account_id ORDER BY created_at ASC LIMIT 1;
  IF v_pipeline IS NULL THEN RETURN NULL; END IF;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'pipeline has no owner'; END IF;
  SELECT id INTO v_stage FROM public.pipeline_stages
  WHERE pipeline_id = v_pipeline ORDER BY position ASC LIMIT 1;
  IF v_stage IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(NULLIF(name, ''), phone, 'WhatsApp customer') INTO v_name
  FROM public.contacts WHERE id = p_contact_id AND account_id = p_account_id;
  SELECT COALESCE(default_currency, 'INR') INTO v_currency
  FROM public.accounts WHERE id = p_account_id;

  INSERT INTO public.deals(account_id, user_id, contact_id, pipeline_id, stage_id, title, value, currency, status, notes)
  VALUES(p_account_id, v_owner, p_contact_id, v_pipeline, v_stage,
    'WhatsApp enquiry — ' || LEFT(v_name, 120), 0, v_currency, 'open',
    'AI-qualified inbound WhatsApp sales enquiry. Requirements and quotation to be confirmed.')
  RETURNING id INTO v_deal;
  RETURN v_deal;
END;
$$;
REVOKE ALL ON FUNCTION public.create_ai_qualified_deal(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_ai_qualified_deal(uuid,uuid,uuid) TO service_role;
