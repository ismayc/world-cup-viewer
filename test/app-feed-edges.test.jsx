import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { fetchResults } from '../src/services/results.js'
import { fetchLive } from '../src/services/espn.js'

// Two states the results feed can leave the app in that a scoreboard payload
// cannot express, so they are driven by stubbing the service outright: the
// request was ABORTED (superseded by another load), which must not be reported
// as a failure, and it genuinely failed, which must. Everything else about the
// feeds is exercised against real payloads in app-coverage.test.jsx.
vi.mock('../src/services/results.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchResults: vi.fn(async () => new Map()) }
})
vi.mock('../src/services/espn.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchLive: vi.fn(async () => new Map()) }
})

const App = (await import('../src/App.jsx')).default

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [] }) }))
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  fetchResults.mockReset()
  fetchResults.mockResolvedValue(new Map())
  fetchLive.mockReset()
  fetchLive.mockResolvedValue(new Map())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App — what the results feed can leave behind', () => {
  it('stays quiet when the results request was aborted rather than failing', async () => {
    // A second load supersedes the first: the abort is the app's own doing, so
    // telling the reader the feed is unreachable would be wrong.
    fetchResults.mockRejectedValue(
      Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }),
    )
    render(<App />)
    await waitFor(() => expect(fetchResults).toHaveBeenCalled())
    expect(screen.queryByText(/Couldn’t reach results feed/)).toBeNull()
  })

  it('still reports a genuine results failure', async () => {
    fetchResults.mockRejectedValue(new Error('offline'))
    render(<App />)
    expect(await screen.findByText(/Couldn’t reach results feed/)).toBeInTheDocument()
  })
})
