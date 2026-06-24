import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { rankGroup } from '../src/utils/qualification.js'
import { FINAL_GROUP_RESULTS } from './fixtures/final-group-results.js'

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
