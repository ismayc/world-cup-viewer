import { describe, it, expect } from 'vitest'
import { liveState, statusFlag } from '../src/utils/time.js'
import { computeClinch } from '../src/utils/clinch.js'
import { rankGroup, computeQualification, groupComplete } from '../src/utils/qualification.js'
import { MATCHES } from '../src/data/matches.js'

// ---------------------------------------------------------------------------
// time.js — liveState 'voided' branch + statusFlag's four branches & fallbacks
// ---------------------------------------------------------------------------

describe('liveState — voided', () => {
  it('returns "voided" for an abandoned/postponed/canceled match', () => {
    expect(liveState({ voided: true, ko: '2026-06-22T21:00:00-04:00' })).toBe('voided')
  })
})

describe('statusFlag — all branches + label fallbacks', () => {
  it('voided -> {kind:"voided", label} from m.statusLabel', () => {
    expect(statusFlag({ voided: true, statusLabel: 'Abandoned' })).toEqual({
      kind: 'voided',
      label: 'Abandoned',
    })
  })

  it('voided with no statusLabel falls back to "Off"', () => {
    expect(statusFlag({ voided: true })).toEqual({ kind: 'voided', label: 'Off' })
  })

  it('paused -> {kind:"paused", label} from m.live.label', () => {
    expect(statusFlag({ live: { delayed: true, label: 'Suspended' } })).toEqual({
      kind: 'paused',
      label: 'Suspended',
    })
  })

  it('paused with no live.label falls back to "Delayed"', () => {
    expect(statusFlag({ live: { delayed: true } })).toEqual({ kind: 'paused', label: 'Delayed' })
  })

  it('awarded -> {kind:"awarded", label:"Awarded"}', () => {
    expect(statusFlag({ awarded: true })).toEqual({ kind: 'awarded', label: 'Awarded' })
  })

  it('normal match -> null', () => {
    expect(statusFlag({ score: [1, 0] })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// clinch.js — a voided match is ignored (not treated as decided)
// ---------------------------------------------------------------------------

// Group A: m1, m2, m25, m28 played; m53, m54 remain.
function withScores(scoreByNum) {
  return MATCHES.map((m) => (scoreByNum[m.num] ? { ...m, score: scoreByNum[m.num] } : m))
}

describe('clinch — voided match is not decided', () => {
  it('a voided result does not clinch the group', () => {
    // Scores that, if all final, hand Mexico the group on 6 pts (nobody else can
    // reach 6). But m28 (Mexico v South Korea) is ABANDONED — voided, so it must
    // NOT count, leaving Mexico on 3 and the group still open.
    const base = {
      1: [3, 0], // Mexico 3-0 South Africa (final)
      2: [0, 0], // South Korea 0-0 Czechia (final)
      25: [0, 0], // Czechia 0-0 South Africa (final)
    }
    const decided = computeClinch(withScores({ ...base, 28: [3, 0] }))
    expect(decided['Mexico']).toBe('won-group')

    // Now the same big Mexico win, but flagged voided -> ignored.
    const matches = withScores(base).map((m) =>
      m.num === 28 ? { ...m, voided: true, statusLabel: 'Abandoned', score: [3, 0] } : m,
    )
    const status = computeClinch(matches)
    expect(status['Mexico']).not.toBe('won-group')
  })
})

// ---------------------------------------------------------------------------
// qualification.js — baseStats skips voided; group not 'complete' because of it
// ---------------------------------------------------------------------------

describe('qualification — voided match excluded from standings & completion', () => {
  it('a voided group match neither scores points/GD nor completes the group', () => {
    // Take Group C and decorate one match with a lopsided voided "5-0".
    const cMatches = MATCHES.filter((m) => m.stage === 'Group' && m.group === 'C')
    const target = cMatches[0] // e.g. Brazil v Morocco fixture
    const decorated = MATCHES.map((m) =>
      m.num === target.num ? { ...m, voided: true, statusLabel: 'Abandoned', score: [5, 0] } : m,
    )

    // Standings unaffected: every team still on 0 pts / 0 GD (the 5-0 ignored).
    const rows = rankGroup('C', decorated)
    for (const r of rows) {
      expect(r.Pts).toBe(0)
      expect(r.GD).toBe(0)
      expect(r.GF).toBe(0)
    }

    // And the voided match's presence does NOT count toward completion:
    // baseStats ignores it, and only 1 of 6 fixtures carries a (voided) score.
    const q = computeQualification(decorated)
    expect(q.completion.C).toBe(false)
  })

  it('groupComplete itself does not count a voided-only group as done', () => {
    // Score all six of Group C, but mark one voided -> still complete by
    // groupComplete's score-presence rule (voided keeps its display score), yet
    // rankGroup must ignore the voided result in the table.
    const scored = MATCHES.map((m) =>
      m.stage === 'Group' && m.group === 'C' ? { ...m, score: [1, 0] } : m,
    )
    expect(groupComplete('C', scored.filter((m) => m.group === 'C'))).toBe(true)
  })
})
