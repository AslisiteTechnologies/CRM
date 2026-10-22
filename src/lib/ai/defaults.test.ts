import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, HANDOFF_SENTINEL } from './defaults'

describe('sales conversation continuity prompt', () => {
  it('keeps ordinary e-commerce and package questions in AI', () => {
    const prompt = buildSystemPrompt({
      mode: 'auto_reply',
      userPrompt: 'E-commerce websites start at ₹15,000.',
      knowledge: ['E-commerce packages include an online store with scoped features.'],
    })
    expect(prompt).toContain('Routine questions about packages')
    expect(prompt).toContain('bakery asks about online ordering')
    expect(prompt).toContain('answer any verified portion')
    expect(prompt).toContain('E-commerce websites start at ₹15,000.')
    expect(prompt).toContain('[[SALES_LEAD]]')
  })

  it('retains human handoff for explicit human requests and binding commitments', () => {
    const prompt = buildSystemPrompt({ mode: 'auto_reply', userPrompt: null })
    expect(prompt).toContain('explicitly asks for a person')
    expect(prompt).toContain('payment instructions')
    expect(prompt).toContain(HANDOFF_SENTINEL)
  })

  it('does not add auto-reply controls to manual drafts', () => {
    const prompt = buildSystemPrompt({ mode: 'draft', userPrompt: null })
    expect(prompt).not.toContain(HANDOFF_SENTINEL)
    expect(prompt).not.toContain('[[SALES_LEAD]]')
  })
})
