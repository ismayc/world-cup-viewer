import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Standings from '../src/components/Standings.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'
import { computeClinch } from '../src/utils/clinch.js'

const GROUPS = Object.keys(TEAMS)

// Apply a { matchNum: score } map, plus optional per-match overrides.
const board = (scores, over = {}) =>
  MATCHES.map((m) =>
    over[m.num]
      ? { ...m, ...over[m.num] }
      : scores[m.num]
        ? { ...m, score: scores[m.num] }
        : m,
  )

const renderStandings = (matches, clinch) =>
  render(
    <FollowProvider>
      <Standings matches={matches} hideScores={false} clinch={clinch ?? computeClinch(matches)} />
    </FollowProvider>,
  )

// Group A driven so South Korea finish third on 3 points with a POSITIVE goal
// difference: they thump Czechia and lose both other games by one.
//   2 South Korea 3-0 Czechia · 28 Mexico 1-0 South Korea · 54 South Africa 1-0 South Korea
// Mexico and South Africa take 7 apiece, Czechia none.
const GROUP_A = { 2: [3, 0], 28: [1, 0], 54: [1, 0], 1: [0, 0], 53: [0, 1], 25: [0, 1] }
// Group D, the same shape, so Australia finish third on exactly those numbers.
//   8 Australia 3-0 Türkiye · 29 USA 1-0 Australia · 60 Paraguay 1-0 Australia
const GROUP_D = { 8: [3, 0], 29: [1, 0], 60: [1, 0], 4: [0, 0], 59: [0, 1], 32: [0, 1] }

describe('Best thirds — a tie the table itself cannot explain', () => {
  const matches = board({ ...GROUP_A, ...GROUP_D })

  it('signs a positive goal difference in the tie-breaker note', () => {
    const { container } = renderStandings(matches)
    const note = container.querySelector('.thirds-tie-note')
    expect(note).toBeTruthy()
    const li = [...note.querySelectorAll('li')].find(
      (n) => /South Korea/.test(n.textContent) && /Australia/.test(n.textContent),
    )
    expect(li, 'a tie-note line pairing South Korea with Australia').toBeTruthy()
    // Level on points, GD and goals, and level on conduct too — so the note has
    // to fall through to the FIFA ranking rather than to fair play.
    expect(li.textContent).toMatch(/FIFA ranking/)
    // A positive goal difference is signed in the note itself.
    expect(li.textContent).toMatch(/goal difference \(\+1\)/)
  })

  it('says nothing at all when no two thirds are level', () => {
    // A complete, strictly-ordered group stage: each group's 3rd-vs-4th game is
    // won by a group-specific margin, so every third has a different goal
    // difference and there is no tie to explain.
    const scores = {}
    GROUPS.forEach((g, i) => {
      const idx = Object.fromEntries(TEAMS[g].map((t, k) => [t.name, k]))
      for (const m of MATCHES) {
        if (m.stage !== 'Group' || m.group !== g) continue
        const a = idx[m.t1]
        const b = idx[m.t2]
        const margin = Math.min(a, b) === 2 && Math.max(a, b) === 3 ? i + 1 : 1
        scores[m.num] = a < b ? [margin, 0] : [0, margin]
      }
    })
    const { container } = renderStandings(board(scores))
    // The best-thirds card is there, but carries no tie-breaker note.
    expect(container.querySelector('.thirds-card')).toBeTruthy()
    expect(container.querySelector('.thirds-tie-note')).toBeNull()
  })
})

describe('Best thirds — a third-placed team whose match is paused', () => {
  // Group A as above, but its last game is in progress AND suspended.
  const matches = board(
    { ...GROUP_A, ...GROUP_D },
    { 54: { score: [1, 0], live: { delayed: true, label: 'Suspended' } } },
  )

  it('goes gold on a third-placed team whose match is paused, not merely live', () => {
    const { container } = renderStandings(matches)
    // South Korea sit third in A and are the away side of the suspended game.
    const row = [...container.querySelectorAll('.thirds-card tbody tr')].find(
      (tr) => /South Korea/.test(tr.textContent),
    )
    expect(row, "South Korea's row in the best-thirds table").toBeTruthy()
    const dot = row.querySelector('.row-live-dot')
    expect(dot).toBeTruthy()
    expect(dot).toHaveClass('delayed')
    expect(dot.getAttribute('title')).toBe('Suspended — score is provisional')
  })
})
