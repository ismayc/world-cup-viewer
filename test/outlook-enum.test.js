import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { enumerateOutlook, countRemaining, countIterations, R32_SLOT_LABELS } from '../src/utils/outlookEnum.js'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'

// Snapshot has Groups A/B/C/E/F done; the other seven on matchday 3. Complete
// every incomplete group EXCEPT D and G so the enumeration is small and fast while
// still exercising the cross-group third race over real goal differences.
const FILL = { 61: [1, 0], 62: [1, 0], 63: [1, 0], 64: [1, 0], 67: [1, 0], 68: [1, 0], 69: [1, 0], 70: [1, 0], 71: [1, 0], 72: [1, 0] }
const scored = { ...GROUP_STAGE_MD3, ...FILL }
const reduced = MATCHES.map((m) =>
  m.stage === 'Group' && scored[m.num] ? { ...m, score: scored[m.num] } : m,
)

// Fixed margin cap so the weighted space is deterministic: D and G each have two
// games left, so the space is (2·CAP+1)^4 equally-weighted margin combinations.
const CAP = 5
const SPACE = (2 * CAP + 1) ** 4 // 11^4 = 14641

describe('outlook enumeration (exact, goal-difference)', () => {
  it('reports the remaining-games count', () => {
    expect(countRemaining(reduced)).toBe(4) // D and G, two games each
    expect(countIterations(reduced)).toBeGreaterThan(0)
  })

  it('enumerates the full weighted margin space; every slot sums to the total', () => {
    const { total, cap, perMatch } = enumerateOutlook(reduced, null, CAP)
    expect(cap).toBe(CAP)
    expect(total).toBe(SPACE)
    for (const num of Object.keys(R32_SLOT_LABELS)) {
      for (const side of perMatch[num]) {
        const sum = side.candidates.reduce((s, c) => s + c.count, 0)
        expect(sum).toBe(total) // a fully-resolvable bracket fills every slot
      }
    }
  })

  it('locks a slot fed by a completed group (Winner Group A → Match 79)', () => {
    const { perMatch } = enumerateOutlook(reduced, null, CAP)
    // Group A is complete in the snapshot, so its winner fills Match 79 in 100%
    // of outcomes regardless of the remaining margins.
    expect(perMatch[79][0].locked).toBeTruthy()
  })

  it('gives exact rational shares and reports progress to completion', () => {
    let lastDone = 0
    let lastTotal = 0
    const { perMatch, total } = enumerateOutlook(
      reduced,
      (done, t) => {
        lastDone = done
        lastTotal = t
      },
      CAP,
    )
    expect(lastDone).toBe(lastTotal) // final progress callback fires at 100%
    // Every candidate share is an exact count/total fraction.
    for (const side of perMatch[88]) {
      for (const c of side.candidates) {
        expect(Number.isInteger(c.count)).toBe(true)
        expect(c.pct).toBeCloseTo(c.count / total, 12)
      }
    }
  })
})
