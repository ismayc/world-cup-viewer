import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { FINAL_GROUP_RESULTS } from './fixtures/final-group-results.js'
import { allAdvancementRequirements } from '../src/utils/eliminationCheck.js'

// Apply a { matchNum: [g1, g2] } map onto a clone of the real schedule.
function withScores(map) {
  return MATCHES.map((m) => (map[m.num] ? { ...m, score: map[m.num] } : m))
}

describe('allAdvancementRequirements — batch form (eliminationCheck 305-313)', () => {
  it('returns a { team -> requirements } map for the given teams', () => {
    // Group C complete (Scotland 3rd on 3 / −3); leave the rest to play so
    // advancement requirements are meaningful for the still-contending teams.
    const matches = withScores({ ...FINAL_GROUP_RESULTS.C.scores })
    const out = allAdvancementRequirements(matches, ['Scotland', 'Brazil'])
    expect(out).toBeTruthy()
    // At least one team yields a requirements object (req truthy → stored).
    const keys = Object.keys(out)
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) {
      expect(out[k].team).toBe(k)
      expect(out[k].profile).toBeTruthy()
    }
  })

  it('omits teams with no requirements (req falsy)', () => {
    // A made-up name is not on any roster → advancementRequirements returns null,
    // so the batch form skips it (exercises the `if (req)` false branch).
    const matches = withScores({ ...FINAL_GROUP_RESULTS.C.scores })
    const out = allAdvancementRequirements(matches, ['Scotland', 'Nobody FC'])
    expect('Nobody FC' in out).toBe(false)
  })
})
