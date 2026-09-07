import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { VENUES } from '../src/data/venues.js'
import { weekStartOf, addDays } from '../src/utils/week.js'
import {
  dayKey,
  formatTime,
  matchStatus,
  liveState,
  teamLocalKickoffs,
  teamKickoffTooltip,
} from '../src/utils/time.js'
import { TEAM_TIMEZONES } from '../src/data/teamTimezones.js'
import { ALL_TEAMS } from '../src/data/teams.js'
import { buildICS, webcalUrl, googleCalendarUrl } from '../src/utils/ics.js'
import { rankGroup } from '../src/utils/qualification.js'

describe('week utils', () => {
  it('weekStartOf returns the preceding Sunday', () => {
    expect(weekStartOf('2026-06-11')).toBe('2026-06-07') // Thu -> Sun
    expect(weekStartOf('2026-06-07')).toBe('2026-06-07') // Sun -> itself
  })

  it('addDays does calendar math across month boundaries', () => {
    expect(addDays('2026-06-28', 6)).toBe('2026-07-04')
  })

  it('every match falls inside exactly one listed week', () => {
    const tz = 'America/New_York'
    const weeks = [...new Set(MATCHES.map((m) => weekStartOf(dayKey(m.ko, tz))))]
    for (const m of MATCHES) {
      const k = dayKey(m.ko, tz)
      const hits = weeks.filter((w) =>
        Array.from({ length: 7 }, (_, i) => addDays(w, i)).includes(k),
      )
      expect(hits).toHaveLength(1)
    }
  })
})

describe('time utils', () => {
  it('converts the opening match (3pm ET) to other zones', () => {
    const open = MATCHES.find((m) => m.num === 1).ko
    expect(formatTime(open, 'America/New_York')).toBe('3:00 PM')
    expect(formatTime(open, 'America/Los_Angeles')).toBe('12:00 PM')
    expect(formatTime(open, 'Europe/London')).toBe('8:00 PM')
  })

  it('classifies match status by time', () => {
    expect(matchStatus('2026-06-11T19:00:00Z', Date.parse('2026-06-10T00:00:00Z'))).toBe('upcoming')
    expect(matchStatus('2026-06-11T19:00:00Z', Date.parse('2026-06-11T19:30:00Z'))).toBe('live')
    expect(matchStatus('2026-06-11T19:00:00Z', Date.parse('2026-06-12T00:00:00Z'))).toBe('finished')
  })

  it('liveState prefers feed data over the clock', () => {
    const ko = '2026-06-11T19:00:00Z'
    const duringWindow = Date.parse('2026-06-11T19:30:00Z') // time-based "live"
    // A finished match (has a score) reads finished even inside the live window.
    expect(liveState({ ko, score: [2, 0] }, duringWindow)).toBe('finished')
    // ESPN's live flag wins regardless of clock.
    expect(liveState({ ko, score: [1, 0], live: { clock: "HT" } }, duringWindow)).toBe('live')
    // No feed data yet -> fall back to the time-based guess.
    expect(liveState({ ko }, duringWindow)).toBe('live')
    expect(liveState({ ko }, Date.parse('2026-06-10T00:00:00Z'))).toBe('upcoming')
  })
})

