import { describe, it, expect } from 'vitest'
import { rowStatus } from '../src/utils/qualification.js'

// rowStatus is pure: it consumes a row {rank,name} + a synthetic `qual`
// ({completion, allComplete, bestThirds}). Exercise every branch directly.
function qual({ complete = true, allComplete = false, bestThirds = [] } = {}) {
  return { completion: { A: complete }, allComplete, bestThirds: new Set(bestThirds) }
}

describe('rowStatus — every branch', () => {
  it('null while the group is still in progress', () => {
    expect(rowStatus({ rank: 1, name: 'X' }, 'A', qual({ complete: false }))).toBeNull()
  })

  it("'in' for the top two", () => {
    expect(rowStatus({ rank: 1, name: 'X' }, 'A', qual())).toBe('in')
    expect(rowStatus({ rank: 2, name: 'X' }, 'A', qual())).toBe('in')
  })

  it("'best3' for a provisional best-third (not all groups done)", () => {
    expect(rowStatus({ rank: 3, name: 'X' }, 'A', qual({ allComplete: false, bestThirds: ['X'] }))).toBe('best3')
  })

  it("'out3' for a third currently outside the best 8 (not all groups done)", () => {
    expect(rowStatus({ rank: 3, name: 'X' }, 'A', qual({ allComplete: false, bestThirds: [] }))).toBe('out3')
  })

  it("'in' for a confirmed best-third once all groups are complete", () => {
    expect(rowStatus({ rank: 3, name: 'X' }, 'A', qual({ allComplete: true, bestThirds: ['X'] }))).toBe('in')
  })

  it("'out' for a third missing the cut once all groups are complete", () => {
    expect(rowStatus({ rank: 3, name: 'X' }, 'A', qual({ allComplete: true, bestThirds: [] }))).toBe('out')
  })

  it("'out' for ranks below third", () => {
    expect(rowStatus({ rank: 4, name: 'X' }, 'A', qual())).toBe('out')
  })
})
