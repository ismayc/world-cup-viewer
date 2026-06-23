import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { VENUES } from '../src/data/venues.js'
import { normalizeTeam, pairKey } from '../src/services/results.js'
import { compareSchedule, normVenue, resolveFifaVenue } from '../scripts/schedule-core.mjs'

const keyOf = (m) => pairKey(normalizeTeam(m.t1), normalizeTeam(m.t2))
const ko = (m) => new Date(m.ko).getTime()
const m1 = MATCHES.find((m) => m.num === 1) // Mexico v South Africa @ azteca
const m4 = MATCHES.find((m) => m.num === 4) // USA v Paraguay @ sofi

// FIFA's generic, sponsor-free stadium names (as the calendar reports them).
const fifaVenue = (id, name, city) => ({ id, name, city })
const ALIASES = { 400222084: 'azteca', 400017978: 'sofi' }

describe('normVenue', () => {
  it('lowercases and drops generic stadium tokens + punctuation', () => {
    expect(normVenue('MetLife Stadium')).toBe('metlife')
    expect(normVenue("Levi's Stadium")).toBe('levis')
    expect(normVenue('BC Place')).toBe('bc')
    expect(normVenue('Lincoln Financial Field')).toBe('lincolnfinancial')
    expect(normVenue('Estadio Azteca')).toBe('azteca')
  })
  it('handles null/undefined as empty', () => {
    expect(normVenue(null)).toBe('')
    expect(normVenue(undefined)).toBe('')
  })
})

describe('resolveFifaVenue', () => {
  it('resolves by stable IdStadium alias first', () => {
    const key = resolveFifaVenue(fifaVenue('400222084', 'Mexico City Stadium', 'Mexico City'), VENUES, ALIASES)
    expect(key).toBe('azteca')
  })
  it('falls back to matching our venue name when no alias', () => {
    expect(resolveFifaVenue(fifaVenue('999', 'MetLife Stadium', 'Somewhere'), VENUES, {})).toBe('metlife')
  })
  it('falls back to matching our city when name does not match', () => {
    expect(resolveFifaVenue(fifaVenue('999', 'Generic Stadium', 'Atlanta'), VENUES, {})).toBe('mercedes')
  })
  it('returns null for an unknown stadium', () => {
    expect(resolveFifaVenue(fifaVenue('999', 'Nowhere Arena', 'Atlantis'), VENUES, {})).toBeNull()
  })
  it('returns null when given no stadium', () => {
    expect(resolveFifaVenue(null, VENUES, ALIASES)).toBeNull()
    expect(resolveFifaVenue(undefined, VENUES)).toBeNull()
  })
})

describe('compareSchedule — venue cross-check', () => {
  const venueByKey = (m, fv) => new Map([[keyOf(m), fv]])
  const opts = (vbk) => ({ venueByKey: vbk, venues: VENUES, venueAliasById: ALIASES })

  it('no mismatch when FIFA stadium resolves to our stored venue (via alias)', () => {
    const vbk = venueByKey(m1, fifaVenue('400222084', 'Mexico City Stadium', 'Mexico City'))
    const { venueMismatches } = compareSchedule([m1], [], opts(vbk))
    expect(venueMismatches).toHaveLength(0)
  })

  it('flags a mismatch when FIFA resolves to a DIFFERENT venue', () => {
    // M1 is stored at azteca, but FIFA says it is the LA (sofi) stadium.
    const vbk = venueByKey(m1, fifaVenue('400017978', 'Los Angeles Stadium', 'Los Angeles'))
    const { venueMismatches } = compareSchedule([m1], [], opts(vbk))
    expect(venueMismatches).toHaveLength(1)
    expect(venueMismatches[0]).toMatchObject({
      num: 1,
      ourVenue: 'azteca',
      ourName: 'Estadio Azteca',
      fifaName: 'Los Angeles Stadium',
      fifaCity: 'Los Angeles',
    })
  })

  it('flags a mismatch when FIFA stadium cannot be resolved but clearly differs by name', () => {
    const vbk = venueByKey(m1, fifaVenue('99999', 'Totally Different Park', 'Atlantis'))
    const { venueMismatches } = compareSchedule([m1], [], opts(vbk))
    expect(venueMismatches).toHaveLength(1)
    expect(venueMismatches[0].fifaName).toBe('Totally Different Park')
  })

  it('does NOT flag when an unresolved FIFA name normalises to our stored name', () => {
    // No alias entry, and resolveFifaVenue cannot map it, but name matches ours.
    const vbk = venueByKey(m1, fifaVenue('77777', 'Estadio Azteca!!!', 'Ciudad'))
    const { venueMismatches } = compareSchedule([m1], [], opts(vbk))
    expect(venueMismatches).toHaveLength(0)
  })

  it('skips the venue check when no venue data is supplied (time-only mode)', () => {
    const { venueMismatches } = compareSchedule([m1], [{ name: 'FIFA', byKey: new Map([[keyOf(m1), ko(m1)]]) }], {})
    expect(venueMismatches).toHaveLength(0)
  })

  it('skips a match FIFA has no venue for, and one whose stored venue key is unknown', () => {
    const noFifa = compareSchedule([m1], [], opts(new Map()))
    expect(noFifa.venueMismatches).toHaveLength(0)
    // Match whose m.venue is not in VENUES → `ours` is undefined → skip.
    const bogus = { ...m1, venue: 'does-not-exist' }
    const vbk = venueByKey(bogus, fifaVenue('400017978', 'Los Angeles Stadium', 'Los Angeles'))
    const r = compareSchedule([bogus], [], opts(vbk))
    expect(r.venueMismatches).toHaveLength(0)
  })

  it('skips matches before fromMs (no venue check either)', () => {
    const vbk = venueByKey(m1, fifaVenue('400017978', 'Los Angeles Stadium', 'Los Angeles'))
    const r = compareSchedule([m1], [], { ...opts(vbk), fromMs: ko(m1) + 1 })
    expect(r.venueMismatches).toHaveLength(0)
    expect(r.unmatched).toHaveLength(0)
  })

  it('keeps time-drift behavior intact alongside the venue check', () => {
    // A 60-min FIFA drift AND a venue mismatch on the same match.
    const moved = ko(m4) + 60 * 60000
    const vbk = venueByKey(m4, fifaVenue('400222084', 'Mexico City Stadium', 'Mexico City'))
    const r = compareSchedule(
      [m4],
      [{ name: 'FIFA', byKey: new Map([[keyOf(m4), moved]]) }],
      { ...opts(vbk) },
    )
    expect(r.drifts).toHaveLength(1)
    expect(r.drifts[0]).toMatchObject({ num: 4, diffMin: 60, via: 'authority' })
    expect(r.venueMismatches).toHaveLength(1)
    expect(r.venueMismatches[0].ourVenue).toBe('sofi')
  })
})
