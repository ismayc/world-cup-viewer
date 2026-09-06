import { describe, it, expect } from 'vitest'
import { parseQuery, matchesSearch } from '../src/utils/search.js'
import { STAGE_ORDER, STAGE_LABELS } from '../src/data/matches.js'

// The stage synonym table is a hand-written map that gets copied between viewers
// whose knockout shapes differ. When a stage is added to STAGE_ORDER and no
// synonym is written for it, `stage:` searches for it silently match nothing:
// matchStage falls back to a substring test against the label, and "round of 16"
// does not contain "r16". Nothing else in the suite notices, because the stage
// still renders everywhere. These assertions tie the table to STAGE_ORDER.
const VENUE = { name: 'Stadium', city: 'City', country: 'Country', region: 'Region' }
const matchIn = (stage) => ({ t1: 'Alpha', t2: 'Beta', stage, group: null })

describe('stage search covers this tournament', () => {
  it('finds every stage by its own code', () => {
    for (const stage of STAGE_ORDER) {
      const parsed = parseQuery(`stage: ${stage.toLowerCase()}`)
      expect(
        matchesSearch(matchIn(stage), VENUE, parsed),
        `stage:${stage.toLowerCase()} does not find a ${stage} match`,
      ).toBe(true)
    }
  })

  it('finds every stage by its full label', () => {
    for (const stage of STAGE_ORDER) {
      const parsed = parseQuery(`stage: ${STAGE_LABELS[stage].toLowerCase()}`)
      expect(matchesSearch(matchIn(stage), VENUE, parsed), `label search fails for ${stage}`).toBe(
        true,
      )
    }
  })

  it('resolves a stage code to exactly one stage', () => {
    // A synonym pointing at a stage this tournament does not run would match
    // nothing at all, which reads to the user as "no results" rather than as a bug.
    for (const stage of STAGE_ORDER) {
      const parsed = parseQuery(`stage: ${stage.toLowerCase()}`)
      const hits = STAGE_ORDER.filter((s) => matchesSearch(matchIn(s), VENUE, parsed))
      expect(hits, `stage:${stage.toLowerCase()} is ambiguous`).toEqual([stage])
    }
  })
})
