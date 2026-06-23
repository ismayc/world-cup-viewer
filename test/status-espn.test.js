import { describe, it, expect, vi } from 'vitest'
import { fetchLive, applyLive } from '../src/services/espn.js'
import { pairKey } from '../src/services/results.js'

// Build an ESPN scoreboard event with a given status.type.name and (optional)
// scores. Mirrors the shape used by espn-coverage.test.js / delayed.test.jsx.
function event({ name, state, home = 'France', away = 'Iraq', hs, as, description, shortDetail }) {
  const type = { state, name, description: description ?? name, shortDetail: shortDetail ?? '' }
  return {
    date: '2026-06-22T21:00Z',
    status: { type },
    competitions: [
      {
        status: { type },
        competitors: [
          { homeAway: 'home', team: { id: '1', displayName: home }, score: hs },
          { homeAway: 'away', team: { id: '2', displayName: away }, score: as },
        ],
      },
    ],
  }
}

async function recOf(ev, home = 'France', away = 'Iraq') {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [ev] }) }))
  const map = await fetchLive()
  return map.get(pairKey(home, away))
}

// A bare match for applyLive — no OpenFootball score yet, so the live overlay
// drives the outcome.
const bareMatch = (t1 = 'France', t2 = 'Iraq') => ({ num: 9001, stage: 'Group', group: 'X', t1, t2, ko: '2026-06-22T21:00:00-04:00' })

describe('statusLabelOf — one return line per ESPN status name', () => {
  // Each case exercises exactly one return in statusLabelOf via fetchLive's rec.
  const cases = [
    ['STATUS_SUSPENDED', 'in', 'Suspended'],
    ['STATUS_DELAYED', 'in', 'Delayed'],
    ['STATUS_ABANDONED', 'post', 'Abandoned'],
    ['STATUS_POSTPONED', 'pre', 'Postponed'],
    ['STATUS_CANCELED', 'pre', 'Canceled'],
    ['STATUS_FORFEIT', 'post', 'Awarded'],
  ]
  for (const [name, state, label] of cases) {
    it(`${name} -> statusLabel "${label}"`, async () => {
      const rec = await recOf(event({ name, state }))
      expect(rec.statusLabel).toBe(label)
    })
  }

  it('AWARD also maps to "Awarded" (the awarded branch)', async () => {
    const rec = await recOf(event({ name: 'STATUS_AWARDED', state: 'post' }))
    expect(rec.statusLabel).toBe('Awarded')
  })

  it('an ordinary status name yields a null label', async () => {
    const rec = await recOf(event({ name: 'STATUS_FIRST_HALF', state: 'in', hs: '0', as: '0' }))
    expect(rec.statusLabel).toBeNull()
  })
})

describe('fetchLive rec flags — paused / voided / awarded', () => {
  it('SUSPENDED sets paused (and not voided/awarded)', async () => {
    const rec = await recOf(event({ name: 'STATUS_SUSPENDED', state: 'in', hs: '1', as: '0' }))
    expect(rec.paused).toBe(true)
    expect(rec.voided).toBe(false)
    expect(rec.awarded).toBe(false)
  })

  it('ABANDONED sets voided and keeps the partial score', async () => {
    const rec = await recOf(event({ name: 'STATUS_ABANDONED', state: 'post', hs: '2', as: '1' }))
    expect(rec.voided).toBe(true)
    expect(rec.paused).toBe(false)
    expect(rec.score).toEqual([2, 1])
  })

  it('FORFEIT sets awarded', async () => {
    const rec = await recOf(event({ name: 'STATUS_FORFEIT', state: 'post', hs: '3', as: '0' }))
    expect(rec.awarded).toBe(true)
    expect(rec.voided).toBe(false)
  })
})

describe('applyLive — one-off status outcomes on an unscored match', () => {
  it('SUSPENDED -> m.live.delayed && m.live.label === "Suspended"', async () => {
    const rec = await recOf(event({ name: 'STATUS_SUSPENDED', state: 'in', hs: '1', as: '0' }))
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [] }) }))
    const map = new Map([[pairKey('France', 'Iraq'), rec]])
    const [out] = applyLive([bareMatch()], map)
    expect(out.live.delayed).toBe(true)
    expect(out.live.label).toBe('Suspended')
  })

  it('ABANDONED -> m.voided, statusLabel "Abandoned", partial score kept', async () => {
    const rec = await recOf(event({ name: 'STATUS_ABANDONED', state: 'post', hs: '2', as: '1' }))
    const map = new Map([[pairKey('France', 'Iraq'), rec]])
    const [out] = applyLive([bareMatch()], map)
    expect(out.voided).toBe(true)
    expect(out.statusLabel).toBe('Abandoned')
    expect(out.score).toEqual([2, 1])
  })

  it('POSTPONED (no score) -> m.voided with no score', async () => {
    const rec = await recOf(event({ name: 'STATUS_POSTPONED', state: 'pre' }))
    const map = new Map([[pairKey('France', 'Iraq'), rec]])
    const [out] = applyLive([bareMatch()], map)
    expect(out.voided).toBe(true)
    expect(out.score).toBeUndefined()
  })

  it('CANCELED -> m.voided', async () => {
    const rec = await recOf(event({ name: 'STATUS_CANCELED', state: 'pre' }))
    const map = new Map([[pairKey('France', 'Iraq'), rec]])
    const [out] = applyLive([bareMatch()], map)
    expect(out.voided).toBe(true)
    expect(out.score).toBeUndefined()
  })

  it('FORFEIT/AWARD final -> m.awarded === true with the score kept', async () => {
    const rec = await recOf(event({ name: 'STATUS_FORFEIT', state: 'post', hs: '3', as: '0' }))
    const map = new Map([[pairKey('France', 'Iraq'), rec]])
    const [out] = applyLive([bareMatch()], map)
    expect(out.awarded).toBe(true)
    expect(out.score).toEqual([3, 0])
  })
})
