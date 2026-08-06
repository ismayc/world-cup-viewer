import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchBootExtras, fetchRecentPlayerStats, LEADERS_SOURCE, CACHE_TTL_MS } from '../src/services/espnStats.js'
import { nameKey } from '../src/utils/tournamentStats.js'

// Minimal core-API documents. $refs are deliberately http:// (as ESPN serves
// them) to prove the https rewrite happens.
const CORE = 'sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/seasons/2026'
const leadersDoc = {
  categories: [
    {
      name: 'goalsLeaders',
      leaders: [
        { athlete: { $ref: `http://${CORE}/athletes/45843?lang=en` } },
        { athlete: { $ref: `http://${CORE}/athletes/286831?lang=en` } },
      ],
    },
    {
      name: 'assistsLeaders',
      // 286831 repeats — the id set must dedupe it.
      leaders: [{ athlete: { $ref: `http://${CORE}/athletes/286831?lang=en` } }],
    },
  ],
}
const athleteDoc = {
  45843: { displayName: 'Lionel Messi' },
  286831: { displayName: 'Kylian Mbappé' },
}
const statsDoc = (goals, assists, minutes) => ({
  splits: {
    categories: [
      { name: 'general', stats: [{ name: 'minutes', value: minutes }] },
      { name: 'offensive', stats: [{ name: 'totalGoals', value: goals }, { name: 'goalAssists', value: assists }] },
    ],
  },
})

function mockFetch() {
  return vi.fn(async (url) => {
    expect(url.startsWith('https://')).toBe(true) // never mixed-content http
    let body
    if (url.includes('/leaders')) body = leadersDoc
    else if (/athletes\/(\d+)\/statistics/.test(url)) {
      body = url.includes('45843') ? statsDoc(8, 2, 530) : statsDoc(8, 4, 540)
    } else {
      const id = /athletes\/(\d+)/.exec(url)[1]
      body = athleteDoc[id]
    }
    return { ok: true, json: async () => body }
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('fetchBootExtras', () => {
  it('resolves names + goals/assists/minutes for the deduped leader set', async () => {
    const f = mockFetch()
    vi.stubGlobal('fetch', f)
    const extras = await fetchBootExtras()
    expect(extras).toHaveLength(2)
    expect(extras).toContainEqual({ name: 'Lionel Messi', goals: 8, assists: 2, minutes: 530 })
    expect(extras).toContainEqual({ name: 'Kylian Mbappé', goals: 8, assists: 4, minutes: 540 })
    // 1 leaders + 2 athletes × (athlete + statistics) = 5 requests, not 7.
    expect(f).toHaveBeenCalledTimes(5)
  })

  it('serves from the localStorage cache within the TTL', async () => {
    const f = mockFetch()
    vi.stubGlobal('fetch', f)
    await fetchBootExtras()
    const again = await fetchBootExtras()
    expect(f).toHaveBeenCalledTimes(5) // no new requests
    expect(again).toHaveLength(2)
    // …and refetches once the cache is stale.
    const c = JSON.parse(localStorage.getItem('wc2026:bootExtras'))
    localStorage.setItem('wc2026:bootExtras', JSON.stringify({ ...c, at: Date.now() - CACHE_TTL_MS - 1 }))
    await fetchBootExtras()
    expect(f.mock.calls.length).toBeGreaterThan(5)
  })

  it('force bypasses the freshness cache but reuses cached athlete names', async () => {
    const f = mockFetch()
    vi.stubGlobal('fetch', f)
    await fetchBootExtras() // 5 requests; names now cached permanently
    const forced = await fetchBootExtras(undefined, { force: true })
    expect(forced).toHaveLength(2)
    // Forced refresh = leaders + one statistics doc per athlete (no athlete
    // name lookups): 5 + 3 = 8 total.
    expect(f).toHaveBeenCalledTimes(8)
    const urls = f.mock.calls.slice(5).map(([u]) => u)
    expect(urls.filter((u) => /athletes\/\d+\?/.test(u))).toHaveLength(0)
    expect(urls.filter((u) => /statistics/.test(u))).toHaveLength(2)
  })

  it('drops an athlete whose lookups fail without sinking the rest', async () => {
    const f = mockFetch()
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.includes('286831')) return { ok: false, status: 500 }
      return f(url)
    }))
    const extras = await fetchBootExtras()
    expect(extras).toHaveLength(1)
    expect(extras[0].name).toBe('Lionel Messi')
  })

  it('drops an athlete the feed will not name', async () => {
    // A leader whose athlete document comes back without a display name has
    // nothing to key the boot table by, so the row is dropped rather than shown
    // as a blank line beside a goal tally.
    const f = mockFetch()
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (/athletes\/286831(\?|$)/.test(url) || (url.includes('286831') && !url.includes('/statistics'))) {
        return { ok: true, json: async () => ({}) }
      }
      return f(url)
    }))
    const extras = await fetchBootExtras()
    expect(extras.map((e) => e.name)).toEqual(['Lionel Messi'])
  })

  it('propagates a leaders failure (caller treats it as best-effort)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    await expect(fetchBootExtras()).rejects.toThrow(/HTTP 404/)
  })

  it('exposes the leaders source URL', () => {
    expect(LEADERS_SOURCE.url).toMatch(/^https:\/\/sports\.core\.api\.espn\.com\//)
  })
})

