import { describe, it, expect, vi } from 'vitest'
import { fetchLive, applyLive } from '../src/services/espn.js'
import { MATCHES } from '../src/data/matches.js'

// Two group matches kick off at the same instant on the final matchday (e.g. the
// 8 PM ET pair). They must each get their own live score — the live data is keyed
// by team pair, and the feed dedup must not merge them by shared kickoff time.
describe('simultaneous live matches', () => {
  const slot = MATCHES.filter((m) => m.stage === 'Group').reduce((acc, m) => {
    ;(acc[m.ko] = acc[m.ko] || []).push(m)
    return acc
  }, {})
  const [a, b] = Object.values(slot).find((g) => g.length === 2)

  const event = (m, hs, as, clock, id) => ({
    ...(id ? { id, uid: 'uid' + id } : {}),
    date: m.ko,
    status: { type: { state: 'in', name: 'STATUS_FIRST_HALF', shortDetail: clock } },
    competitions: [
      {
        status: { type: { state: 'in', shortDetail: clock } },
        competitors: [
          { homeAway: 'home', team: { id: m.num + 'h', displayName: m.t1 }, score: String(hs) },
          { homeAway: 'away', team: { id: m.num + 'a', displayName: m.t2 }, score: String(as) },
        ],
      },
    ],
  })

  const run = async (withIds) => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        events: [event(a, 2, 1, "30'", withIds ? 'e' + a.num : null), event(b, 0, 3, "31'", withIds ? 'e' + b.num : null)],
      }),
    }))
    const out = applyLive(MATCHES, await fetchLive())
    return [out.find((m) => m.num === a.num), out.find((m) => m.num === b.num)]
  }

  it('keeps both same-instant matches distinct (with ESPN ids)', async () => {
    const [oa, ob] = await run(true)
    expect(oa.live).toBeTruthy()
    expect(ob.live).toBeTruthy()
    expect(oa.score).toEqual([2, 1])
    expect(ob.score).toEqual([0, 3])
  })

  it('does not merge them even when events lack an id (dedup must not fall back to date)', async () => {
    const [oa, ob] = await run(false)
    expect(oa.score).toEqual([2, 1])
    expect(ob.score).toEqual([0, 3])
  })
})
