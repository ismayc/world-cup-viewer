import { describe, it, expect } from 'vitest'
import calendar from '../netlify/functions/calendar.js'

// The ICS feed pulls OpenFootball, whose knockout slots are cryptic codes
// (1A / 2B / 3A/B/C/D/F / W73 / L101). prettySlot maps them to the same friendly
// wording the app's bracket shows, so calendar subscribers don't see raw codes.
const { prettySlot } = calendar

describe('calendar prettySlot — OpenFootball knockout codes → friendly labels', () => {
  it('maps group-winner and runner-up codes', () => {
    expect(prettySlot('1F')).toBe('Winner Group F')
    expect(prettySlot('2B')).toBe('Runner-up Group B')
  })

  it('maps third-place pools and match winner/loser feeds', () => {
    expect(prettySlot('3A/B/C/D/F')).toBe('3rd place (A/B/C/D/F)')
    expect(prettySlot('W73')).toBe('Winner Match 73')
    expect(prettySlot('L101')).toBe('Loser Match 101')
  })

  it('passes a resolved real team through (normalising feed spellings)', () => {
    expect(prettySlot('Canada')).toBe('Canada')
    expect(prettySlot('Czech Republic')).toBe('Czechia')
    expect(prettySlot('Turkey')).toBe('Türkiye')
  })

  it('leaves empty input untouched', () => {
    expect(prettySlot('')).toBe('')
    expect(prettySlot(undefined)).toBe(undefined)
  })
})
