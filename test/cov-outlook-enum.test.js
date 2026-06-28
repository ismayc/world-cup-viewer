import { describe, it, expect } from 'vitest'
import { countIterations } from '../src/utils/outlookEnum.js'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'

const GROUPS = Object.keys(TEAMS)

describe('outlookEnum — chooseCaps fallback', () => {
  it('returns the floor-cap result when every cap overflows MAX_ITERS', () => {
    // Leave the last game of EVERY group unplayed (fill the rest). One open game
    // per group keeps the per-group enumeration tiny, but the cross-group product
    // of distinct outcomes still exceeds MAX_ITERS (12M) at every cap — so
    // chooseCaps walks each cap from the base down to 3 without an early return and
    // falls through to `return last`. countIterations surfaces that floor count.
    const openNums = new Set()
    for (const g of GROUPS) {
      const nums = MATCHES.filter((m) => m.stage === 'Group' && m.group === g)
        .map((m) => m.num)
        .sort((a, b) => a - b)
      openNums.add(nums[nums.length - 1]) // last game of the group stays open
    }
    const matches = MATCHES.map((m) =>
      m.stage === 'Group' && !openNums.has(m.num) ? { ...m, score: [1, 0] } : m,
    )
    const iters = countIterations(matches)
    expect(iters).toBeGreaterThan(12_000_000)
  })
})
