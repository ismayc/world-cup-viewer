import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parseSummary, fetchMatchLines } from '../src/services/espnMatchStats.js'
import { applyLive } from '../src/services/espn.js'
import { pairKey } from '../src/services/results.js'

const sub = (minute, ...names) => ({
  type: { text: 'Substitution' },
  clock: { value: minute * 60, displayValue: `${minute}'` },
  participants: names.map((n) => ({ athlete: { displayName: n } })),
})
const roster = (entries) => ({ roster: entries.map((e) => ({
  athlete: { displayName: e.name },
  starter: Boolean(e.starter),
  subbedIn: Boolean(e.subbedIn),
  subbedOut: Boolean(e.subbedOut),
  stats: [{ name: 'goalAssists', value: e.assists ?? 0 }],
})) })

const summaryDoc = {
  keyEvents: [
    { type: { text: 'Kickoff' }, clock: { value: 0 } },
    sub(60, 'Super Sub', 'Tired Starter'),
  ],
  rosters: [
    roster([
      { name: 'Full Ninety', starter: true, assists: 2 },
      { name: 'Tired Starter', starter: true, subbedOut: true },
      { name: 'Super Sub', subbedIn: true, assists: 1 },
      { name: 'Bench Warmer' },
    ]),
  ],
}

describe('parseSummary', () => {
  it('derives minutes from starts and substitutions, and reads per-match assists', () => {
    const { length, byName } = parseSummary(summaryDoc)
    expect(length).toBe(90)
    expect(byName['full ninety']).toMatchObject({ played: true, minutes: 90, assists: 2 })
    expect(byName['tired starter']).toMatchObject({ played: true, minutes: 60 })
    expect(byName['super sub']).toMatchObject({ played: true, minutes: 30, assists: 1 })
    expect(byName['bench warmer']).toMatchObject({ played: false, minutes: 0 })
  })

  it('uses a 120-minute length when the key events show extra time', () => {
    const et = {
      ...summaryDoc,
      keyEvents: [...summaryDoc.keyEvents, { type: { text: 'End Extra Time' }, clock: { value: 7200 } }],
    }
    const { length, byName } = parseSummary(et)
    expect(length).toBe(120)
    expect(byName['full ninety'].minutes).toBe(120)
    expect(byName['super sub'].minutes).toBe(60)
  })
})

describe('fetchMatchLines', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('fetches, parses, and caches a FINAL match; live always refetches', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => summaryDoc }))
    vi.stubGlobal('fetch', f)
    const first = await fetchMatchLines('760512', { final: true })
    expect(first.byName['super sub'].minutes).toBe(30)
    await fetchMatchLines('760512', { final: true })
    expect(f).toHaveBeenCalledTimes(1) // cached
    await fetchMatchLines('760512', { final: false })
    expect(f).toHaveBeenCalledTimes(2) // live → fresh
  })

  it('rejects without an event id', async () => {
    await expect(fetchMatchLines(null)).rejects.toThrow(/event id/)
  })
})

describe('applyLive carries the ESPN event id onto merged matches', () => {
  const rec = {
    id: '760512',
    home: 'Brazil',
    away: 'Ghana',
    state: 'post',
    score: [2, 0],
    goals: { home: [], away: [] },
    cards: { home: [{ name: 'X', minute: 3, color: 'yellow' }], away: [] },
    subs: { home: [], away: [] },
    clock: 'FT',
    detail: 'Full Time',
  }
  const liveMap = new Map([[pairKey('Brazil', 'Ghana'), rec]])
  const base = { num: 1, stage: 'Group', group: 'A', t1: 'Brazil', t2: 'Ghana', ko: '2026-06-12T15:00:00-04:00' }

  it('on the live/post overlay branch', () => {
    const [m] = applyLive([base], liveMap)
    expect(m.espnId).toBe('760512')
    expect(m.score).toEqual([2, 0])
  })

  it('on the OpenFootball-already-scored branch', () => {
    const [m] = applyLive([{ ...base, score: [2, 0] }], liveMap)
    expect(m.espnId).toBe('760512')
  })
})