describe('fetchRecentPlayerStats', () => {
  const COREH = `http://${CORE}`
  // Authoritative per-match {assists, minutes}, keyed by event then athlete id.
  const perMatch = {
    700: { 45843: { a: 2, m: 90 }, 219713: { a: 1, m: 90 } },
    701: { 45843: { a: 2, m: 95 }, 219713: { a: 0, m: 15 } }, // Lautaro: scored, no assist, 15'
  }
  const statDoc = ({ a, m }) => ({
    splits: { categories: [{ name: 'off', stats: [{ name: 'goalAssists', value: a }, { name: 'minutes', value: m }] }] },
  })
  const logItem = (event, athlete) => ({
    played: true,
    event: { $ref: `${COREH}/events/${event}?lang=en` },
    statistics: { $ref: `${COREH}/events/${event}/competitions/${event}/competitors/200/roster/${athlete}/statistics/0?lang=en` },
  })
  const eventlogs = {
    45843: { events: { items: [logItem(700, 45843), logItem(701, 45843)] } },
    219713: { events: { items: [logItem(700, 219713), logItem(701, 219713)] } },
  }
  // Match 701's box score: Messi (scorer+assister), Lautaro (scorer, 0 assist),
  // and a bench player the Boot table never shows.
  const summary701 = {
    keyEvents: [],
    rosters: [{ roster: [
      { athlete: { id: '45843', displayName: 'Lionel Messi' }, starter: true, stats: [{ name: 'goalAssists', value: 2 }] },
      { athlete: { id: '219713', displayName: 'Lautaro Martínez' }, subbedIn: true, stats: [{ name: 'goalAssists', value: 0 }] },
      { athlete: { id: '999', displayName: 'Some Defender' }, starter: true, stats: [{ name: 'goalAssists', value: 0 }] },
    ] }],
  }
  const route = (url) => {
    if (url.includes('/summary')) return summary701
    if (url.includes('/eventlog')) return eventlogs[/athletes\/(\d+)\/eventlog/.exec(url)[1]]
    if (url.includes('/statistics')) {
      const ev = /events\/(\d+)/.exec(url)[1]
      const ath = /roster\/(\d+)/.exec(url)[1]
      return statDoc(perMatch[ev]?.[ath] ?? { a: 0, m: 0 })
    }
    throw new Error('unexpected url ' + url)
  }
  // Only the two scorers are in the Boot table; the defender is not.
  const wantKeys = new Set(['Lionel Messi', 'Lautaro Martínez'].map(nameKey))

  it('reconciles assists AND minutes for a finished recent match, scorers only', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      expect(url.startsWith('https://')).toBe(true) // never mixed-content http
      return { ok: true, json: async () => route(url) }
    }))
    const out = await fetchRecentPlayerStats([{ espnId: '701', live: false }], wantKeys)
    expect(out).toContainEqual({ name: 'Lionel Messi', assists: 4, minutes: 185 }) // 2+2 assists, 90+95 min
    // Lautaro (outside ESPN leaders): 1 assist from match 700, minutes 90+15.
    expect(out).toContainEqual({ name: 'Lautaro Martínez', assists: 1, minutes: 105 })
    // The defender isn't in wantKeys → never fetched.
    expect(out.find((e) => e.name === 'Some Defender')).toBeUndefined()
  })

  it('for a LIVE match, skips the live event in the eventlog and folds assists in from the box score', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({ ok: true, json: async () => route(url) })))
    const out = await fetchRecentPlayerStats([{ espnId: '701', live: true }], wantKeys)
    // Messi assists: eventlog finals skip 701 → 700 (2), plus live box 701 (2) = 4. Minutes = finals only (90).
    expect(out.find((e) => e.name === 'Lionel Messi')).toMatchObject({ assists: 4, minutes: 90 })
  })

  it('trusts a cached per-match line, skips an appearance-less log item, and survives unreadable cache', async () => {
    // A cached entry short-circuits the per-match statistics request entirely.
    localStorage.setItem('wc2026:matchStat:700:45843', JSON.stringify({ a: 9, m: 9 }))
    // …and one written by an older version (or half-flushed) is treated as absent
    // rather than thrown out of the whole reconciliation.
    localStorage.setItem('wc2026:matchStat:700:219713', 'not json')
    const seen = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      seen.push(url)
      if (url.includes('/eventlog')) {
        const id = /athletes\/(\d+)\/eventlog/.exec(url)[1]
        const base = eventlogs[id].events.items
        // An unplayed call-up contributes nothing and is never fetched for.
        return { ok: true, json: async () => ({ events: { items: [...base, { played: false }] } }) }
      }
      return { ok: true, json: async () => route(url) }
    }))
    const out = await fetchRecentPlayerStats([{ espnId: '701', live: false }], wantKeys)
    const messi = out.find((e) => e.name === 'Lionel Messi')
    // 9 from the cache for match 700 instead of the real 2, proving it was used.
    expect(messi).toMatchObject({ assists: 9 + 2, minutes: 9 + 95 })
    expect(seen.some((u) => u.includes('/events/700/') && u.includes('45843'))).toBe(false)
    // The unreadable entry was refetched rather than poisoning the total.
    expect(out.find((e) => e.name === 'Lautaro Martínez')).toMatchObject({ assists: 1 })
  })

  it('drops an athlete whose per-match reconciliation fails, keeping the rest', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.includes('/eventlog') && url.includes('219713')) return { ok: false, status: 500 }
      return { ok: true, json: async () => route(url) }
    }))
    const out = await fetchRecentPlayerStats([{ espnId: '701', live: false }], wantKeys)
    expect(out.find((e) => e.name === 'Lionel Messi')).toBeTruthy()
    expect(out.find((e) => e.name === 'Lautaro Martínez')).toBeUndefined()
  })

  it('returns nothing without recent matches or wanted scorers', async () => {
    expect(await fetchRecentPlayerStats([], wantKeys)).toEqual([])
    expect(await fetchRecentPlayerStats([{ espnId: '701' }], new Set())).toEqual([])
    expect(await fetchRecentPlayerStats([{ live: true }], wantKeys)).toEqual([])
  })
})

