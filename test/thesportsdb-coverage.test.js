import { describe, it, expect, vi } from 'vitest'
import { fetchBackup, sdbFinalScore, sdbFinalPens } from '../src/services/thesportsdb.js'
import { pairKey } from '../src/services/results.js'
import { MATCHES } from '../src/data/matches.js'

const match1 = MATCHES.find((m) => m.num === 1) // Mexico v South Africa

describe('fetchBackup (instant fallback + error branches)', () => {
  it('derives the instant from dateEvent + strTime when strTimestamp is absent', async () => {
    const feed = {
      events: [
        {
          strHomeTeam: 'Mexico',
          strAwayTeam: 'South Africa',
          intHomeScore: '2',
          intAwayScore: '1',
          strStatus: 'FT',
          dateEvent: '2026-06-11',
          strTime: '19:00:00',
        },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchBackup()
    const rec = map.get(pairKey('Mexico', 'South Africa'))
    expect(rec.instant).toBe(new Date('2026-06-11T19:00:00Z').getTime())
    expect(map.get('inst:' + rec.instant)).toBe(rec)
  })

  it('leaves instant null when there is no usable time, and skips it from the inst key', async () => {
    const feed = {
      events: [
        { strHomeTeam: 'Mexico', strAwayTeam: 'South Africa', intHomeScore: '2', intAwayScore: '1', strStatus: 'FT' },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchBackup()
    const rec = map.get(pairKey('Mexico', 'South Africa'))
    expect(rec.instant).toBeNull()
    expect([...map.keys()].some((k) => k.startsWith('inst:'))).toBe(false)
  })

  it('keeps a timestamp that already carries an offset/Z without re-appending', async () => {
    const feed = {
      events: [
        { strHomeTeam: 'Mexico', strAwayTeam: 'South Africa', intHomeScore: '2', intAwayScore: '1', strStatus: 'FT', strTimestamp: '2026-06-11T15:00:00-04:00' },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchBackup()
    const rec = map.get(pairKey('Mexico', 'South Africa'))
    expect(rec.instant).toBe(new Date('2026-06-11T15:00:00-04:00').getTime())
  })

  it('parses penalty tallies and skips events missing a team name', async () => {
    const feed = {
      events: [
        {
          strHomeTeam: 'Argentina',
          strAwayTeam: 'France',
          intHomeScore: '3',
          intAwayScore: '3',
          intHomeScorePenalties: '4',
          intAwayScorePenalties: '2',
          strStatus: 'PEN',
          strTimestamp: '2026-07-19T19:00:00Z',
        },
        { strHomeTeam: '', strAwayTeam: 'Nobody', intHomeScore: null, intAwayScore: null, strStatus: 'NS' },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => feed }))
    const map = await fetchBackup()
    const rec = map.get(pairKey('Argentina', 'France'))
    expect(rec.pens).toEqual([4, 2])
    expect(rec.final).toBe(true)
    // empty-named event is skipped
    expect([...map.keys()].some((k) => k.includes('Nobody'))).toBe(false)
  })

  it('handles a missing events array (defaults to [])', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    const map = await fetchBackup()
    expect(map.size).toBe(0)
  })

  it('throws when no day returns usable data (every day errors)', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad json')
      },
    }))
    await expect(fetchBackup()).rejects.toThrow(/Backup request failed/)
  })
})

describe('sdbFinalScore / sdbFinalPens (getters)', () => {
  it('sdbFinalScore returns null without a map', () => {
    expect(sdbFinalScore(match1, null)).toBeNull()
  })

  it('sdbFinalPens returns null unless finished with pens', () => {
    const noPens = new Map([
      [pairKey('Mexico', 'South Africa'), { home: 'Mexico', away: 'South Africa', final: true, score: [1, 1], pens: null }],
    ])
    expect(sdbFinalPens(match1, noPens)).toBeNull()

    const notFinal = new Map([
      [pairKey('Mexico', 'South Africa'), { home: 'Mexico', away: 'South Africa', final: false, score: [1, 1], pens: [4, 2] }],
    ])
    expect(sdbFinalPens(match1, notFinal)).toBeNull()

    const withPens = new Map([
      [pairKey('Mexico', 'South Africa'), { home: 'Mexico', away: 'South Africa', final: true, score: [1, 1], pens: [4, 2] }],
    ])
    expect(sdbFinalPens(match1, withPens)).toEqual({ home: 'Mexico', away: 'South Africa', ft: [4, 2] })
  })

  it('looks up a knockout match by instant when teams are placeholders', () => {
    const ko = MATCHES.find((m) => m.num === 73) // placeholder teams
    const inst = new Date(ko.ko).getTime()
    const map = new Map([
      ['inst:' + inst, { home: 'Spain', away: 'Morocco', final: true, score: [1, 0], pens: null }],
    ])
    expect(sdbFinalScore(ko, map)).toEqual({ home: 'Spain', away: 'Morocco', ft: [1, 0] })
  })
})
