import { describe, it, expect } from 'vitest'
import { rankGroup, computeQualification } from '../src/utils/qualification.js'
import { MATCHES } from '../src/data/matches.js'

// Locks in the 2026 group-stage scoring assumption: a draw is 1 point each and a
// win is worth 3 — there is NO penalty-shootout bonus in the group stage (that's
// a knockout-only mechanic). If anyone ever wires a shootout into group scoring,
// this guard fails loudly.

function decorateGroupC(decorate) {
  return MATCHES.map((m) => {
    if (m.stage !== 'Group' || m.group !== 'C') return m
    return decorate(m) ?? m
  })
}

describe('group scoring guard — no shootout bonus in 2026 group stage', () => {
  it('a drawn group match gives both teams exactly 1 point', () => {
    const cFixtures = MATCHES.filter((m) => m.stage === 'Group' && m.group === 'C')
    const drawn = cFixtures[0] // a single fixture, played as a 1-1 draw
    const matches = decorateGroupC((m) =>
      m.num === drawn.num ? { ...m, score: [1, 1], pens: [4, 2] } : m,
    )
    const rows = rankGroup('C', matches)
    const a = rows.find((r) => r.name === drawn.t1)
    const b = rows.find((r) => r.name === drawn.t2)
    // Both drew -> 1 pt each. The pens:[4,2] (a fabricated shootout) is ignored.
    expect(a.Pts).toBe(1)
    expect(b.Pts).toBe(1)
    expect(a.D).toBe(1)
    expect(b.D).toBe(1)
  })

  it('a win is worth 3-0-style points (winner 3, loser 0)', () => {
    const cFixtures = MATCHES.filter((m) => m.stage === 'Group' && m.group === 'C')
    const won = cFixtures[0]
    const matches = decorateGroupC((m) => (m.num === won.num ? { ...m, score: [2, 0] } : m))
    const q = computeQualification(matches)
    const rows = q.groups.C
    const winner = rows.find((r) => r.name === won.t1)
    const loser = rows.find((r) => r.name === won.t2)
    expect(winner.Pts).toBe(3)
    expect(loser.Pts).toBe(0)
  })
})
