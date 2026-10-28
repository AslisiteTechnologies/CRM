import { supabaseAdmin } from '@/lib/automations/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'

// Disabled unless configured. Never writes to customer conversations.
export async function notifyNewWhatsAppContact(accountId: string, contactId: string): Promise<void> {
  if (!process.env.LEAD_ALERT_ACCOUNT_ID || accountId !== process.env.LEAD_ALERT_ACCOUNT_ID) return
  const recipient = process.env.LEAD_ALERT_WHATSAPP_TO?.replace(/\D/g, '')
  if (!recipient || !/^\d{8,15}$/.test(recipient)) return
  try {
    const db = supabaseAdmin()
    const { data: contact } = await db.from('contacts')
      .select('name, phone, created_at').eq('account_id', accountId).eq('id', contactId).maybeSingle()
    const { data: config } = await db.from('whatsapp_config')
      .select('phone_number_id, access_token').eq('account_id', accountId).maybeSingle()
    if (!contact || !config) return
    const date = new Date(contact.created_at ?? Date.now())
    const time = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
    }).format(date) + ' IST'
    await sendTemplateMessage({
      phoneNumberId: config.phone_number_id,
      accessToken: decrypt(config.access_token),
      to: recipient,
      templateName: 'aslisite_new_lead_alert',
      language: process.env.LEAD_ALERT_TEMPLATE_LANGUAGE || 'en',
      params: [contact.name || 'Unknown', contact.phone || 'Not available', time],
    })
  } catch (error) {
    console.error('[lead-alert] Failed to send notification:', error)
  }
}
