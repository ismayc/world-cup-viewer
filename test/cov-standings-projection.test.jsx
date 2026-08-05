import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Standings from '../src/components/Standings.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { MATCHES } from '../src/data/matches.js'
import { computeClinch } from '../src/utils/clinch.js'
import { FINAL_GROUP_RESULTS } from './fixtures/final-group-results.js'

// Clicking a team name opens the per-team group modal, which renders that team's
// projected knockout matchup via Standings' `teamKnockout` — exercising the `dest`
// selector (won-group → proj.first, runner-up → proj.second, else by current rank
// → first/second/third). We click teams of each clinched status to cover every arm.
// Standings takes `clinch` as a prop (App supplies it); teamKnockout returns null
// without it, so the projection selector is only reachable when it's passed.
const renderWith = (matches) =>
  render(
    <FollowProvider>
      <Standings matches={matches} hideScores={false} clinch={computeClinch(matches)} />
    </FollowProvider>,
  )

const clickTeam = (container, name) => {
  const btn = [...container.querySelectorAll('.row-team-btn')].find(
    (b) => b.textContent.trim() === name,
  )
  expect(btn, `clickable team button for ${name}`).toBeTruthy()
  fireEvent.click(btn)
}

describe('Standings — projected-matchup dest selector', () => {
  it('covers the runner-up and best-third arms on a completed group stage', () => {
    const scores = Object.assign({}, ...Object.values(FINAL_GROUP_RESULTS).map((r) => r.scores))
    const complete = MATCHES.map((m) => (scores[m.num] ? { ...m, score: scores[m.num] } : m))
    const clinch = computeClinch(complete)
    const runnerUp = Object.keys(clinch).find((n) => clinch[n] === 'runner-up')
    const third = Object.keys(clinch).find((n) => clinch[n] === 'third')
    expect(runnerUp).toBeTruthy()
    expect(third).toBeTruthy()

    const { container } = renderWith(complete)
    // Opening each team's modal runs teamKnockout → the dest selector.
    clickTeam(container, runnerUp) // status 'runner-up' → proj.second
    clickTeam(container, third) // status 'third', rank 3 → proj.third
  })

  it('covers the top-2 (order-open) rank-1 and rank-2 arms', () => {
    // Group A only: Mexico and South Korea each beat the other two and have not yet
    // met (nor have the bottom two), so both are guaranteed top-2 with order open
    // ('top2'). Mexico's bigger margins make it the current rank 1, South Korea rank 2.
    const scores = {
      1: [2, 0], // Mexico beat South Africa
      53: [0, 2], // Czechia 0–2 Mexico
      2: [1, 0], // South Korea beat Czechia
      54: [0, 1], // South Africa 0–1 South Korea
      // M28 (Mexico v South Korea) and M25 (Czechia v South Africa) unplayed.
    }
    const fixture = MATCHES.map((m) => (scores[m.num] ? { ...m, score: scores[m.num] } : m))
    const clinch = computeClinch(fixture)
    expect(clinch['Mexico']).toBe('top2')
    expect(clinch['South Korea']).toBe('top2')

    const { container } = renderWith(fixture)
    clickTeam(container, 'Mexico') // top2, current rank 1 → proj.first
    clickTeam(container, 'South Korea') // top2, current rank 2 → proj.second
  })
})

describe('Standings — projection off, and a clinch the table cannot place', () => {
  it('hides the "as it stands" block when the projection is switched off', () => {
    const scores = Object.assign({}, ...Object.values(FINAL_GROUP_RESULTS).map((r) => r.scores))
    const complete = MATCHES.map((m) => (scores[m.num] ? { ...m, score: scores[m.num] } : m))

    const { container: on } = renderWith(complete)
    expect(on.querySelector('.as-it-stands')).toBeTruthy()

    // The preference persists across visits, so a returning viewer who turned it
    // off last time gets a table with no projection attached.
    localStorage.setItem('wc2026:asItStands', '0')
    const { container: off } = renderWith(complete)
    expect(off.querySelector('.as-it-stands')).toBeNull()
    localStorage.removeItem('wc2026:asItStands')
  })

  it('offers no projected matchup for a clinched team the group table does not list', () => {
    // clinch arrives as a prop from App. If it ever names a team that is not in
    // the computed group rows — a stale verdict against a refreshed board — the
    // projection has nothing to hang off and must simply not be offered.
    const scores = Object.assign({}, ...Object.values(FINAL_GROUP_RESULTS).map((r) => r.scores))
    const complete = MATCHES.map((m) => (scores[m.num] ? { ...m, score: scores[m.num] } : m))
    const clinch = { ...computeClinch(complete), 'Nowhere United': 'won-group' }
    const { container } = render(
      <FollowProvider>
        <Standings matches={complete} hideScores={false} clinch={clinch} />
      </FollowProvider>,
    )
    // The phantom team is not in any group, so nothing about it is rendered.
    expect(container.textContent).not.toMatch(/Nowhere United/)
  })
})
