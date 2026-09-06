import { describe, it, expect, vi } from 'vitest'
import {
  detectTimezone,
  timezoneOptions,
  formatTime,
  formatDateLong,
  formatDayKeyLong,
  dayKey,
  tzAbbrev,
  teamLocalKickoffs,
  teamKickoffTooltip,
  matchStatus,
  liveState,
} from '../src/utils/time.js'
import { TEAM_TIMEZONES } from '../src/data/teamTimezones.js'

const ISO = '2026-06-11T20:00:00-04:00' // opener kickoff (ET)

describe('detectTimezone', () => {
  it('returns the resolved IANA zone', () => {
    expect(typeof detectTimezone()).toBe('string')
  })

  it('falls back to UTC when Intl throws', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('boom')
    })
    try {
      expect(detectTimezone()).toBe('UTC')
    } finally {
      spy.mockRestore()
    }
  })

  it('falls back to UTC when resolvedOptions yields no timeZone', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: undefined }),
    })
    try {
      expect(detectTimezone()).toBe('UTC')
    } finally {
      spy.mockRestore()
    }
  })
})

describe('timezoneOptions', () => {
  it('dedupes the detected zone against the common list', () => {
    const opts = timezoneOptions('America/Chicago')
    expect(opts[0]).toBe('America/Chicago')
    expect(opts.filter((z) => z === 'America/Chicago')).toHaveLength(1)
  })

  it('prepends a non-common detected zone', () => {
    const opts = timezoneOptions('Pacific/Auckland')
    expect(opts[0]).toBe('Pacific/Auckland')
    expect(opts).toContain('UTC')
  })
})

describe('formatters', () => {
  it('formats a wall-clock time in a zone', () => {
    expect(formatTime(ISO, 'America/New_York')).toMatch(/8:00\s?PM/)
  })

  it('formats a long date in a zone', () => {
    expect(formatDateLong(ISO, 'America/New_York')).toContain('2026')
  })

  it('produces a YYYY-MM-DD day key', () => {
    expect(dayKey(ISO, 'America/New_York')).toBe('2026-06-11')
  })

  it('returns a timezone abbreviation', () => {
    expect(tzAbbrev(ISO, 'America/New_York')).toBeTruthy()
  })

  it('returns an empty abbreviation when the platform formats no zone name', () => {
    // Node's ICU build decides which parts come back, and a trimmed build can
    // format a time with no timeZoneName part at all. The kickoff line then
    // reads "1:00 PM" with nothing after it rather than "1:00 PM undefined".
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function () {
      return { formatToParts: () => [{ type: 'hour', value: '1' }] }
    })
    try {
      expect(tzAbbrev(ISO, 'America/New_York')).toBe('')
    } finally {
      spy.mockRestore()
    }
  })
})

describe('teamLocalKickoffs / tooltip', () => {
  it('returns [] for a team with no known home zone', () => {
    expect(teamLocalKickoffs(ISO, 'Winner Group A')).toEqual([])
  })

  it('returns one line for a single-zone team', () => {
    const single = Object.keys(TEAM_TIMEZONES).find((t) => TEAM_TIMEZONES[t].length === 1)
    const lines = teamLocalKickoffs(ISO, single)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/[A-Za-z]{3} \d/)
  })

  it('collapses zones that read the same wall-clock at the instant', () => {
    // Inject a team whose two zones share the same offset at this instant.
    TEAM_TIMEZONES.__SAME__ = ['America/New_York', 'America/Toronto']
    const lines = teamLocalKickoffs(ISO, '__SAME__')
    expect(lines).toHaveLength(1)
    delete TEAM_TIMEZONES.__SAME__
  })

  it('returns one line per distinct wall-clock for a multi-zone team', () => {
    TEAM_TIMEZONES.__SPAN__ = ['America/New_York', 'America/Los_Angeles']
    const lines = teamLocalKickoffs(ISO, '__SPAN__')
    expect(lines).toHaveLength(2)
    delete TEAM_TIMEZONES.__SPAN__
  })

  it('empty tooltip when no home zone', () => {
    expect(teamKickoffTooltip(ISO, 'Winner Group A')).toBe('')
  })

  it('single-line tooltip header for one zone', () => {
    const single = Object.keys(TEAM_TIMEZONES).find((t) => TEAM_TIMEZONES[t].length === 1)
    const tip = teamKickoffTooltip(ISO, single)
    expect(tip).toContain(`Kickoff in ${single}:`)
  })

  it('multi-line tooltip header for several zones', () => {
    TEAM_TIMEZONES.__SPAN2__ = ['America/New_York', 'America/Los_Angeles']
    const tip = teamKickoffTooltip(ISO, '__SPAN2__')
    expect(tip).toContain('local times):')
    expect(tip.split('\n').length).toBe(3)
    delete TEAM_TIMEZONES.__SPAN2__
  })
})

