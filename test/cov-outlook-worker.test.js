import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { MATCHES } from '../src/data/matches.js'

// The worker module assigns `self.onmessage` at import (in jsdom, self === window).
// We drive it directly and capture what it posts back via a stubbed postMessage.
describe('outlook.worker', () => {
  let posts
  beforeEach(async () => {
    posts = []
    await import('../src/workers/outlook.worker.js') // sets self.onmessage (cached after first import)
    self.postMessage = (m) => posts.push(m)
  })

  it('enumerates a settled group stage and posts progress + done (survivors, requirements)', () => {
    // All group games final → enumeration is trivial (1 outcome) but still runs the
    // full handler: enumerateOutlook fires its final onProgress (→ a progress post)
    // and the survivors/requirements pass, then a done message.
    const complete = MATCHES.map((m) => (m.stage === 'Group' ? { ...m, score: [1, 0] } : m))
    self.onmessage({ data: complete })

    expect(posts.some((p) => p.type === 'progress')).toBe(true)
    const done = posts.find((p) => p.type === 'done')
    expect(done).toBeTruthy()
    expect(done.result && typeof done.result === 'object').toBe(true)
    expect(Array.isArray(done.survivors)).toBe(true)
    expect(done.requirements && typeof done.requirements === 'object').toBe(true)
  })

  it('reports a thrown value that carries no message', async () => {
    // Whatever comes out of the enumerator has to cross the worker boundary as a
    // string: a thrown value with no `.message` (anything that isn't an Error)
    // must still reach the page as text rather than as "undefined".
    vi.resetModules()
    vi.doMock('../src/utils/outlookEnum.js', () => ({
      enumerateOutlook: () => {
        throw 'the enumerator gave up'
      },
    }))
    try {
      await import('../src/workers/outlook.worker.js')
      const seen = []
      self.postMessage = (m) => seen.push(m)
      self.onmessage({ data: [] })
      expect(seen).toEqual([{ type: 'error', message: 'the enumerator gave up' }])
    } finally {
      vi.doUnmock('../src/utils/outlookEnum.js')
      vi.resetModules()
    }
  })

  afterAll(() => {
    // The worker sets a module-level listener on `self`; leave the environment
    // as we found it for anything else sharing this jsdom.
    delete self.onmessage
  })

  it('posts an error message when enumeration throws', () => {
    // Bad input → countRemaining(undefined) throws inside the try → error branch.
    self.onmessage({ data: null })
    const err = posts.find((p) => p.type === 'error')
    expect(err).toBeTruthy()
    expect(typeof err.message).toBe('string')
  })
})
