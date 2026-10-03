import { describe, it, expect, vi } from 'vitest'
import { fetchLive } from '../src/services/espn.js'

// A KICKOFF ESPN HAS NOT ANNOUNCED.
//
// `timeValid: false` means the DATE is set and the time is not, and what ESPN sends in
// its place is midnight US Eastern that day. Two things must not happen with it: it must
// not be used to MATCH a knockout fixture (every placeholder on a given date shares the
// same instant, so the key pairs whichever two games happen to collide), and it must not
// be read as a kickoff (an invented time, on the previous evening west of Eastern).
// See sports-viewer-meta/docs/LINEAGES.md §6.
const feed = ({ timeValid, date }) => ({
  events: [
    {
      id: '401700555',
      date,
      status: { type: { state: 'pre', description: 'Scheduled' }, period: 0 },
      competitions: [
        {
          ...(timeValid === undefined ? {} : { timeValid }),
          competitors: [
            { homeAway: 'home', team: { displayName: 'Brazil' }, score: '0' },
            { homeAway: 'away', team: { displayName: 'Croatia' }, score: '0' },
          ],
        },
      ],
    },
  ],
})
const mock = (payload) => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => payload }))
}

describe('a kickoff ESPN has not announced', () => {
  it('is not indexed as a kickoff instant', async () => {
    mock(feed({ timeValid: false, date: '2030-06-20T04:00Z' }))
    const map = await fetchLive(undefined, ['20300620'])
    expect([...map.values()][0].instant).toBeNull()
    // Nothing is keyed on the placeholder, so no fixture can be matched by it.
    expect([...map.keys()].some((k) => k.startsWith('inst:'))).toBe(false)
  })

  it('still indexes a real kickoff, which is what knockout matching relies on', async () => {
    mock(feed({ timeValid: true, date: '2030-06-20T19:00Z' }))
    const map = await fetchLive(undefined, ['20300620'])
    const inst = Date.parse('2030-06-20T19:00Z')
    expect([...map.values()][0].instant).toBe(inst)
    expect(map.get('inst:' + inst)).toBeTruthy()
  })

  it('treats a feed that omits the flag as a real kickoff, as it always did', async () => {
    mock(feed({ timeValid: undefined, date: '2030-06-20T19:00Z' }))
    const map = await fetchLive(undefined, ['20300620'])
    expect([...map.values()][0].instant).toBe(Date.parse('2030-06-20T19:00Z'))
  })
})
