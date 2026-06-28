import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { normalizeTeam, pairKey } from '../src/services/results.js'
import { VENUES } from '../src/data/venues.js'
import { compareSchedule, compareKnockoutSchedule } from '../scripts/schedule-core.mjs'

const m4 = MATCHES.find((m) => m.num === 4) // USA v Paraguay (group)
const keyOf = (m) => pairKey(normalizeTeam(m.t1), normalizeTeam(m.t2))
const shift = (iso, min) => new Date(iso).getTime() + min * 60000
// Build a source whose map reports `iso/ms` for match `m`.
const src = (name, m, ms) => ({ name, byKey: new Map([[keyOf(m), ms]]) })
const ko = (m) => new Date(m.ko).getTime()

describe('compareSchedule — FIFA-anchored, multi-source', () => {
  it('reports no drift when FIFA and the feeds all agree with us', () => {
    const sources = [src('FIFA', m4, ko(m4)), src('ESPN', m4, ko(m4)), src('OpenFootball', m4, ko(m4))]
    const { drifts, notes } = compareSchedule([m4], sources, {})
    expect(drifts).toHaveLength(0)
    expect(notes).toHaveLength(0)
  })

  it('treats FIFA as the answer when it differs (no human tiebreak needed)', () => {
    const moved = shift(m4.ko, 60)
    const sources = [src('FIFA', m4, moved), src('ESPN', m4, moved), src('OpenFootball', m4, ko(m4))]
    const { drifts } = compareSchedule([m4], sources, {})
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toMatchObject({ num: 4, diffMin: 60, via: 'authority' })
    expect(drifts[0].corroborators).toContain('ESPN') // ESPN agrees with FIFA
    expect(drifts[0].corroborators).not.toContain('OpenFootball') // OF still on the old time
  })

  it('fires on FIFA alone even when no feed corroborates yet (FIFA is authoritative)', () => {
    const moved = shift(m4.ko, 60)
    const sources = [src('FIFA', m4, moved), src('ESPN', m4, ko(m4)), src('OpenFootball', m4, ko(m4))]
    const { drifts } = compareSchedule([m4], sources, {})
    expect(drifts).toHaveLength(1)
    expect(drifts[0].corroborators).toEqual([])
  })

  it('does NOT drift when a feed is wrong but FIFA confirms us — logs a note instead', () => {
    const sources = [src('FIFA', m4, ko(m4)), src('ESPN', m4, shift(m4.ko, 60)), src('OpenFootball', m4, ko(m4))]
    const { drifts, notes } = compareSchedule([m4], sources, {})
    expect(drifts).toHaveLength(0) // our time is confirmed by the authority
    expect(notes).toContainEqual(expect.objectContaining({ kind: 'feed-discrepancy', source: 'ESPN' }))
  })

  it('falls back to two-feed consensus when FIFA has no time for the match', () => {
    const moved = shift(m4.ko, 60)
    // No FIFA entry; two feeds agree on the new time → consensus drift.
    const twoAgree = [src('ESPN', m4, moved), src('OpenFootball', m4, moved), src('TheSportsDB', m4, ko(m4))]
    const r1 = compareSchedule([m4], twoAgree, {})
    expect(r1.drifts).toHaveLength(1)
    expect(r1.drifts[0]).toMatchObject({ via: 'consensus' })
    // Only ONE feed differs (no FIFA) → not a drift, just a single-source note.
    const oneDiff = [src('ESPN', m4, moved), src('OpenFootball', m4, ko(m4))]
    const r2 = compareSchedule([m4], oneDiff, {})
    expect(r2.drifts).toHaveLength(0)
    expect(r2.notes).toContainEqual(expect.objectContaining({ kind: 'single-source', source: 'ESPN' }))
  })

  it('respects the threshold (4 min ignored, 5 min flagged)', () => {
    expect(compareSchedule([m4], [src('FIFA', m4, shift(m4.ko, 4))], {}).drifts).toHaveLength(0)
    expect(compareSchedule([m4], [src('FIFA', m4, shift(m4.ko, 5))], {}).drifts).toHaveLength(1)
  })

  it('marks a match unmatched when no source has it', () => {
    const { drifts, unmatched } = compareSchedule([m4], [{ name: 'FIFA', byKey: new Map() }], {})
    expect(drifts).toHaveLength(0)
    expect(unmatched).toHaveLength(1)
  })
})