describe('team local kickoff tooltip', () => {
  const open = MATCHES.find((m) => m.num === 1).ko // opener, 3pm EDT

  it('gives a single home-time line for a single-zone country', () => {
    // Abbrev rendering of Europe/London varies by ICU build (BST vs GMT+1), so
    // assert the wall-clock and that exactly one line comes back.
    const lines = teamLocalKickoffs(open, 'England')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^Jun 11, 8:00 PM /)
  })

  it('lists one line per distinct wall-clock for a multi-zone country', () => {
    // USA spans Hawaii→Eastern; the opener (3pm EDT) reads differently in each.
    const lines = teamLocalKickoffs(open, 'USA')
    expect(lines).toEqual([
      'Jun 11, 9:00 AM HST',
      'Jun 11, 11:00 AM AKDT',
      'Jun 11, 12:00 PM PDT',
      'Jun 11, 1:00 PM MDT',
      'Jun 11, 2:00 PM CDT',
      'Jun 11, 3:00 PM EDT',
    ])
  })

  it('collapses zones that read the same clock at the instant', () => {
    // Mexico lists 4 zones, but Tijuana (PDT) & Hermosillo (MST) share -7 in June.
    expect(TEAM_TIMEZONES.Mexico).toHaveLength(4)
    expect(teamLocalKickoffs(open, 'Mexico')).toHaveLength(3)
  })

  it('returns empty for unknown teams (e.g. knockout placeholders)', () => {
    expect(teamLocalKickoffs(open, 'Winner Group A')).toEqual([])
    expect(teamKickoffTooltip(open, 'Winner Group A')).toBe('')
  })

  it('builds a labelled multi-line tooltip', () => {
    expect(teamKickoffTooltip(open, 'England')).toMatch(/^Kickoff in England:\nJun 11, 8:00 PM /)
    expect(teamKickoffTooltip(open, 'USA')).toMatch(/^Kickoff in USA \(local times\):\n/)
  })

  it('has a timezone entry for every qualified team', () => {
    for (const name of ALL_TEAMS) {
      expect(TEAM_TIMEZONES[name], `${name} missing a home timezone`).toBeTruthy()
      expect(TEAM_TIMEZONES[name].length).toBeGreaterThan(0)
    }
  })
})

describe('ICS export', () => {
  it('emits a valid VEVENT with correct UTC start/end', () => {
    const final = MATCHES.find((m) => m.stage === 'Final')
    const ics = buildICS(final)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20260719T190000Z') // 3pm EDT -> 19:00 UTC
    expect(ics).toContain('DTEND:20260719T211500Z') // +2h15m
    expect(ics).toContain('LOCATION:MetLife Stadium')
    expect(ics).toContain('END:VCALENDAR')
  })
})

describe('calendar subscription links', () => {
  const FEED = 'https://world-cup-viewer.netlify.app/calendar.ics'

  it('webcalUrl swaps the scheme to webcal', () => {
    expect(webcalUrl(FEED)).toBe('webcal://world-cup-viewer.netlify.app/calendar.ics')
    expect(webcalUrl('http://x/y.ics')).toBe('webcal://x/y.ics')
  })

  it('googleCalendarUrl uses a raw webcal:// cid (not https, not percent-encoded)', () => {
    const link = googleCalendarUrl(FEED)
    expect(link).toBe(
      'https://www.google.com/calendar/render?cid=webcal://world-cup-viewer.netlify.app/calendar.ics',
    )
    // The old bug: an https/encoded cid that Google rejects with "check the URL".
    expect(link).not.toContain('cid=https')
    expect(link).not.toContain('%3A')
  })

  it('preserves the ?teams= query string for the my-teams feed', () => {
    const myFeed = `${FEED}?teams=Mexico,Brazil`
    const link = googleCalendarUrl(myFeed)
    expect(link).toContain('cid=webcal://world-cup-viewer.netlify.app/calendar.ics?teams=Mexico,Brazil')
    expect(link).not.toContain('%3F') // the "?" stays raw so Google keeps the query
  })
})

describe('standings', () => {
  it('tallies points, GD and ordering from scored matches', () => {
    const scored = MATCHES.map((m) =>
      m.num === 1 ? { ...m, score: [2, 1] } : m, // Mexico 2-1 South Africa
    )
    const table = rankGroup('A', scored)
    const mex = table.find((r) => r.name === 'Mexico')
    const rsa = table.find((r) => r.name === 'South Africa')
    expect(mex.Pts).toBe(3)
    expect(mex.GD).toBe(1)
    expect(rsa.Pts).toBe(0)
    expect(rsa.GD).toBe(-1)
    expect(table[0].name).toBe('Mexico') // sorted to top
  })
})

describe('venue timezones', () => {
  it('every venue has a valid IANA timezone', () => {
    for (const v of Object.values(VENUES)) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: v.tz })).not.toThrow()
    }
  })
})
