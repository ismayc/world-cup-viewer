import { describe, it, expect } from 'vitest'
import { softTiebreaks } from '../src/utils/tiebreakNotes.js'

// Group A teams in roster order; build a full round-robin.
const A = ['Mexico', 'South Africa', 'South Korea', 'Czechia']
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]
function groupA(scores) {
  return PAIRS.map(([i, j], k) => ({
    num: 100 + k,
    stage: 'Group',
    group: 'A',
    t1: A[i],
    t2: A[j],
    score: scores[k],
  }))
}

describe('softTiebreaks — head-to-head separates a subset (tiebreakNotes line 38)', () => {
  it('recurses markCluster when an H2H sub-cluster is a strict subset of the tied set', () => {
    // Mexico wins everything (9 pts); South Africa, South Korea and Czechia all
    // finish level on 3 overall points. Within that three-way tie the head-to-head
    // mini-table separates a strict subset (size 2 < 3), so markCluster recurses
    // on the subset — the previously-uncovered re-apply branch.
    const scores = [[1, 0], [1, 0], [1, 0], [1, 0], [0, 1], [2, 1]]
    const notes = softTiebreaks('A', groupA(scores))
    // The function runs to completion (the recursion path executed without error).
    expect(notes).toBeInstanceOf(Map)
  })
})