describe('matchStatus', () => {
  const start = new Date(ISO).getTime()
  it('upcoming before kickoff', () => {
    expect(matchStatus(ISO, start - 1000)).toBe('upcoming')
  })
  it('live during the window', () => {
    expect(matchStatus(ISO, start + 60 * 60 * 1000)).toBe('live')
  })
  it('finished after the window', () => {
    expect(matchStatus(ISO, start + 200 * 60 * 1000)).toBe('finished')
  })
})

describe('liveState', () => {
  it('prefers the feed live flag', () => {
    expect(liveState({ ko: ISO, live: true }, new Date(ISO).getTime() + 1e9)).toBe('live')
  })
  it('treats a final score as finished even inside the time window', () => {
    expect(liveState({ ko: ISO, score: [1, 0] }, new Date(ISO).getTime() + 60000)).toBe('finished')
  })
  it('falls back to the clock when no feed data', () => {
    expect(liveState({ ko: ISO }, new Date(ISO).getTime() - 1000)).toBe('upcoming')
  })
})

// A day heading names the DAY its section groups, so it formats the day key.
// Formatting the first match's kickoff instead holds only while every match on
// the day has one: in the FIBA sibling, whose board carries games the organizer
// has not timed yet, it printed "Wednesday, December 31, 1969".
describe('formatDayKeyLong', () => {
  it('names a calendar day from its key, with or without the year', () => {
    expect(formatDayKeyLong('2026-06-20')).toBe('Saturday, June 20, 2026')
    expect(formatDayKeyLong('2026-06-20', { year: false })).toBe('Saturday, June 20')
  })

  it('renders nothing without a day to name', () => {
    expect(formatDayKeyLong(null)).toBe('')
    expect(formatDayKeyLong('')).toBe('')
  })

  // The suite runs on America/New_York, where `new Date('2026-01-01')` (parsed
  // as UTC midnight, rendered locally) is December 31, 2025. A day key is a
  // plain calendar date with no instant behind it, so it must come back as the
  // day it names: parsed at noon UTC and rendered in UTC, never converted.
  it('states the day the key names, with no timezone drift', () => {
    expect(formatDayKeyLong('2026-01-01')).toBe('Thursday, January 1, 2026')
    expect(formatDayKeyLong('2026-12-31')).toBe('Thursday, December 31, 2026')
  })
})

// `new Date(null)` is the EPOCH, not an Invalid Date, and it formats cleanly.
// Every formatter refuses a missing instant so a call site that forgets the case
// shows nothing rather than a 1969 date.
describe('a missing kickoff', () => {
  it('renders as nothing, never as the epoch', () => {
    for (const tz of ['UTC', 'America/Los_Angeles']) {
      expect(formatTime(null, tz)).toBe('')
      expect(formatDateLong(null, tz)).toBe('')
      expect(tzAbbrev(null, tz)).toBe('')
      expect(formatTime(undefined, tz)).toBe('')
      expect(formatDateLong('', tz)).toBe('')
      expect(tzAbbrev(undefined, tz)).toBe('')
    }
  })
})
