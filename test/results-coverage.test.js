import { describe, it, expect, vi } from 'vitest'
import {
  applyResults,
  matchKey,
  openFootballFinalScore,
  fetchResults,
  isRealTeam,
  pairKey,
} from '../src/services/results.js'
import { MATCHES } from '../src/data/matches.js'

const match1 = MATCHES.find((m) => m.num === 1) // Mexico v South Africa

describe('openFootballFinalScore (getter for the reconciler)', () => {
  it('returns null when there is no map', () => {
    expect(openFootballFinalScore(match1, null)).toBeNull()
  })

  it('returns null when the record has no final score', () => {
    const map = new Map([[pairKey('Mexico', 'South Africa'), { home: 'Mexico', away: 'South Africa', score: null }]])
    expect(openFootballFinalScore(match1, map)).toBeNull()
  })

  it('returns an oriented final when the record has a ft score', () => {
    const map = new Map([
      [pairKey('Mexico', 'South Africa'), { home: 'Mexico', away: 'South Africa', score: { ft: [2, 1] } }],
    ])
    expect(openFootballFinalScore(match1, map)).toEqual({ home: 'Mexico', away: 'South Africa', ft: [2, 1] })
  })
})

describe('fetchResults (goal parsing + error branches)', () => {
  it('parses goals (player/offset/penalty/owngoal) for both teams', async () => {
    const feed = {
      matches: [
        {
          round: 'Matchday 1',
          team1: 'Mexico',
          team2: 'South Africa',
          score: { ft: [1, 1] },
          goals1: [{ player: 'Scorer One', offset: 23, penalty: true }],
          goals2: [{ name: 'Scorer Two', minute: 67, owngoal: true }],
        },
        // goals not an array -> parseGoals returns []
        { round: 'Matchday 1', team1: 'Spain', team2: 'Morocco', score: { ft: [0, 0] }, goals1: null },
        // apiKey returns null (no num, not a known round) -> skipped
        { round: 'Unknown Round', team1: 'X', team2: 'Y' },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))

    const map = await fetchResults()
    const rec = map.get(pairKey('Mexico', 'South Africa'))
    expect(rec.g1).toEqual([{ name: 'Scorer One', minute: 23, penalty: true, og: false }])
    expect(rec.g2).toEqual([{ name: 'Scorer Two', minute: 67, penalty: false, og: true }])

    const spain = map.get(pairKey('Spain', 'Morocco'))
    expect(spain.g1).toEqual([])

    expect(map.has('pair:' + ['X', 'Y'].sort().join('|'))).toBe(false)
  })

  it('keys the third-place play-off and the final by stage, not by pairing', async () => {
    // Both are keyed by stage because their teams are not known until the
    // semi-finals resolve, so a pair key would not match the committed board.
    const feed = {
      matches: [
        { round: 'Match for third place', team1: 'Alpha', team2: 'Beta', score: { ft: [2, 1] } },
        { round: 'Final', team1: 'Gamma', team2: 'Delta', score: { ft: [1, 0] } },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchResults()
    expect(map.get('stage:3rd')?.score?.ft).toEqual([2, 1])
    expect(map.get('stage:Final')?.score?.ft).toEqual([1, 0])
  })

  it('handles a goal with no name/minute (empty-name, null minute defaults)', async () => {
    const feed = {
      matches: [
        { round: 'Matchday 1', team1: 'Mexico', team2: 'South Africa', score: { ft: [1, 0] }, goals1: [{}] },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchResults()
    expect(map.get(pairKey('Mexico', 'South Africa')).g1).toEqual([
      { name: '', minute: null, penalty: false, og: false },
    ])
  })

  it('throws when the body is not valid JSON', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad json')
      },
    }))
    await expect(fetchResults()).rejects.toThrow(/not valid JSON/)
  })

  it('throws when matches[] is missing', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ notMatches: [] }) }))
    await expect(fetchResults()).rejects.toThrow(/missing a matches/)
  })

  it('parses a bare-array score (score is itself the ft pair)', async () => {
    const feed = {
      matches: [{ round: 'Matchday 1', team1: 'Mexico', team2: 'South Africa', score: [3, 2] }],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchResults()
    expect(map.get(pairKey('Mexico', 'South Africa')).score.ft).toEqual([3, 2])
  })

  it('treats an incomplete ft (null element) as no score', async () => {
    const feed = {
      matches: [{ round: 'Matchday 1', team1: 'Mexico', team2: 'South Africa', score: { ft: [1, null] } }],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchResults()
    expect(map.get(pairKey('Mexico', 'South Africa')).score).toBeNull()
  })
})

describe('isRealTeam', () => {
  it('false for placeholders, true for qualified sides', () => {
    expect(isRealTeam('2A')).toBe(false)
    expect(isRealTeam('Mexico')).toBe(true)
  })
})

describe('a record with no result in it', () => {
  it('leaves a group match alone when the record carries no score', () => {
    // A fixture line with no result yet: the record exists (so the teams are
    // known) but writing it back would blank the board rather than fill it.
    const base = { num: 1, stage: 'Group', group: 'A', t1: 'Alpha', t2: 'Beta', ko: '2024-06-14T19:00:00Z' }
    const map = new Map([[matchKey(base), { home: 'Alpha', away: 'Beta' }]])
    const [out] = applyResults([base], map)
    expect(out).toBe(base)
  })
})
