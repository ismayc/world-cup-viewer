import { describe, it, expect } from 'vitest'
import { crossCheck, annotateScoreChecks, reconcileScores } from '../src/services/reconcile.js'
import { MATCHES } from '../src/data/matches.js'

const match1 = MATCHES.find((m) => m.num === 1) // Mexico v South Africa

// A source is { name, score(match) -> {home, away, ft} | null }.
const src = (name, rec) => ({ name, score: () => rec })

describe('crossCheck', () => {
  it('returns null when fewer than two sources have a final', () => {
    const sources = [
      src('A', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
      src('B', null),
    ]
    expect(crossCheck(match1, sources)).toBeNull()
  })

  it('agrees across sources even when home/away orientation differs', () => {
    const sources = [
      src('A', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
      src('B', { home: 'South Africa', away: 'Mexico', ft: [1, 2] }), // flipped, same result
      src('C', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
    ]
    const cc = crossCheck(match1, sources)
    expect(cc.count).toBe(3)
    expect(cc.agree).toBe(true)
  })

  it('flags disagreement', () => {
    const sources = [
      src('A', { home: 'Mexico', away: 'South Africa', ft: [2, 1] }),
      src('B', { home: 'Mexico', away: 'South Africa', ft: [2, 2] }),
    ]
    expect(crossCheck(match1, sources).agree).toBe(false)
  })
})

describe('annotateScoreChecks', () => {
  it('sets scoreCheck only on matches with a multi-source final, immutably', () => {
    const sources = [
      { name: 'A', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
      { name: 'B', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
    ]
    const out = annotateScoreChecks(MATCHES, sources)
    const m1 = out.find((m) => m.num === 1)
    expect(m1.scoreCheck).toEqual({ count: 2, agree: true })
    expect(m1).not.toBe(match1) // new object
    // A match with no multi-source final is returned untouched (same reference).
    const m2src = MATCHES.find((m) => m.num === 2)
    expect(out.find((m) => m.num === 2)).toBe(m2src)
  })

  it('returns input unchanged with fewer than two sources', () => {
    expect(annotateScoreChecks(MATCHES, [])).toBe(MATCHES)
  })
})

describe('reconcileScores', () => {
  it('has nothing to reconcile without at least two sources', () => {
    // Cross-checking is only meaningful between sources; one (or none) cannot
    // disagree with itself, and must not be reported as if it had.
    const one = [{ name: 'OpenFootball', score: () => ({ home: 'A', away: 'B', ft: [1, 0] }) }]
    expect(reconcileScores(MATCHES, one)).toEqual([])
    expect(reconcileScores(MATCHES, [])).toEqual([])
    expect(reconcileScores(MATCHES, undefined)).toEqual([])
  })

  it('lists every source score for disagreeing matches only', () => {
    const agree = [
      { name: 'OpenFootball', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
      { name: 'ESPN', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
    ]
    expect(reconcileScores(MATCHES, agree)).toEqual([])

    const disagree = [
      { name: 'OpenFootball', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
      { name: 'ESPN', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [2, 1] } : null) },
      { name: 'TheSportsDB', score: (m) => (m.num === 1 ? { home: 'Mexico', away: 'South Africa', ft: [3, 1] } : null) },
    ]
    const diffs = reconcileScores(MATCHES, disagree)
    expect(diffs).toHaveLength(1)
    expect(diffs[0].num).toBe(1)
    expect(diffs[0].reports.map((r) => r.source)).toEqual(['OpenFootball', 'ESPN', 'TheSportsDB'])
  })
})
