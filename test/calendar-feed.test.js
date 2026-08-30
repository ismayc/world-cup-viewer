// The Netlify calendar function's handler and event builder.
//
// `prettySlot` had tests (calendar-slots.test.js); everything around it did not,
// and the whole file sat outside `coverage.include`, which was `src/**`. That
// left the endpoint a subscriber's calendar actually polls measured by nothing.
//
// The upstream here is OpenFootball's worldcup.json, not ESPN, so these payloads
// are in OpenFootball's shape: a `matches` array with `date`, `time` carrying its
// own UTC offset, `team1`/`team2` that may still be knockout slot codes, and a
// `score` with separate full-time, extra-time and penalty arrays.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { handler } from '../netlify/functions/calendar.js'

const ok = (payload) =>
  vi.fn(async () => ({ ok: true, json: async () => payload }))

const match = (over = {}) => ({
  num: 1,
  round: 'Matchday 1',
  group: 'Group A',
  date: '2026-06-11',
  time: '13:00 UTC-6',
  team1: 'Mexico',
  team2: 'South Africa',
  ground: 'Estadio Azteca',
  ...over,
})

const events = (body) => (body.match(/BEGIN:VEVENT/g) || []).length

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the calendar handler', () => {
  it('serves a calendar naming this tournament', async () => {
    global.fetch = ok({ matches: [match()] })
    const res = await handler({ queryStringParameters: {} })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toMatch(/text\/calendar/)
    expect(res.body).toContain('X-WR-CALNAME:World Cup 2026')
    expect(events(res.body)).toBe(1)
    expect(res.body).toContain('SUMMARY:World Cup: Mexico vs South Africa')
    expect(res.body).toContain('LOCATION:Estadio Azteca')
    expect(res.body).toContain('DESCRIPTION:Group A')
  })

  it('reads the kickoff through the offset the feed states', async () => {
    // 13:00 UTC-6 is 19:00 UTC. Getting this wrong puts every match in a
    // subscriber's calendar at the wrong hour, which is the whole risk here.
    global.fetch = ok({ matches: [match()] })
    const body = (await handler({ queryStringParameters: {} })).body
    expect(body).toContain('DTSTART:20260611T190000Z')
  })

  it('filters to the requested teams', async () => {
    global.fetch = ok({ matches: [match(), match({ num: 2, team1: 'Brazil', team2: 'Japan' })] })
    const res = await handler({ queryStringParameters: { teams: 'brazil' } })
    expect(events(res.body)).toBe(1)
    expect(res.body).toContain('Brazil')
    expect(res.body).toContain('My Teams')
  })

  it('labels a knockout round rather than a matchday, and expands slot codes', async () => {
    global.fetch = ok({
      matches: [
        match({ num: 73, round: 'Round of 32', group: undefined, team1: '1A', team2: '3C/D/F/G/H' }),
        match({ num: 101, round: 'Semi-final', group: undefined, team1: 'W97', team2: 'W98' }),
        match({ num: 103, round: 'Match for third place', group: undefined, team1: 'L101', team2: 'L102' }),
      ],
    })
    const body = (await handler({ queryStringParameters: {} })).body
    expect(body).toContain('DESCRIPTION:Round of 32')
    // A third-place slot is a set of possible groups, never a single one.
    expect(body).toContain('SUMMARY:World Cup: Winner Group A vs 3rd place (C/D/F/G/H)')
    expect(body).toContain('SUMMARY:World Cup: Winner Match 97 vs Winner Match 98')
    expect(body).toContain('DESCRIPTION:Semifinal')
    expect(body).toContain('SUMMARY:World Cup: Loser Match 101 vs Loser Match 102')
    expect(body).toContain('DESCRIPTION:Third-place Match')
  })

  it('shows a finished score, and notes extra time and penalties', async () => {
    global.fetch = ok({
      matches: [
        match({ num: 2, score: { ft: [1, 1] } }),
        match({ num: 3, score: { ft: [1, 1], et: [2, 1] } }),
        match({ num: 4, score: { ft: [0, 0], et: [0, 0], p: [4, 3] } }),
      ],
    })
    const body = (await handler({ queryStringParameters: {} })).body
    expect(body).toContain('(1–1)')
    expect(body).toContain('(2–1 AET)')
    expect(body).toContain('(0–0 AET p4–3)')
  })

  it('skips a match with no usable kickoff rather than emitting a broken event', async () => {
    global.fetch = ok({ matches: [match({ time: undefined }), match({ num: 5 })] })
    expect(events((await handler({ queryStringParameters: {} })).body)).toBe(1)
  })

  it('identifies a match with no number by its teams and date', async () => {
    global.fetch = ok({ matches: [match({ num: undefined, round: 'Final' })] })
    const body = (await handler({ queryStringParameters: {} })).body
    expect(body).toMatch(/UID:wc2026-Final-Mexico-South_Africa-2026-06-11@worldcupviewer/)
  })

  it('serves an empty calendar rather than failing when the feed has no matches', async () => {
    global.fetch = ok({})
    const res = await handler({ queryStringParameters: null })
    expect(res.statusCode).toBe(200)
    expect(events(res.body)).toBe(0)
  })

  it('reports an upstream failure instead of an empty calendar', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 }))
    expect((await handler({ queryStringParameters: {} })).statusCode).toBe(502)
  })

  it('reports a thrown error', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    const res = await handler({ queryStringParameters: {} })
    expect(res.statusCode).toBe(500)
    expect(res.body).toMatch(/offline/)
  })

  it('normalizes the team spellings the feed and the app disagree about', async () => {
    // OpenFootball writes "Czech Republic" and "Turkey"; the app uses the names
    // those associations use. A mismatch here silently drops a ?teams= filter.
    global.fetch = ok({ matches: [match({ team1: 'Czech Republic', team2: 'Turkey' })] })
    const body = (await handler({ queryStringParameters: {} })).body
    expect(body).toContain('SUMMARY:World Cup: Czechia vs Türkiye')
  })

  it('reads a kickoff stated in plain UTC, with no offset', async () => {
    global.fetch = ok({ matches: [match({ time: '18:00 UTC' })] })
    expect((await handler({ queryStringParameters: {} })).body).toContain('DTSTART:20260611T180000Z')
  })

  it('falls back to a generic group label, and to no venue at all', async () => {
    // Both are shapes OpenFootball actually produces mid-tournament: a matchday
    // row before the group is filled in, and a fixture with no ground yet.
    global.fetch = ok({ matches: [match({ group: undefined, ground: undefined })] })
    const body = (await handler({ queryStringParameters: {} })).body
    expect(body).toContain('DESCRIPTION:Group stage')
    expect(body).toContain('LOCATION:')
  })

  it('keeps an unrecognized round label as the feed wrote it', async () => {
    global.fetch = ok({ matches: [match({ round: 'Play-off', group: undefined })] })
    expect((await handler({ queryStringParameters: {} })).body).toContain('DESCRIPTION:Play-off')
  })

  it('still emits an event when the feed has a score object with no result in it', async () => {
    // OpenFootball writes the score object as soon as a match starts, before
    // either full-time or extra-time arrays exist.
    global.fetch = ok({ matches: [match({ num: 6, score: {} })] })
    const body = (await handler({ queryStringParameters: {} })).body
    expect(events(body)).toBe(1)
    expect(body).not.toMatch(/SUMMARY:.*\(/)
  })

  it('builds an id for a match with neither a number nor a named side', async () => {
    global.fetch = ok({ matches: [match({ num: undefined, team1: undefined, round: 'Final' })] })
    expect((await handler({ queryStringParameters: {} })).body).toContain('@worldcupviewer')
  })
})
