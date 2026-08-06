import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../src/App.jsx'
import { MATCHES } from '../src/data/matches.js'
import { RESULTS_SOURCE } from '../src/services/results.js'

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) }))
  window.history.replaceState(null, '', '/')
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// An OpenFootball payload that gives EVERY group match a final score, which
// archives the group stage (groupStageArchived → true). Group matches are keyed
// by the (order-independent) team pair, so reusing our schedule's team names
// matches every group fixture.
function archivedGroupsPayload() {
  return {
    matches: MATCHES.filter((m) => m.stage === 'Group').map((m) => ({
      round: 'Matchday 1',
      team1: m.t1,
      team2: m.t2,
      score: { ft: [1, 0] },
    })),
  }
}

function fetchArchived() {
  return vi.fn(async (url) => {
    if (typeof url === 'string' && url.startsWith(RESULTS_SOURCE.url)) {
      return { ok: true, json: async () => archivedGroupsPayload() }
    }
    return { ok: true, json: async () => ({ events: [], matches: [] }) }
  })
}

describe('App coverage — extra lines', () => {
  // Lines 553-558: archived group stage hint on the schedule view.
  it('shows the "group games hidden" schedule note once the group stage is archived', async () => {
    global.fetch = fetchArchived()
    render(<App />)
    // Wait for the archive to take effect (the note renders only when archived
    // and the Group filter is not selected).
    const note = await screen.findByText(/Group stage complete/)
    expect(note).toBeInTheDocument()
    expect(note.textContent).toMatch(/group games hidden/)

    // Clicking "Show group games" sets the Group stage filter and clears the note.
    const showBtn = screen.getByRole('button', { name: /Show group games/ })
    fireEvent.click(showBtn)
    await waitFor(() =>
      expect(screen.queryByText(/Group stage complete/)).not.toBeInTheDocument(),
    )
  })

  it('counts a single hidden game in the singular', () => {
    // The group stage is archived and a search narrows what is left to exactly
    // one of its fixtures: the note has to read "1 group game hidden", not
    // "1 group games hidden".
    global.fetch = fetchArchived()
    // The haystack runs the two team names together, so the opener's exact
    // pairing matches that fixture and nothing else. Restored from the URL, so
    // the search is already applied when the archive lands.
    const opener = MATCHES.find((m) => m.stage === 'Group')
    window.history.replaceState(null, '', `/?q=${encodeURIComponent(`${opener.t1} ${opener.t2}`)}`)
    render(<App />)
    return screen.findByText(/Group stage complete/).then((note) => {
      expect(note.textContent).toMatch(/1 group game hidden/)
      expect(note.textContent).not.toMatch(/group games hidden/)
    })
  })

  // Lines 609-618: the scenarios and outlook <main> blocks, which render only
  // while the group stage is NOT archived (so those tabs stay visible).
  it('falls back to the bracket when the open view is archived away underneath it', async () => {
    // A viewer sitting on Scenarios when the last group game finishes: the tab
    // disappears from the nav, so the view behind it has to move somewhere that
    // still exists rather than render an empty shell.
    window.history.replaceState(null, '', '/?view=scenarios')
    global.fetch = fetchArchived()
    render(<App />)
    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).get('view')).not.toBe('scenarios'),
    )
    expect(screen.queryByRole('button', { name: /Scenarios/ })).not.toBeInTheDocument()
  })

  it('still renders when the history backfill is refused', async () => {
    // The backfill only deepens what is already on screen; a refusal must leave
    // the committed schedule and the live window exactly as they were.
    global.fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    render(<App />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Bracket/ })).toBeInTheDocument()
  })

  it('renders the Scenarios and R32 Outlook views while the group stage is in play', async () => {
    // Stub the Web Worker that OutlookView spawns — jsdom has none.
    const origWorker = global.Worker
    class FakeWorker {
      constructor() {}
      postMessage() {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    }
    global.Worker = FakeWorker
    try {
      // Default fetch leaves the group stage unplayed → analysis tabs visible.
      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: /Scenarios/ }))
      expect(document.querySelector('main.scenarios-view')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /R32 Outlook/ }))
      expect(document.querySelector('main.outlook-view')).toBeInTheDocument()
    } finally {
      global.Worker = origWorker
    }
  })
})
