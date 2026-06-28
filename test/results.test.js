import { describe, it, expect, vi } from 'vitest'
import { applyResults, matchKey, fetchResults } from '../src/services/results.js'
import { MATCHES } from '../src/data/matches.js'

describe('results merge (applyResults)', () => {
  it('returns the input unchanged when there are no results', () => {
    expect(applyResults(MATCHES, null)).toBe(MATCHES)
    expect(applyResults(MATCHES, new Map())).toBe(MATCHES)
  })

  it('keys group matches by team pair, knockout by num, final by stage', () => {
    const group1 = MATCHES.find((m) => m.num === 1)
    expect(matchKey(group1)).toBe('pair:' + ['Mexico', 'South Africa'].sort().join('|'))
    expect(matchKey(MATCHES.find((m) => m.num === 73))).toBe('num:73')
    expect(matchKey(MATCHES.find((m) => m.stage === 'Final'))).toBe('stage:Final')
    expect(matchKey(MATCHES.find((m) => m.stage === '3rd'))).toBe('stage:3rd')
  })

  it('merges a group score oriented to our team order', () => {
    const map = new Map([
      ['pair:' + ['Mexico', 'South Africa'].sort().join('|'), {
        home: 'South Africa', away: 'Mexico', score: { ft: [0, 2] },
      }],
    ])
    const merged = applyResults(MATCHES, map)
    const m = merged.find((x) => x.num === 1) // our order: Mexico vs South Africa
    expect(m.score).toEqual([2, 0]) // flipped to match (Mexico, South Africa)
  })

  it('does NOT write a reversed score when the record home matches neither team', () => {
    // A normalization gap could leave rec.home as a name that's neither of ours.
    // The old bare-equality orientation would treat it as the away team and write
    // the score backwards; it must skip instead.
    const map = new Map([
      ['pair:' + ['Mexico', 'South Africa'].sort().join('|'), {
        home: 'Mexiko', away: 'Sudafrica', score: { ft: [3, 1] }, // mis-spelled → unmatched
      }],
    ])
    const merged = applyResults(MATCHES, map)
    expect(merged.find((m) => m.num === 1).score).toBeUndefined() // skipped, not reversed
  })

  it('resolves knockout placeholders to real teams and records pens/AET', () => {
    // Map values hold already-parsed scores ({ ft, pens, aet }).
    const map = new Map([
      ['stage:Final', { home: 'Argentina', away: 'France', score: { ft: [2, 2], pens: [4, 2], aet: true } }],
    ])
    const merged = applyResults(MATCHES, map)
    const final = merged.find((m) => m.stage === 'Final')
    expect(final.t1).toBe('Argentina')
    expect(final.t2).toBe('France')
    expect(final.score).toEqual([2, 2])
    expect(final.pens).toEqual([4, 2])
    expect(final.aet).toBe(true)
  })

  it('uses the extra-time score for a knockout decided in ET (no shootout)', () => {
    // OpenFootball reports ft = level 90-min score and et = the decisive ET score.
    // Using ft alone would leave the tie (and the rest of the bracket) unresolved.
    const map = new Map([
      ['stage:Final', { home: 'Argentina', away: 'France', score: { ft: [1, 1], et: [2, 1], aet: true } }],
    ])
    const merged = applyResults(MATCHES, map)
    const final = merged.find((m) => m.stage === 'Final')
    expect(final.score).toEqual([2, 1]) // ET result, not the level 90-min score
    expect(final.aet).toBe(true)
    expect(final.pens).toBeUndefined()
  })

  it('does not mutate the static MATCHES array', () => {
    const before = MATCHES.find((m) => m.num === 1)
    const map = new Map([
      ['pair:' + ['Mexico', 'South Africa'].sort().join('|'), {
        home: 'Mexico', away: 'South Africa', score: { ft: [1, 0] },
      }],
    ])
    applyResults(MATCHES, map)
    expect(MATCHES.find((m) => m.num === 1)).toBe(before)
    expect(before.score).toBeUndefined()
  })
})

describe('fetchResults (parsing OpenFootball shape)', () => {
  it('parses scores, pens/AET, and normalizes team-name aliases', async () => {
    const feed = {
      matches: [
        { round: 'Matchday 1', team1: 'Mexico', team2: 'South Africa', score: { ft: [2, 1] } },
        { round: 'Round of 32', num: 73, team1: 'Spain', team2: 'Morocco', score: { ft: [1, 1], et: [1, 1], p: [4, 2] } },
        { round: 'Round of 16', num: 89, team1: 'Croatia', team2: 'Japan', score: { ft: [1, 1], et: [2, 1] } }, // won in ET, no shootout
        { round: 'Matchday 1', team1: 'South Korea', team2: 'Czech Republic' }, // alias, no score
        { round: 'Final', team1: 'W101', team2: 'W102' }, // unplayed placeholder
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))

    const map = await fetchResults()

    const group = map.get('pair:' + ['Mexico', 'South Africa'].sort().join('|'))
    expect(group.score.ft).toEqual([2, 1])

    const r32 = map.get('num:73')
    expect(r32.score.ft).toEqual([1, 1])
    expect(r32.score.et).toEqual([1, 1]) // level after ET → went to the shootout
    expect(r32.score.pens).toEqual([4, 2])
    expect(r32.score.aet).toBe(true)

    const r16 = map.get('num:89')
    expect(r16.score.et).toEqual([2, 1]) // decided in ET, no shootout
    expect(r16.score.aet).toBe(true)
    expect(r16.score.pens).toBeUndefined()

    // "Czech Republic" normalized to "Czechia"; unplayed match has null score.
    const alias = map.get('pair:' + ['South Korea', 'Czechia'].sort().join('|'))
    expect(alias.score).toBeNull()

    expect(map.get('stage:Final').score).toBeNull()
  })

  it('throws on a non-OK response', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 }))
    await expect(fetchResults()).rejects.toThrow(/503/)
  })
})
