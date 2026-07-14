import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchBootExtras, LEADERS_SOURCE, CACHE_TTL_MS } from '../src/services/espnStats.js'

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

  it('propagates a leaders failure (caller treats it as best-effort)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    await expect(fetchBootExtras()).rejects.toThrow(/HTTP 404/)
  })

  it('exposes the leaders source URL', () => {
    expect(LEADERS_SOURCE.url).toMatch(/^https:\/\/sports\.core\.api\.espn\.com\//)
  })
})
