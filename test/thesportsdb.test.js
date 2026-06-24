import { describe, it, expect, vi } from 'vitest'
import { fetchBackup, sdbFinalScore } from '../src/services/thesportsdb.js'
import { pairKey } from '../src/services/results.js'
import { MATCHES } from '../src/data/matches.js'

const match1 = MATCHES.find((m) => m.num === 1) // Mexico v South Africa

const ev = ({ home, away, hs, as, status, ts }) => ({
  strHomeTeam: home,
  strAwayTeam: away,
  intHomeScore: hs,
  intAwayScore: as,
  strStatus: status,
  strTimestamp: ts,
})

describe('fetchBackup (parsing TheSportsDB shape)', () => {
  it('marks finished matches, parses UTC timestamps, and maps aliases', async () => {
    const feed = {
      events: [
        ev({ home: 'Mexico', away: 'South Africa', hs: '2', as: '1', status: 'FT', ts: '2026-06-11T19:00:00' }),
        // ESPN/SDB alias: "United States" -> "USA"; not started, no score.
        ev({ home: 'United States', away: 'Paraguay', hs: null, as: null, status: 'NS', ts: '2026-06-13T16:00:00' }),
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))

    const map = await fetchBackup()

    const done = map.get(pairKey('Mexico', 'South Africa'))
    expect(done.final).toBe(true)
    expect(done.score).toEqual([2, 1])
    // strTimestamp is UTC -> same instant as our -04:00 kickoff.
    expect(map.get('inst:' + new Date(match1.ko).getTime())).toBe(done)

    const ns = map.get(pairKey('USA', 'Paraguay'))
    expect(ns.final).toBe(false)
    expect(ns.score).toBeNull()
  })

  it('throws when no day in the window returns data (all non-OK)', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 }))
    await expect(fetchBackup()).rejects.toThrow(/Backup request failed/)
  })

  it('tolerates a partial failure — keeps the days that succeeded', async () => {
    const feed = {
      events: [
        { strHomeTeam: 'Mexico', strAwayTeam: 'South Africa', intHomeScore: '2', intAwayScore: '0', strStatus: 'FT', strTimestamp: '2026-06-11T19:00:00Z' },
      ],
    }
    let n = 0
    global.fetch = vi.fn(async () => {
      n += 1
      return n === 1 ? { ok: false, status: 500 } : { ok: true, json: async () => feed }
    })
    const map = await fetchBackup(undefined, ['2026-06-10', '2026-06-11', '2026-06-12'])
    expect(map.get(pairKey('Mexico', 'South Africa')).score).toEqual([2, 0])
  })
})

describe('sdbFinalScore (getter for the reconciler)', () => {
  it('returns an oriented final only when the source marks it finished', () => {
    const notFinal = new Map([
      [pairKey('Mexico', 'South Africa'), { home: 'Mexico', away: 'South Africa', final: false, score: [1, 0] }],
    ])
    expect(sdbFinalScore(match1, notFinal)).toBeNull()

    const final = new Map([
      [pairKey('Mexico', 'South Africa'), { home: 'Mexico', away: 'South Africa', final: true, score: [2, 1] }],
    ])
    expect(sdbFinalScore(match1, final)).toEqual({ home: 'Mexico', away: 'South Africa', ft: [2, 1] })
  })
})
