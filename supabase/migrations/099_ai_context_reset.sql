-- Reset the AI context for a conversation without deleting customer records or audit history.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_context_reset_at timestamptz;

-- Admin-only test reset. Caller authentication/tenancy is enforced in the API route.
-- This column is consumed by buildConversationContext, not the inbox history UI.