describe('compareKnockoutSchedule — FIFA-anchored by match number', () => {
  const m73 = MATCHES.find((m) => m.num === 73) // R32, placeholder teams
  const fifaNum = (m, ms, venue = null) => new Map([[m.num, { ms, venue }]])

  it('reports no drift when FIFA agrees with our stored time', () => {
    const { drifts, unmatched } = compareKnockoutSchedule([m73], fifaNum(m73, ko(m73)))
    expect(drifts).toHaveLength(0)
    expect(unmatched).toHaveLength(0)
  })

  it('flags a drift (past threshold) keyed by match number, FIFA as the answer', () => {
    const moved = shift(m73.ko, 30)
    const { drifts } = compareKnockoutSchedule([m73], fifaNum(m73, moved))
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toMatchObject({ num: 73, via: 'authority', diffMin: 30, corroborators: [] })
  })

  it('respects the threshold (4 min ignored, 5 min flagged)', () => {
    expect(compareKnockoutSchedule([m73], fifaNum(m73, shift(m73.ko, 4))).drifts).toHaveLength(0)
    expect(compareKnockoutSchedule([m73], fifaNum(m73, shift(m73.ko, 5))).drifts).toHaveLength(1)
  })

  it('marks the match unmatched when FIFA has no number for it', () => {
    const { drifts, unmatched } = compareKnockoutSchedule([m73], new Map())
    expect(drifts).toHaveLength(0)
    expect(unmatched).toEqual([{ num: 73, t1: m73.t1, t2: m73.t2 }])
  })

  it('flags a venue mismatch against FIFA (report only)', () => {
    // FIFA names a different stadium than our stored venue for M73.
    const otherVenue = Object.entries(VENUES).find(([k]) => k !== m73.venue)[1]
    const fifa = fifaNum(m73, ko(m73), { id: 'X', name: otherVenue.name, city: otherVenue.city })
    const { venueMismatches } = compareKnockoutSchedule([m73], fifa, { venues: VENUES })
    expect(venueMismatches).toHaveLength(1)
    expect(venueMismatches[0]).toMatchObject({ num: 73, fifaName: otherVenue.name })
  })

  describe('feed-consensus fallback when FIFA has no time', () => {
    // Two resolved teams + secondary feeds keyed by their pair.
    const teams = { t1: 'Mexico', t2: 'England' }
    const pk = pairKey(normalizeTeam(teams.t1), normalizeTeam(teams.t2))
    const feed = (name, ms) => ({ name, byKey: new Map([[pk, ms]]) })
    const fb = (sources) => ({
      fallback: { resolvedByNum: new Map([[m73.num, teams]]), sources },
    })

    it('does NOT mark a match unmatched once feeds confirm it (no drift, no note)', () => {
      const r = compareKnockoutSchedule([m73], new Map(), fb([feed('ESPN', ko(m73)), feed('OpenFootball', ko(m73))]))
      expect(r.unmatched).toHaveLength(0)
      expect(r.drifts).toHaveLength(0)
      expect(r.notes).toHaveLength(0)
    })

    it('raises a consensus drift when ≥2 feeds agree on a different time', () => {
      const moved = shift(m73.ko, 45)
      const r = compareKnockoutSchedule([m73], new Map(), fb([feed('ESPN', moved), feed('OpenFootball', moved)]))
      expect(r.unmatched).toHaveLength(0)
      expect(r.drifts).toHaveLength(1)
      expect(r.drifts[0]).toMatchObject({ num: 73, t1: 'Mexico', t2: 'England', via: 'consensus', diffMin: 45 })
      expect(r.drifts[0].corroborators).toEqual(['ESPN', 'OpenFootball'])
    })

    it('a lone dissenting feed is a single-source note, never a drift', () => {
      const r = compareKnockoutSchedule([m73], new Map(), fb([feed('ESPN', shift(m73.ko, 45)), feed('OpenFootball', ko(m73))]))
      expect(r.drifts).toHaveLength(0)
      expect(r.unmatched).toHaveLength(0)
      expect(r.notes).toContainEqual(expect.objectContaining({ kind: 'single-source', source: 'ESPN' }))
    })

    it('still unmatched when the tie is unresolved or no feed carries it', () => {
      // Unresolved: no resolvedByNum entry.
      const r1 = compareKnockoutSchedule([m73], new Map(), {
        fallback: { resolvedByNum: new Map(), sources: [feed('ESPN', ko(m73))] },
      })
      expect(r1.unmatched).toEqual([{ num: 73, t1: m73.t1, t2: m73.t2 }])
      // Resolved, but no feed has the pair.
      const r2 = compareKnockoutSchedule([m73], new Map(), fb([{ name: 'ESPN', byKey: new Map() }]))
      expect(r2.unmatched).toEqual([{ num: 73, t1: m73.t1, t2: m73.t2 }])
    })

    it('FIFA still wins when present — fallback only fills FIFA gaps', () => {
      const moved = shift(m73.ko, 30)
      // FIFA has the time AND feeds would say something else; FIFA decides.
      const r = compareKnockoutSchedule([m73], fifaNum(m73, ko(m73)), fb([feed('ESPN', moved), feed('OpenFootball', moved)]))
      expect(r.drifts).toHaveLength(0) // FIFA confirms our stored time
    })
  })
})