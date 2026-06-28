import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

    // Wide text verdicts drop to their own line (q-wide); the single-glyph "✓"
    // qualification mark stays inline beside the name.
    const badgeIn = (team) => rowFor(team).querySelector('.col-team .q-badge')
    expect(badgeIn('Mexico').classList.contains('q-wide')).toBe(true) // 🥇 Won group
    expect(badgeIn('South Africa').classList.contains('q-wide')).toBe(true) // ❌ Eliminated
    expect(badgeIn('Czechia').classList.contains('q-wide')).toBe(true) // Provisional 3rd
    expect(badgeIn('South Korea').classList.contains('q-wide')).toBe(false) // ✓ stays inline
    // The provisional ✓ spells out that it's contingent on current results,
    // across two lines.
    expect(badgeIn('South Korea').getAttribute('title')).toBe(
      'Advances to the Round of 32\n(if current match status holds)',
    )
  })

  it('tints the best-third table per clinch: bubble yellow, clinched green, out red', () => {
    // Only Group A complete → Czechia is its (sole) third-placed team, so it is
    // the lone row in the best-third table.
    const fixture = MATCHES.map((m) => {
      if (m.stage === 'Group' && m.group === 'A') {
        const s = { 1: [2, 0], 2: [2, 0], 25: [2, 0], 28: [1, 0], 53: [0, 2], 54: [0, 1] }[m.num]
        return { ...m, score: s }
      }
      return m
    })
    const classFor = (clinch) => {
      const { container, unmount } = render(
        <FollowProvider>
          <Standings matches={fixture} hideScores={false} clinch={clinch} />
        </FollowProvider>,
      )
      const row = [...container.querySelectorAll('.thirds-card tbody tr')].find(
        (tr) => tr.querySelector('.row-team')?.textContent === 'Czechia',
      )
      const cls = row?.className
      unmount()
      return cls
    }
    expect(classFor({})).toBe('provisional') // undecided, currently top 8 → yellow
    expect(classFor({ Czechia: 'third' })).toBe('qualifies') // clinched best-third → green
    expect(classFor({ Czechia: 'eliminated' })).toBe('eliminated') // out → red
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

  it('marks each best-third row final (group done) or "to play" (still in progress)', () => {
    // Group A complete (Czechia 3rd, final); every other group has matchday 1
    // played, so their provisional thirds are still "to play".
    const fixture = MATCHES.map((m) => {
      if (m.stage !== 'Group') return m
      if (m.group === 'A') {
        const s = { 1: [2, 0], 2: [2, 0], 25: [2, 0], 28: [1, 0], 53: [0, 2], 54: [0, 1] }[m.num]
        return s ? { ...m, score: s } : m
      }
      // One match per other group (matchday 1) → started but not complete.
      return [3, 9, 14, 17, 19, 21, 22, 6, 4, 10, 13].includes(m.num) ? { ...m, score: [1, 0] } : m
    })
    const { container } = render(
      <FollowProvider>
        <Standings matches={fixture} hideScores={false} />
      </FollowProvider>,
    )
    const rowFor = (team) =>
      [...container.querySelectorAll('.thirds-card tbody tr')].find(
        (tr) => tr.querySelector('.row-team')?.textContent === team,
      )
    // Czechia's group (A) is complete → "final".
    expect(rowFor('Czechia')?.querySelector('.third-final')).toBeTruthy()
    expect(rowFor('Czechia')?.querySelector('.third-toplay')).toBeFalsy()
    // At least one third from an unfinished group is flagged "to play".
    expect(container.querySelectorAll('.thirds-card .third-toplay').length).toBeGreaterThan(0)
  })

  it('marks a third whose group has a live match as "in play" with a blinking dot, not "final"', () => {
    // Group A's six games all carry a score, but one (m53, involving Czechia) is
    // still LIVE — so the line is provisional, not final.
    const fixture = MATCHES.map((m) => {
      if (m.stage !== 'Group' || m.group !== 'A') return m
      const s = { 1: [2, 0], 2: [2, 0], 25: [2, 0], 28: [1, 0], 53: [0, 2], 54: [0, 1] }[m.num]
      const base = s ? { ...m, score: s } : m
      return m.num === 53 ? { ...base, live: { clock: "60'", detail: '' } } : base
    })
    const { container } = render(
      <FollowProvider>
        <Standings matches={fixture} hideScores={false} />
      </FollowProvider>,
    )
    const czechia = [...container.querySelectorAll('.thirds-card tbody tr')].find(
      (tr) => tr.querySelector('.row-team')?.textContent === 'Czechia',
    )
    // In play, not final — and the live red dot is present.
    expect(czechia?.querySelector('.third-live')).toBeTruthy()
    expect(czechia?.querySelector('.third-final')).toBeFalsy()
    expect(czechia?.querySelector('.row-live-dot')).toBeTruthy()
  })

  it('lists a currently-4th, not-yet-eliminated team as an in-contention third', () => {
    // Group A complete; Group B has only matchday 1 played, so it has a current
    // 4th place that is nowhere near eliminated → shown as a contender.
    const fixture = MATCHES.map((m) => {
      if (m.stage !== 'Group') return m
      if (m.group === 'A') {
        const s = { 1: [2, 0], 2: [2, 0], 25: [2, 0], 28: [1, 0], 53: [0, 2], 54: [0, 1] }[m.num]
        return s ? { ...m, score: s } : m
      }
      // Group B matchday 1 only: matches 3 and 5.
      return m.group === 'B' && (m.num === 3 || m.num === 5) ? { ...m, score: [1, 0] } : m
    })
    const { container } = render(
      <FollowProvider>
        <Standings matches={fixture} hideScores={false} />
      </FollowProvider>,
    )
    // The contention divider renders and there is at least one contender row.
    expect(screen.getByText(/Still in contention/)).toBeInTheDocument()
    const contenderRows = container.querySelectorAll('.thirds-card tbody tr.contender')
    expect(contenderRows.length).toBeGreaterThan(0)
    // A contender is not in the numbered list (dash instead of a rank).
    expect(contenderRows[0].querySelector('.rank-dash')).toBeTruthy()
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

  it('explains a soft tie-breaker between adjacent thirds with their values', () => {
    // Every group drawn 1–1 → all four teams in each group sit on 3 pts, GD 0,
    // GF 3, so every third-placed team is level on points/GD/goals and the order
    // comes down to conduct, then FIFA ranking. The note below the table spells
    // each pairing out with the deciding values.
    const allDrawn = MATCHES.map((m) => (m.stage === 'Group' ? { ...m, score: [1, 1] } : m))
    const { container } = render(
      <FollowProvider>
        <Standings matches={allDrawn} hideScores={false} />
      </FollowProvider>,
    )
    const note = container.querySelector('.thirds-tie-note')
    expect(note).toBeTruthy()
    expect(within(note).getByText(/Tie-breakers among the thirds/)).toBeInTheDocument()
    const items = note.querySelectorAll('li')
    expect(items.length).toBeGreaterThan(0)
    // Each explanation states the shared level and the deciding criterion + values.
    expect(note.textContent).toMatch(/level on points \(3\)/)
    expect(note.textContent).toMatch(/goals scored \(3\)/)
    // No cards in the fixture → the decider is FIFA ranking, shown with #numbers.
    expect(note.textContent).toMatch(/FIFA ranking/)
    expect(note.textContent).toMatch(/#\d+/)
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
