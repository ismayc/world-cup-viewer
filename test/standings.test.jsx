import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Standings from '../src/components/Standings.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { MATCHES } from '../src/data/matches.js'

// Build a set of matches with some Group A results played so "As it stands"
// projection, badges and the played path all render.
function withGroupAPlayed() {
  return MATCHES.map((m) => {
    if (m.stage === 'Group' && m.group === 'A') {
      return { ...m, score: [2, 0] }
    }
    return m
  })
}

const renderStandings = (props = {}) =>
  render(
    <FollowProvider>
      <Standings matches={MATCHES} hideScores={false} {...props} />
    </FollowProvider>,
  )

describe('Standings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the legend, toolbar and group tables', () => {
    renderStandings()
    expect(screen.getByText(/Top two advance/)).toBeInTheDocument()
    expect(screen.getByText('Group A')).toBeInTheDocument()
    // No matches played -> the per-group note is shown.
    expect(screen.getAllByText('No matches played yet').length).toBeGreaterThan(0)
  })

  it('shows clinch badges when clinch verdicts are passed', () => {
    renderStandings({ clinch: { Mexico: 'won-group', Brazil: 'eliminated' } })
    // The won-group badge text also appears in the legend, so >1.
    expect(screen.getAllByText(/Won group/).length).toBeGreaterThan(1)
    // The eliminated badge renders its own "Eliminated" text in a row.
    expect(screen.getByText(/Eliminated/)).toBeInTheDocument()
  })

  it('tints group rows green / yellow / red by qualification outlook', () => {
    // Only Group A complete: Mexico 9 (1st), South Korea 6 (2nd), Czechia 3
    // (3rd — a provisional best-third while other groups play), South Africa 0.
    const fixture = MATCHES.map((m) => {
      if (m.stage === 'Group' && m.group === 'A') {
        const s = { 1: [2, 0], 2: [2, 0], 25: [2, 0], 28: [1, 0], 53: [0, 2], 54: [0, 1] }[m.num]
        return { ...m, score: s }
      }
      return m
    })
    const { container } = render(
      <FollowProvider>
        <Standings
          matches={fixture}
          hideScores={false}
          clinch={{ Mexico: 'won-group', 'South Africa': 'eliminated' }}
        />
      </FollowProvider>,
    )
    const rowFor = (team) =>
      [...container.querySelectorAll('.standings-table tbody tr')].find(
        (tr) => tr.querySelector('.row-team-btn')?.textContent === team,
      )
    expect(rowFor('Mexico').className).toBe('qualifies') // clinched winner → green
    expect(rowFor('South Korea').className).toBe('qualifies') // 2nd → green
    expect(rowFor('Czechia').className).toBe('provisional') // provisional best-third → yellow
    expect(rowFor('South Africa').className).toBe('eliminated') // out → red
  })

  it('hides standings in spoiler-free mode and reveals on click', () => {
    renderStandings({ hideScores: true })
    expect(screen.getByText(/Standings are hidden/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reveal standings/ }))
    expect(screen.getByText('Group A')).toBeInTheDocument()
  })

  it('toggles the "As it stands" projection and persists the choice', () => {
    renderStandings()
    const toggle = screen.getByRole('button', { name: /As it stands/ })
    // Default is shown.
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('wc2026:asItStands')).toBe('0')
    fireEvent.click(toggle)
    expect(localStorage.getItem('wc2026:asItStands')).toBe('1')
  })

  it('reads the persisted "hidden" projection preference on mount', () => {
    localStorage.setItem('wc2026:asItStands', '0')
    renderStandings()
    expect(screen.getByRole('button', { name: /Show .As it stands/ })).toBeInTheDocument()
  })

  it('renders the tie-breakers tooltip note', () => {
    renderStandings()
    const tb = screen.getByText('tie-breakers')
    expect(tb).toHaveAttribute('role', 'note')
    expect(tb).toHaveAttribute('data-tip')
  })

  it('renders the "As it stands" rows and follows the onGoToMatch link', () => {
    const seen = []
    render(
      <FollowProvider>
        <Standings
          matches={withGroupAPlayed()}
          hideScores={false}
          onGoToMatch={(n) => seen.push(n)}
        />
      </FollowProvider>,
    )
    // Projection title is present for the played group.
    expect(screen.getAllByText(/As it stands → Round of 32/).length).toBeGreaterThan(0)
    // The M-link buttons jump to the bracket (identified by their title).
    const links = document.querySelectorAll('button.ais-match-link')
    expect(links.length).toBeGreaterThan(0)
    fireEvent.click(links[0])
    expect(seen.length).toBe(1)
  })

  it('renders projection M-numbers as plain text when no onGoToMatch handler', () => {
    render(
      <FollowProvider>
        <Standings matches={withGroupAPlayed()} hideScores={false} />
      </FollowProvider>,
    )
    expect(screen.getAllByText(/As it stands → Round of 32/).length).toBeGreaterThan(0)
    // No link buttons when handler absent; plain M-number spans instead.
    expect(document.querySelectorAll('button.ais-match-link').length).toBe(0)
    expect(document.querySelectorAll('span.ais-match').length).toBeGreaterThan(0)
  })

  it('renders the BestThirds table once a group has played', () => {
    render(
      <FollowProvider>
        <Standings matches={withGroupAPlayed()} hideScores={false} />
      </FollowProvider>,
    )
    expect(screen.getByText('Best third-placed teams')).toBeInTheDocument()
  })

  it('shows the "outside the best 8" note for a non-qualifying third place', () => {
    // Every group plays -> some thirds fall outside the best 8.
    const allPlayed = MATCHES.map((m) =>
      m.stage === 'Group' ? { ...m, score: [1, 0] } : m,
    )
    render(
      <FollowProvider>
        <Standings matches={allPlayed} hideScores={false} />
      </FollowProvider>,
    )
    expect(screen.getAllByText('outside the best 8').length).toBeGreaterThan(0)
  })

  it('falls back to showing the projection when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      renderStandings()
      // Defaults to shown (catch returns true).
      expect(screen.getByRole('button', { name: /Hide .As it stands/ })).toBeInTheDocument()
    } finally {
      spy.mockRestore()
    }
  })

  it('swallows errors when localStorage.setItem throws on toggle', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      renderStandings()
      const toggle = screen.getByRole('button', { name: /As it stands/ })
      fireEvent.click(toggle)
      // Toggle still flips state despite the storage write failing.
      expect(toggle).toHaveAttribute('aria-pressed', 'false')
    } finally {
      spy.mockRestore()
    }
  })

  it('toggles following a team via the star button', () => {
    renderStandings()
    const stars = screen.getAllByRole('button', { name: /^Follow / })
    fireEvent.click(stars[0])
    expect(screen.getAllByRole('button', { name: /^Unfollow / }).length).toBeGreaterThan(0)
  })
})
