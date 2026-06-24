import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'
import { rankGroup } from '../src/utils/qualification.js'
import { computeClinch } from '../src/utils/clinch.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'
import { FINAL_GROUP_RESULTS, OFFICIAL_R32 } from './fixtures/final-group-results.js'

// As each group finishes, its verified final result is frozen in the fixture;
// this replays the locked scores through the ranking engine and asserts the
// official finishing order — so a tie-breaker regression can't quietly send the
// wrong team into the knockouts. Extend the fixture group-by-group as the stage
// completes (see test/fixtures/final-group-results.js).
describe('final group standings — locked against official results', () => {
  const groups = Object.entries(FINAL_GROUP_RESULTS)

  it('guards at least one verified group', () => {
    expect(groups.length).toBeGreaterThan(0)
  })

  for (const [group, rec] of groups) {
    it(`Group ${group} finishes in the official order (${rec.sources.join(', ')})`, () => {
      // The locked scores must reference exactly that group's six matches.
      const groupNums = MATCHES.filter((m) => m.stage === 'Group' && m.group === group)
        .map((m) => m.num)
        .sort((a, b) => a - b)
      expect(Object.keys(rec.scores).map(Number).sort((a, b) => a - b)).toEqual(groupNums)

      const matches = MATCHES.map((m) => (rec.scores[m.num] ? { ...m, score: rec.scores[m.num] } : m))
      expect(rankGroup(group, matches).map((r) => r.name)).toEqual(rec.order)
    })
  }
})

// The cross-group check the per-group order can't make: which eight thirds advance
// and which R32 tie each lands in (FIFA Annexe C). It activates only once all
// twelve groups are locked AND the official draw is filled in — dormant until the
// group stage ends, then it pins our resolved bracket to FIFA's published draw.
describe('R32 draw — locked against the official bracket', () => {
  const allGroups = Object.keys(TEAMS)
  const allLocked = allGroups.every((g) => FINAL_GROUP_RESULTS[g])

  it(allLocked ? 'resolves to the official R32 matchups' : 'is dormant until all 12 groups are locked', () => {
    if (!allLocked) {
      // Documents progress; add each group (and finally OFFICIAL_R32) as it finishes.
      expect(allGroups.filter((g) => FINAL_GROUP_RESULTS[g]).length).toBeLessThan(12)
      return
    }
    // All groups locked → the official draw MUST be filled, and our pipeline must
    // reproduce it exactly.
    expect(Object.keys(OFFICIAL_R32).length, 'fill OFFICIAL_R32 with FIFA’s draw').toBeGreaterThan(0)
    const scores = Object.assign({}, ...Object.values(FINAL_GROUP_RESULTS).map((r) => r.scores))
    const matches = MATCHES.map((m) => (scores[m.num] ? { ...m, score: scores[m.num] } : m))
    const resolved = resolveBracket(matches, computeClinch(matches))
    const byNum = Object.fromEntries(resolved.map((m) => [m.num, m]))
    for (const [num, pair] of Object.entries(OFFICIAL_R32)) {
      expect([byNum[num].t1, byNum[num].t2], `R32 match ${num}`).toEqual(pair)
    }
    // No placeholder slot survives once the group stage is complete.
    for (const m of resolved.filter((m) => m.stage === 'R32')) {
      expect(/Group|3rd|Match/.test(`${m.t1} ${m.t2}`), `unresolved R32 M${m.num}`).toBe(false)
    }
  })
})
