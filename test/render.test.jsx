import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import App from '../src/App.jsx'
import Standings from '../src/components/Standings.jsx'
import Bracket from '../src/components/Bracket.jsx'
import MatchCard from '../src/components/MatchCard.jsx'
import { MATCHES } from '../src/data/matches.js'
import { groupSlotMap } from '../src/utils/bracket.js'
import { resolveClinchedSlots } from '../src/utils/clinch.js'
import { DetailContext } from '../src/context/detail.js'
import { FollowProvider } from '../src/context/follow.jsx'

// Mock the results feed so mount doesn't hit the network.
beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) }))
  window.history.replaceState(null, '', '/')
})

describe('App renders (smoke test)', () => {
  // This is the test that would have caught the "black page" crash: a component
  // using a hook without importing it throws on render, and render() rejects.
  it('mounts without crashing and shows the header + views', () => {
    render(<App />)
    expect(screen.getByText(/World Cup 2026/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Schedule/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Week/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Groups/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bracket/ })).toBeInTheDocument()
  })

  it('keeps the filter panel and search collapsed by default', () => {
    render(<App />)
    // Only a compact toggle shows; the panel, search button, and dropdowns are hidden.
    expect(screen.getByRole('button', { name: /Filters & Search/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /🔍 Search/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Group')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/team: Mexico/)).not.toBeInTheDocument()
  })

  it('opens the panel, then the search, and filters with a scoped query', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Filters & Search/ }))
    fireEvent.click(screen.getByRole('button', { name: /🔍 Search/ }))
    const input = screen.getByPlaceholderText(/team: Mexico/)
    fireEvent.change(input, { target: { value: 'team: Mexico' } })
    // Mexico plays 3 group matches.
    expect(screen.getByText(/^3 matches$/)).toBeInTheDocument()
  })

  it('shows an active-filter count and "Clear all" when a filter is applied', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Filters & Search/ }))
    fireEvent.click(screen.getByRole('button', { name: /🔍 Search/ }))
    fireEvent.change(screen.getByPlaceholderText(/team: Mexico/), {
      target: { value: 'team: Brazil' },
    })
    expect(screen.getByRole('button', { name: /Clear all/ })).toBeInTheDocument()
    // Clearing resets results back to all 104 matches.
    fireEvent.click(screen.getByRole('button', { name: /Clear all/ }))
    expect(screen.queryByRole('button', { name: /Clear all/ })).not.toBeInTheDocument()
  })

  it('switches to each view without crashing', () => {
    render(<App />)
    for (const name of [/Week/, /Groups/, /Bracket/, /Schedule/]) {
      fireEvent.click(screen.getByRole('button', { name }))
    }
    // Bracket/standings rendered fine; header still present.
    expect(screen.getByText(/World Cup 2026/)).toBeInTheDocument()
  })

  it('renders all 4 group tables in the Groups view', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Groups/ }))
    expect(screen.getByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Group L')).toBeInTheDocument()
  })

  it('opens the match-detail modal from a card', () => {
    // Pin mid-tournament so the schedule shows match cards regardless of the
    // real date (post-tournament, every day is collapsed/complete).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      render(<App />)
      // Expand a collapsed day if no card is currently visible.
      if (screen.queryAllByRole('button', { name: /Details/ }).length === 0) {
        const toggle = document.querySelector('.day-toggle')
        if (toggle) fireEvent.click(toggle)
      }
      fireEvent.click(screen.getAllByRole('button', { name: /Details/ })[0])
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(within(dialog).getByText(/How to watch/)).toBeInTheDocument()
      expect(within(dialog).getByText(/Stadium local/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('toggles the color theme', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Toggle theme/ }))
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: /Toggle theme/ }))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('shows a NextMatch countdown hero', () => {
    // Pin mid-tournament so there's an upcoming match to count down to (post-
    // tournament the hero shows the champions banner instead).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      render(<App />)
      expect(screen.getByText(/Next match|Your next match|Live now/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows past days folded by default, expandable per-day, and hideable entirely', () => {
    // Pin "now" mid-tournament so the June 11 opener is firmly in the past.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      render(<App />)
      // Past days appear as collapsed sections by default (no match cards yet).
      const opener = screen.getByRole('button', { name: /June 11, 2026/ })
      expect(opener).toHaveAttribute('aria-expanded', 'false')
      const openerDay = opener.closest('section.day')
      expect(within(openerDay).queryByRole('button', { name: /Details/ })).not.toBeInTheDocument()
      // Each past day still expands individually on click.
      fireEvent.click(opener)
      expect(opener).toHaveAttribute('aria-expanded', 'true')
      expect(within(openerDay).getAllByRole('button', { name: /Details/ }).length).toBeGreaterThan(0)
      // "Hide past days" drops them from the schedule entirely; "Show" brings
      // them back (folded again).
      fireEvent.click(screen.getByRole('button', { name: /Hide past days/ }))
      expect(screen.queryByRole('button', { name: /June 11, 2026/ })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Show past days/ }))
      expect(screen.getByRole('button', { name: /June 11, 2026/ })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps today and future days expanded by default', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      render(<App />)
      // The final (July 19, 2026) is in the future — its day starts open.
      const futureDay = screen.getByRole('button', { name: /July 19, 2026/ })
      expect(futureDay).toHaveAttribute('aria-expanded', 'true')
    } finally {
      vi.useRealTimers()
    }
  })

})

