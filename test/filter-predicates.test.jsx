import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'
import App from '../src/App.jsx'
import { MATCHES } from '../src/data/matches.js'
import { VENUES } from '../src/data/venues.js'

/**
 * The schedule's filter predicate, one clause at a time.
 *
 * Every clause is an `if (filters.X !== 'all' && …) return false`, so a clause
 * only runs when that filter is set AND some match fails it. Setting several at
 * once would let the first one short-circuit the rest, so each is driven on its
 * own through the URL — which is also how a shared link arrives.
 *
 * Each clause is checked twice: once with a value no match can satisfy, which
 * makes the exclusion fire for every match whatever shape the edition is in
 * (a single-country host would otherwise never exclude anything on country),
 * and once with a real value read out of the committed board, so the filter is
 * shown to keep the right matches rather than merely to reject everything.
 */

// A match whose venue is one the venue table knows, so country/region resolve.
const sample = MATCHES.find((m) => VENUES[m.venue])
const venueOf = VENUES[sample.venue]

const NONE = '__no_such_value__'

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [] }) }))
  window.history.replaceState(null, '', '/')
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Mount at a URL, read the result count out of the filter panel footer (which is
// collapsed until it is opened), and tear the tree down again so the next mount
// in the same test does not collide with it.
const countAt = (query) => {
  window.history.replaceState(null, '', query)
  const { container, unmount } = render(<App />)
  try {
    if (!container.querySelector('.result-count')) {
      const toggle = within(container).queryByRole('button', { name: /Filters/ })
      if (toggle) fireEvent.click(toggle)
    }
    const el = container.querySelector('.result-count')
    return Number(el.textContent.match(/\d+/)[0])
  } finally {
    unmount()
  }
}

const q = (k, v) => `/?${k}=${encodeURIComponent(v)}`

describe('schedule filter clauses', () => {
  it('counts the whole board with no filter applied', () => {
    expect(countAt('/')).toBeGreaterThan(1)
  })

  it('keeps only the chosen team’s matches', () => {
    const all = countAt('/')
    expect(countAt(q('team', NONE))).toBe(0)
    const mine = countAt(q('team', sample.t1))
    expect(mine).toBeGreaterThan(0)
    expect(mine).toBeLessThan(all)
  })

  it('keeps only matches in the chosen country', () => {
    expect(countAt(q('country', NONE))).toBe(0)
    expect(countAt(q('country', venueOf.country))).toBeGreaterThan(0)
  })

  it('keeps only matches in the chosen region', () => {
    expect(countAt(q('region', NONE))).toBe(0)
    expect(countAt(q('region', venueOf.region))).toBeGreaterThan(0)
  })

  it('keeps only matches at the chosen venue', () => {
    const all = countAt('/')
    expect(countAt(q('venue', NONE))).toBe(0)
    const here = countAt(q('venue', sample.venue))
    expect(here).toBeGreaterThan(0)
    expect(here).toBeLessThan(all)
  })

  it('keeps only matches in the chosen timeframe', () => {
    const all = countAt('/')
    const finished = countAt('/?when=finished')
    const upcoming = countAt('/?when=upcoming')
    // A finished edition has no upcoming matches and vice versa, so rather than
    // assume which way round this board is, require that at least one of the two
    // states excludes something and that neither invents matches.
    expect(Math.min(finished, upcoming)).toBeLessThan(all)
    expect(finished + upcoming).toBeLessThanOrEqual(all)
  })
})
