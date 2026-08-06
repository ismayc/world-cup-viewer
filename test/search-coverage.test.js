import { describe, it, expect } from 'vitest'
import { parseQuery, matchesSearch } from '../src/utils/search.js'
import { MATCHES } from '../src/data/matches.js'
import { VENUES } from '../src/data/venues.js'

const groupMatch = MATCHES.find((m) => m.stage === 'Group')
const venueOf = (m) => VENUES[m.venue]

describe('parseQuery', () => {
  it('returns free text only when there are no field markers', () => {
    expect(parseQuery('Brazil')).toEqual({ free: 'Brazil', tokens: [] })
  })

  it('handles empty/undefined input', () => {
    expect(parseQuery(undefined)).toEqual({ free: '', tokens: [] })
  })

  it('parses scoped field tokens', () => {
    const { tokens } = parseQuery('team: Mexico city: Dallas')
    expect(tokens).toContainEqual({ field: 'team', value: 'Mexico' })
    expect(tokens).toContainEqual({ field: 'city', value: 'Dallas' })
  })

  it('treats an unknown field as free text', () => {
    const { free, tokens } = parseQuery('bogus: value')
    expect(tokens).toEqual([])
    expect(free).toContain('value')
  })

  it('keeps leading free text before the first marker', () => {
    const { free, tokens } = parseQuery('azteca city: Dallas')
    expect(free).toBe('azteca')
    expect(tokens).toContainEqual({ field: 'city', value: 'Dallas' })
  })
})

describe('matchesSearch — token fields', () => {
  const v = venueOf(groupMatch)

  const run = (m, parsed) => matchesSearch(m, venueOf(m), parsed)

  it('matches a team token', () => {
    expect(run(groupMatch, { tokens: [{ field: 'team', value: groupMatch.t1.slice(0, 3) }], free: '' })).toBe(true)
  })

  it('matches a city token', () => {
    expect(run(groupMatch, { tokens: [{ field: 'city', value: v.city }], free: '' })).toBe(true)
  })

  it('matches a stadium token', () => {
    expect(run(groupMatch, { tokens: [{ field: 'stadium', value: v.name.slice(0, 4) }], free: '' })).toBe(true)
  })

  it('matches a region token', () => {
    expect(run(groupMatch, { tokens: [{ field: 'region', value: v.region }], free: '' })).toBe(true)
  })

  it('matches a country token, incl. USA synonyms', () => {
    const usMatch = MATCHES.find((m) => VENUES[m.venue]?.country === 'USA')
    expect(matchesSearch(usMatch, VENUES[usMatch.venue], { tokens: [{ field: 'country', value: 'america' }], free: '' })).toBe(true)
    expect(matchesSearch(usMatch, VENUES[usMatch.venue], { tokens: [{ field: 'country', value: 'germany' }], free: '' })).toBe(false)
  })

  it('matches a group token (stripping the "group " prefix)', () => {
    expect(run(groupMatch, { tokens: [{ field: 'group', value: `group ${groupMatch.group}` }], free: '' })).toBe(true)
  })

  it('matches a stage token via synonym', () => {
    expect(run(groupMatch, { tokens: [{ field: 'stage', value: 'gs' }], free: '' })).toBe(true)
  })

  it('matches a stage token via the label fallback', () => {
    // "group" stage's label includes "stage" — exercise the label .includes path
    // for a value not in STAGE_SYN.
    expect(run(groupMatch, { tokens: [{ field: 'stage', value: 'stage' }], free: '' })).toBe(true)
  })

  it('returns true for an unknown field (default switch case)', () => {
    expect(run(groupMatch, { tokens: [{ field: 'nope', value: 'x' }], free: '' })).toBe(true)
  })

  it('returns false when a token does not match', () => {
    expect(run(groupMatch, { tokens: [{ field: 'team', value: 'zzzzz' }], free: '' })).toBe(false)
  })
})

describe('matchesSearch — free text', () => {
  it('matches against the combined haystack', () => {
    expect(matchesSearch(groupMatch, venueOf(groupMatch), { tokens: [], free: groupMatch.t1.toLowerCase() })).toBe(true)
  })

  it('fails when free text is absent from the haystack', () => {
    expect(matchesSearch(groupMatch, venueOf(groupMatch), { tokens: [], free: 'zzzzz-nope' })).toBe(false)
  })

  it('builds the haystack with a group fragment when present', () => {
    expect(matchesSearch(groupMatch, venueOf(groupMatch), { tokens: [], free: `group ${groupMatch.group}`.toLowerCase() })).toBe(true)
  })

  it('handles a knockout match (no group) in the haystack', () => {
    // Free text has to be non-empty or the haystack is never built at all — the
    // point here is that a match with no group leaves that fragment blank
    // instead of writing "group undefined" into what is searched.
    const ko = MATCHES.find((m) => m.stage !== 'Group')
    expect(matchesSearch(ko, venueOf(ko), { tokens: [], free: ko.t1.toLowerCase() })).toBe(true)
    expect(matchesSearch(ko, venueOf(ko), { tokens: [], free: 'group undefined' })).toBe(false)
  })

  it('drops a field prefix with nothing after it', () => {
    // Mid-typing: "venue:" with no value yet. There is nothing to search for, so
    // it becomes neither a token nor free text.
    const parsed = parseQuery('colour:')
    expect(parsed.tokens).toEqual([])
    expect(parsed.free).toBe('')
  })

  it('treats an unrecognised field prefix as free text rather than dropping it', () => {
    // Someone types "colour:red". There is no such field, so the value has to
    // fall through to the free-text search rather than silently vanishing.
    const parsed = parseQuery('colour:zzzzz-nope')
    expect(parsed.tokens).toEqual([])
    expect(parsed.free).toBe('zzzzz-nope')
  })
})
