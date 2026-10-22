import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * Admin-only non-destructive AI test reset. The contact and message audit
 * trail remain intact; the AI sees only messages received after reset.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`ai-test-reset:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const { conversationId } = await context.params
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
    }
    const { data: existing, error: readError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .maybeSingle()
    if (readError) throw readError
    if (!existing) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('conversations')
      .update({
        ai_context_reset_at: new Date().toISOString(),
        ai_autoreply_disabled: false,
        ai_reply_count: 0,
        ai_handoff_summary: null,
        assigned_agent_id: null,
        status: 'open',
      })
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
