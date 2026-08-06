import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'
import { projectKnockout, matchThirds } from '../src/utils/asItStands.js'

const GROUPS = Object.keys(TEAMS)

// A complete, strictly-ordered group stage so every group resolves cleanly.
function buildComplete() {
  const score = {}
  GROUPS.forEach((g, i) => {
    const idx = Object.fromEntries(TEAMS[g].map((t, k) => [t.name, k]))
    for (const m of MATCHES) {
      if (m.stage !== 'Group' || m.group !== g) continue
      const a = idx[m.t1]
      const b = idx[m.t2]
      const hi = Math.min(a, b)
      const lo = Math.max(a, b)
      const margin = hi === 2 && lo === 3 ? i + 1 : 1
      score[m.num] = a < b ? [margin, 0] : [0, margin]
    }
  })
  return MATCHES.map((m) => (score[m.num] ? { ...m, score: score[m.num] } : m))
}

describe('projectKnockout — parseSlot "other" + teamForSide null branch', () => {
  it('handles an R32 match with a non-standard slot label', () => {
    const complete = buildComplete()
    // Inject an R32 match whose t1 is an unrecognised slot ("other"): exercises
    // parseSlot's fallthrough and teamForSide returning null for that side.
    const custom = [
      ...complete,
      {
        num: 9999,
        stage: 'R32',
        t1: 'Mystery Slot',
        t2: '3rd A/B/C/D/F',
        venue: 'sofi',
        ko: '2026-06-29T16:30:00-04:00',
      },
    ]
    const { perGroup, official } = projectKnockout(custom)
    // The standard bracket still resolves officially from the Annexe C table.
    expect(official).toBe(true)
    // Every group still has its first/second projection.
    for (const g of GROUPS) {
      expect(perGroup[g]).toBeTruthy()
      expect(perGroup[g].first).toBeTruthy()
    }
  })

  it('reports the projection incomplete when a side has no opponent to name', () => {
    // An R32 tie drawn against a slot this bracket does not define: the group
    // side of it still projects, but there is nobody to project it against, so
    // the whole picture is flagged as not yet complete rather than being
    // presented as settled.
    const custom = [
      ...buildComplete(),
      {
        num: 9998,
        stage: 'R32',
        t1: 'Winner Group A',
        t2: 'Mystery Slot',
        venue: 'sofi',
        ko: '2026-06-29T16:30:00-04:00',
      },
      {
        num: 9997,
        stage: 'R32',
        t1: 'Runner-up Group B',
        t2: 'Mystery Slot',
        venue: 'sofi',
        ko: '2026-06-29T16:30:00-04:00',
      },
    ]
    const { perGroup, complete } = projectKnockout(custom)
    expect(complete).toBe(false)
    // The last side written for a group wins, so A's winner and B's runner-up
    // now point at the unnameable tie — with no opponent.
    expect(perGroup.A.first).toMatchObject({ matchNum: 9998, opponent: null })
    expect(perGroup.A.first.team).toBeTruthy()
    expect(perGroup.B.second).toMatchObject({ matchNum: 9997, opponent: null })
  })
})

describe('matchThirds — bipartite matching fallback', () => {
  // slot.groups lists which groups can fill each 3rd-place slot.
  const slot = (matchNum, groups) => ({ matchNum, slot: { type: 'third', groups } })

  it('assigns each group to a distinct admissible slot', () => {
    const slots = [slot(1, ['A', 'B']), slot(2, ['B', 'C'])]
    const map = matchThirds(['A', 'B'], slots)
    // A can only fit slot 1; B then takes slot 2 — every group placed once.
    const assigned = [...map.values()]
    expect(new Set(assigned).size).toBe(assigned.length)
    expect(assigned.sort()).toEqual(['A', 'B'])
  })

  it('exercises the augmenting-path re-assignment (Kuhn’s)', () => {
    // Both first groups want slot 1; matching the third forces a re-assignment
    // through the recursive assign() call.
    const slots = [slot(1, ['A', 'B', 'C']), slot(2, ['A']), slot(3, ['B'])]
    const map = matchThirds(['A', 'B', 'C'], slots)
    const assigned = [...map.values()].sort()
    expect(assigned).toEqual(['A', 'B', 'C'])
  })

  it('leaves a group unplaced when no admissible slot remains', () => {
    const slots = [slot(1, ['A'])]
    const map = matchThirds(['A', 'B'], slots)
    // Only one slot; B has nowhere to go (assign returns false for it).
    expect([...map.values()]).toEqual(['A'])
  })
})

describe('projectKnockout — incomplete data still produces a bracket', () => {
  it('projects from blank standings without throwing', () => {
    const { perGroup, complete } = projectKnockout(MATCHES)
    expect(typeof complete).toBe('boolean')
    expect(Object.keys(perGroup)).toHaveLength(GROUPS.length)
  })
})