describe('espnStats against a feed that sends nothing', () => {
  // Every field these parsers read is optional in ESPN's core API, and a missing
  // one is routine rather than exceptional — a leader list before the tournament
  // starts, an athlete with no statistics document yet, an event log for someone
  // who has not played. Each fallback below is the difference between an empty
  // table and a crash, so they are exercised together on one bare document.

  it('reads a leaders document with no categories at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    expect(await fetchBootExtras()).toEqual([])
  })

  it('reads leader categories with no leaders, and leaders with no athlete ref', async () => {
    const doc = {
      categories: [
        { name: 'goalsLeaders' }, // no leaders array
        { name: 'assistsLeaders', leaders: [{}, { athlete: {} }] }, // no $ref to match
      ],
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => doc })))
    expect(await fetchBootExtras()).toEqual([])
  })

  it('defaults every statistic the athlete document omits', async () => {
    // A named athlete whose statistics document has no splits at all: goals and
    // minutes are unknown (null) but assists count as zero, because the Boot
    // table sorts on assists and a missing value must not outrank a real one.
    const doc = {
      categories: [{ name: 'goalsLeaders', leaders: [{ athlete: { $ref: `http://${CORE}/athletes/1?lang=en` } }] }],
    }
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => {
        if (url.includes('/leaders')) return doc
        if (url.includes('/statistics')) return {} // no splits
        return { displayName: 'Nameless Stat Line' }
      },
    })))
    expect(await fetchBootExtras()).toEqual([
      { name: 'Nameless Stat Line', goals: null, assists: 0, minutes: null },
    ])
  })

  it('reads a statistics document whose categories carry no stats', async () => {
    const doc = {
      categories: [{ name: 'goalsLeaders', leaders: [{ athlete: { $ref: `http://${CORE}/athletes/1?lang=en` } }] }],
    }
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => {
        if (url.includes('/leaders')) return doc
        if (url.includes('/statistics')) return { splits: { categories: [{ name: 'general' }] } }
        return { displayName: 'Empty Category' }
      },
    })))
    const [only] = await fetchBootExtras()
    expect(only).toMatchObject({ name: 'Empty Category', goals: null, assists: 0 })
  })

  it('takes the recent-match set and the wanted keys in their loosest forms', async () => {
    // Callers pass a Set, but an array (or nothing at all) has to behave the
    // same rather than reconcile every player on the board.
    expect(await fetchRecentPlayerStats(null, new Set(['x']))).toEqual([])
    expect(await fetchRecentPlayerStats([{ espnId: '1' }], null)).toEqual([])
    expect(await fetchRecentPlayerStats([{ espnId: '1' }], [])).toEqual([])
    expect(await fetchRecentPlayerStats([{ live: true }], ['x'])).toEqual([])
  })

  it('defaults an event log with no events and a match line with no minutes', async () => {
    const summary = {
      keyEvents: [],
      rosters: [{ roster: [{ athlete: { id: '77', displayName: 'Recent Player' }, starter: true, stats: [] }] }],
    }
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => {
        if (url.includes('/summary')) return summary
        if (url.includes('/eventlog')) return {} // no events at all
        return {}
      },
    })))
    const out = await fetchRecentPlayerStats(
      [{ espnId: '900', live: false }],
      new Set([nameKey('Recent Player')]),
    )
    // Nothing in the log to total up, so minutes come back as unknown rather
    // than a misleading zero.
    expect(out).toEqual([{ name: 'Recent Player', assists: 0, minutes: null }])
  })

  it('folds a live match’s assists in even when the event log is empty', async () => {
    const summary = {
      keyEvents: [],
      rosters: [{ roster: [{ athlete: { id: '78', displayName: 'Live Player' }, starter: true, stats: [{ name: 'goalAssists', value: 2 }] }] }],
    }
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => {
        if (url.includes('/summary')) return summary
        if (url.includes('/eventlog')) return { events: { items: [] } }
        return {}
      },
    })))
    const out = await fetchRecentPlayerStats(
      [{ espnId: '901', live: true }],
      new Set([nameKey('Live Player')]),
    )
    expect(out).toEqual([{ name: 'Live Player', assists: 2, minutes: null }])
  })

  it('ignores a match line with no athlete id', async () => {
    const summary = {
      keyEvents: [],
      rosters: [{ roster: [{ athlete: { displayName: 'No Id' }, starter: true, stats: [] }] }],
    }
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (url.includes('/summary') ? summary : {}),
    })))
    expect(
      await fetchRecentPlayerStats([{ espnId: '902', live: false }], new Set([nameKey('No Id')])),
    ).toEqual([])
  })
})