describe('Standings clinch badges', () => {
  it('renders the clinch verdict next to a team when provided', () => {
    const clinch = { Mexico: 'won-group', Brazil: 'eliminated' }
    render(
      <FollowProvider>
        <Standings matches={MATCHES} hideScores={false} clinch={clinch} />
      </FollowProvider>,
    )
    // Badges render as "🥇 Won group" / "❌ Eliminated" (emoji + text in one
    // node), and also appear in the legend — so match flexibly and expect ≥1.
    expect(screen.getAllByText(/Won group/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Eliminated/).length).toBeGreaterThan(0)
  })
})

describe('Schedule team-name slot tooltip', () => {
  const groupMatch = MATCHES.find((m) => m.num === 28) // Mexico v South Korea (Group A)

  function renderCard(clinch, slotMap = groupSlotMap(MATCHES)) {
    return render(
      <FollowProvider>
        <DetailContext.Provider value={() => {}}>
          <MatchCard match={groupMatch} tz="America/New_York" clinch={clinch} slotMap={slotMap} />
        </DetailContext.Provider>
      </FollowProvider>,
    )
  }

  it('shows the conditional knockout route when undecided', () => {
    renderCard({})
    const title = screen.getByText('Mexico').getAttribute('title')
    expect(title).toMatch(/Group A knockout route/)
    expect(title).toMatch(/1st → Round of 32 · Match 79/)
    expect(title).toMatch(/2nd → Round of 32 · Match 73/)
  })

  it('shows the definite slot once the group winner is clinched', () => {
    renderCard({ Mexico: 'won-group' })
    expect(screen.getByText('Mexico').getAttribute('title')).toBe(
      'Clinched Group A winner → Round of 32 · Match 79',
    )
  })

  it('names only the routes the slot map actually knows', () => {
    // The slot map is parsed from the published Round-of-32 labels. Before both
    // ties naming this group are drawn, one or other route is simply missing —
    // the tooltip lists what is known and never a "Match undefined".
    renderCard({}, { A: { win: null, runnerUp: null } })
    const title = screen.getByText('Mexico').getAttribute('title')
    expect(title).toMatch(/Group A knockout route/)
    expect(title).not.toMatch(/1st →/)
    expect(title).not.toMatch(/2nd →/)
    expect(title).toMatch(/3rd → a best-third tie/)
  })
})

describe('Bracket clinch resolution', () => {
  it('renders the clinched winner once slots are resolved in the match data', () => {
    // Resolution happens upstream (App) so the team flows to every view; the
    // Bracket just renders whatever names it's given.
    const resolved = resolveClinchedSlots(MATCHES, { Mexico: 'won-group' })
    render(
      <FollowProvider>
        <DetailContext.Provider value={() => {}}>
          <Bracket matches={resolved} tz="America/New_York" hideScores={false} />
        </DetailContext.Provider>
      </FollowProvider>,
    )
    // M79's first side was "Winner Group A" — now resolved to Mexico.
    expect(screen.getByText('Mexico')).toBeInTheDocument()
    expect(screen.queryByText('Winner Group A')).not.toBeInTheDocument()
    // Other, unclinched winner slots remain placeholders.
    expect(screen.getByText('Winner Group B')).toBeInTheDocument()
  })
})

describe('Follow teams', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) }))
    window.history.replaceState(null, '', '/')
    localStorage.clear()
  })

  it('following a team reveals the My Teams filter', () => {
    render(
      <FollowProvider>
        <App />
      </FollowProvider>,
    )
    expect(screen.queryByRole('button', { name: /My Teams/ })).not.toBeInTheDocument()
    // Past days collapse once the tournament is underway; expand one so a match
    // card (and its Follow buttons) is in the DOM regardless of the current date.
    if (screen.queryAllByRole('button', { name: /^Follow / }).length === 0) {
      const toggle = document.querySelector('.day-toggle')
      if (toggle) fireEvent.click(toggle)
    }
    fireEvent.click(screen.getAllByRole('button', { name: /^Follow / })[0])
    expect(screen.getByRole('button', { name: /My Teams/ })).toBeInTheDocument()
  })
})
