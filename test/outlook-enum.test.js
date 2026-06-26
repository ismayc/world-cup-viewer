import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { enumerateOutlook, countRemaining, totalOutcomes, R32_SLOT_LABELS } from '../src/utils/outlookEnum.js'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'

// Snapshot has Groups A/B/C/E/F done; the other seven on matchday 3. Complete
// every incomplete group EXCEPT D and G so the enumeration is tiny (3^4 = 81)
// and the test runs instantly while still exercising the cross-group third race.
const FILL = { 61: [1, 0], 62: [1, 0], 63: [1, 0], 64: [1, 0], 67: [1, 0], 68: [1, 0], 69: [1, 0], 70: [1, 0], 71: [1, 0], 72: [1, 0] }
const scored = { ...GROUP_STAGE_MD3, ...FILL }
const reduced = MATCHES.map((m) =>
  m.stage === 'Group' && scored[m.num] ? { ...m, score: scored[m.num] } : m,
)

describe('outlook enumeration (exact)', () => {
  it('reports the remaining-games count and outcome space', () => {
    expect(countRemaining(reduced)).toBe(4) // D and G, two games each
    expect(totalOutcomes(reduced)).toBe(81) // 3^4
  })

  it('enumerates exactly 3^remaining combinations and every slot sums to the total', () => {
    const { total, perMatch } = enumerateOutlook(reduced)
    expect(total).toBe(81)
    for (const num of Object.keys(R32_SLOT_LABELS)) {
      for (const side of perMatch[num]) {
        const sum = side.candidates.reduce((s, c) => s + c.count, 0)
        expect(sum).toBe(total) // a fully-completed group stage resolves every slot
      }
    }
  })

  it('locks a forced slot at 100% (USA always wins Group D → Match 81)', () => {
    const { perMatch } = enumerateOutlook(reduced)
    expect(perMatch[81][0].locked).toBe('USA')
  })

  it('gives exact proportions and reports progress', () => {
    let lastDone = 0
    const { perMatch, total } = enumerateOutlook(reduced, (done, t) => {
      lastDone = done
      expect(t).toBe(81)
    })
    expect(lastDone).toBe(total) // final progress callback fires at 100%
    // Every candidate share is an exact n/81 fraction.
    for (const c of perMatch[88][0].candidates) {
      expect(Number.isInteger(c.pct * 81)).toBe(true)
    }
  })

  it('reports the full 4,782,969-combination space at a complete matchday', () => {
    const snapshot = MATCHES.map((m) =>
      m.stage === 'Group' && GROUP_STAGE_MD3[m.num] ? { ...m, score: GROUP_STAGE_MD3[m.num] } : m,
    )
    expect(countRemaining(snapshot)).toBe(14)
    expect(totalOutcomes(snapshot)).toBe(4782969)
  })
})
