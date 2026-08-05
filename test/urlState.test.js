import { describe, it, expect, beforeEach } from 'vitest'
import { readState, writeState, DEFAULT_FILTERS } from '../src/utils/urlState.js'

const TZ = 'America/New_York'

beforeEach(() => window.history.replaceState(null, '', '/'))

describe('urlState', () => {
  it('reads sensible defaults from a bare URL', () => {
    const s = readState(TZ)
    expect(s.view).toBe('schedule')
    expect(s.tz).toBe(TZ)
    expect(s.hideScores).toBe(false)
    expect(s.filters).toEqual(DEFAULT_FILTERS)
  })

  it('writes nothing for an all-default state (clean URL)', () => {
    writeState({ view: 'schedule', tz: TZ, hideScores: false, filters: DEFAULT_FILTERS }, TZ)
    expect(window.location.search).toBe('')
  })

  it('round-trips a non-default state through write then read', () => {
    const state = {
      view: 'bracket',
      tz: 'Europe/London',
      hideScores: true,
      filters: {
        ...DEFAULT_FILTERS,
        search: 'team: Brazil',
        stages: ['Group', 'R16'],
        group: 'C',
        team: 'Brazil',
        country: 'Mexico',
        region: 'West',
        venue: 'Estadio Azteca',
        timeframe: 'live',
        feed: 'english',
        myTeams: true,
      },
    }
    writeState(state, TZ)
    expect(window.location.search).not.toBe('') // non-defaults are persisted
    const read = readState(TZ)
    expect(read.view).toBe('bracket')
    expect(read.tz).toBe('Europe/London')
    expect(read.hideScores).toBe(true)
    expect(read.filters).toEqual(state.filters)
  })

  it('keeps tz out of the URL when it matches the detected zone', () => {
    writeState({ view: 'schedule', tz: TZ, hideScores: false, filters: DEFAULT_FILTERS }, TZ)
    expect(window.location.search).not.toMatch(/tz=/)
    // but a different tz IS written and read back
    writeState({ view: 'schedule', tz: 'Asia/Tokyo', hideScores: false, filters: DEFAULT_FILTERS }, TZ)
    expect(readState(TZ).tz).toBe('Asia/Tokyo')
  })

  it('round-trips an empty stages list as empty (no stray param)', () => {
    writeState({ view: 'schedule', tz: TZ, hideScores: false, filters: { ...DEFAULT_FILTERS, stages: [] } }, TZ)
    expect(window.location.search).toBe('')
    expect(readState(TZ).filters.stages).toEqual([])
  })
})
