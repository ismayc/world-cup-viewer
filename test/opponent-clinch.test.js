import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { lockedOpponent, reachableThirdSets } from '../src/utils/opponentClinch.js'
import { computeClinch } from '../src/utils/clinch.js'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'

// A real group-stage snapshot: all 6 of Groups A/B/C/E/F played, every other
// group on its final matchday (2 games left). Captured from the live feed so the
// cross-group third-place math is exercised against an authentic configuration.
const snapshot = MATCHES.map((m) =>
  m.stage === 'Group' && GROUP_STAGE_MD3[m.num] ? { ...m, score: GROUP_STAGE_MD3[m.num] } : m,
)

describe('lockedOpponent — knockout opponent clinch', () => {
  const clinch = computeClinch(snapshot)

  it('locks USA vs Bosnia even though 7 groups are still playing', () => {
    // USA win Group D is clinched; Bosnia is the Group-B third assigned to the
    // Winner-D slot (Match 81) in EVERY reachable best-thirds combination.
    expect(lockedOpponent(snapshot, 'USA', clinch)).toEqual({
      opponent: 'Bosnia & Herzegovina',
      matchNum: 81,
    })
  })

  it('locks a runner-up vs runner-up tie once both groups finish', () => {
    // Canada (runner-up B) vs runner-up A, Match 73 — independent of the thirds.
    const r = lockedOpponent(snapshot, 'Canada', clinch)
    expect(r?.matchNum).toBe(73)
    expect(r?.opponent).toBe('South Africa')
  })

  it('does NOT lock a winner whose opponent is an unresolved third', () => {
    // Switzerland won Group B, but its Winner-B slot faces a third that is not
    // yet pinned, so the opponent stays provisional.
    expect(lockedOpponent(snapshot, 'Switzerland', clinch)).toBeNull()
  })

  it('every still-reachable best-thirds combination keeps Bosnia in the pool', () => {
    const sets = reachableThirdSets(snapshot)
    expect(sets.length).toBeGreaterThan(0)
    expect(sets.every((key) => key.includes('B'))).toBe(true)
  })

  it('locks nothing before the tournament starts', () => {
    expect(lockedOpponent(MATCHES, 'USA')).toBeNull()
    expect(reachableThirdSets(MATCHES).length).toBeGreaterThan(1)
  })
})
