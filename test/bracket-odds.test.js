import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { simulateR32, resolveR32Slots, R32_SLOT_LABELS } from '../src/utils/bracketOdds.js'
import { computeQualification } from '../src/utils/qualification.js'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'

const snapshot = MATCHES.map((m) =>
  m.stage === 'Group' && GROUP_STAGE_MD3[m.num] ? { ...m, score: GROUP_STAGE_MD3[m.num] } : m,
)

// Deterministic RNG (mulberry32) so the simulation is reproducible in tests.
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('bracket odds', () => {
  it('resolves every R32 slot from a complete qualification picture', () => {
    // Build a fully-played group stage (fill the remaining games arbitrarily).
    const done = snapshot.map((m) =>
      m.stage === 'Group' && !Array.isArray(m.score) ? { ...m, score: [1, 0] } : m,
    )
    const slots = resolveR32Slots(computeQualification(done))
    // Every R32 match has two real teams once the groups are complete.
    for (const num of Object.keys(R32_SLOT_LABELS)) {
      expect(slots[num][0]).toBeTruthy()
      expect(slots[num][1]).toBeTruthy()
    }
  })

  it('locks mathematically-fixed spots at 100% and spreads open ones', () => {
    const { runs, perMatch } = simulateR32(snapshot, { runs: 4000, rng: seeded(42) })
    expect(runs).toBe(4000)

    // Match 81: USA (Winner D) vs Bosnia (3rd) — both mathematically locked.
    const [d, third] = perMatch[81]
    expect(d.locked).toBe('USA')
    expect(third.locked).toBe('Bosnia & Herzegovina')

    // Match 88: Runner-up D vs Runner-up G — both groups open, so neither locks
    // and each side's candidate shares sum to ~100%.
    const [ruD, ruG] = perMatch[88]
    expect(ruD.locked).toBeNull()
    expect(ruG.candidates.length).toBeGreaterThan(1)
    const sum = ruG.candidates.reduce((s, c) => s + c.pct, 0)
    expect(sum).toBeGreaterThan(0.99)
    expect(sum).toBeLessThanOrEqual(1.0001)
  })

  it('is deterministic for a fixed seed', () => {
    const a = simulateR32(snapshot, { runs: 1500, rng: seeded(7) })
    const b = simulateR32(snapshot, { runs: 1500, rng: seeded(7) })
    expect(a.perMatch[88][0].candidates).toEqual(b.perMatch[88][0].candidates)
  })

  it('does not mutate the input matches', () => {
    const before = MATCHES.find((m) => m.num === 59)
    simulateR32(snapshot, { runs: 200, rng: seeded(1) })
    expect(before.score).toBeUndefined()
  })
})
