import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import Standings from '../src/components/Standings.jsx'
import { MATCHES } from '../src/data/matches.js'
import { computeClinch } from '../src/utils/clinch.js'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'

const renderStandings = (matches, opener = () => {}, clinch = {}) =>
  render(
    <FollowProvider>
      <DetailContext.Provider value={opener}>
        <Standings matches={matches} tz="America/New_York" hideScores={false} clinch={clinch} />
      </DetailContext.Provider>
    </FollowProvider>,
  )

// Give Group A one finished result so the modal has both a result and upcoming games.
const withGroupAResult = () =>
  MATCHES.map((m) => (m.num === 1 ? { ...m, score: [2, 1] } : m))

// A real group-stage snapshot (Groups A/B/C/E/F done, the rest on matchday 3),
// where USA vs Bosnia is mathematically locked. Used for the settled-matchup case.
const snapshot = MATCHES.map((m) =>
  m.stage === 'Group' && GROUP_STAGE_MD3[m.num] ? { ...m, score: GROUP_STAGE_MD3[m.num] } : m,
)

describe('Group games pop-up', () => {
  // Pinned between Mexico's first game (M1, Jun 11) and their second (M28,
  // Jun 18): on the real clock every fixture is in the past, so "Still to play"
  // renders empty and the assertion below passes against an unconditional
  // heading rather than against actual upcoming fixtures.
  it('shows only the selected team’s three matches when a team is clicked', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    try {
      renderStandings(withGroupAResult())

      fireEvent.click(screen.getByRole('button', { name: 'Mexico' }))

      const dialog = screen.getByRole('dialog')
      expect(dialog.querySelector('.gg-head-team')).toHaveTextContent('Mexico')
      // A team plays exactly three group-stage games.
      expect(dialog.querySelectorAll('.gg-fixture')).toHaveLength(3)
      // Played section shows the finished result; still-to-play lists the rest.
      expect(within(dialog).getByText('Results')).toBeInTheDocument()
      expect(within(dialog).getByText('Still to play')).toBeInTheDocument()
      expect(within(dialog).getByText('2–1')).toBeInTheDocument()
      // The section is genuinely populated: M28 and M53 are still ahead.
      const upcoming = dialog.querySelectorAll('.md-section')[1]
      expect(upcoming.querySelectorAll('.gg-fixture')).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the whole group’s six matches when the group title is clicked', () => {
    renderStandings(withGroupAResult())

    fireEvent.click(screen.getByRole('button', { name: 'Group A' }))

    const dialog = screen.getByRole('dialog')
    // A four-team group plays six matches in all.
    expect(dialog.querySelectorAll('.gg-fixture')).toHaveLength(6)
  })

  it('clicking a fixture opens the match detail view', () => {
    let opened = null
    renderStandings(withGroupAResult(), (m) => {
      opened = m
    })

    fireEvent.click(screen.getByRole('button', { name: 'Mexico' }))
    const dialog = screen.getByRole('dialog')
    // The finished fixture row (Mexico v South Africa) opens its detail.
    fireEvent.click(within(dialog).getByText('2–1').closest('button'))

    expect(opened?.num).toBe(1)
  })

  it('shows a tip describing the team / group click functionality', () => {
    renderStandings(MATCHES)
    const tip = document.querySelector('.standings-tip')
    expect(tip).toBeInTheDocument()
    expect(tip).toHaveTextContent(/click a team name/i)
    expect(tip).toHaveTextContent(/group title/i)
  })

  it('shows the Round-of-32 matchup for a team that has clinched a place', () => {
    renderStandings(MATCHES, () => {}, { Mexico: 'won-group' })

    fireEvent.click(screen.getByRole('button', { name: 'Mexico' }))
    const ko = document.querySelector('.gg-knockout')
    expect(ko).toBeInTheDocument()
    expect(ko).toHaveTextContent(/Round of 32/i)
    expect(ko).toHaveTextContent(/qualified for the knockout round/i)
    // The selected team appears in the projected matchup line.
    expect(ko.querySelector('.gg-ko-match')).toHaveTextContent('Mexico')
  })

  it('shows a confirmed (non-provisional) matchup when the opponent is locked', () => {
    // Live snapshot: USA's Round-of-32 opponent (Bosnia) is mathematically locked
    // even though other groups are still playing.
    renderStandings(snapshot, () => {}, computeClinch(snapshot))

    fireEvent.click(screen.getByRole('button', { name: 'USA' }))
    const ko = document.querySelector('.gg-knockout')
    expect(ko).toBeInTheDocument()
    expect(ko.querySelector('.gg-ko-match')).toHaveTextContent('Bosnia & Herzegovina')
    expect(ko.querySelector('.gg-ko-confirmed')).toBeInTheDocument()
    expect(ko.querySelector('.gg-ko-note')).toBeNull()
  })

  it('keeps the "provisional" note while the opponent can still change', () => {
    renderStandings(MATCHES, () => {}, { Mexico: 'won-group' })

    fireEvent.click(screen.getByRole('button', { name: 'Mexico' }))
    const ko = document.querySelector('.gg-knockout')
    expect(ko).toBeInTheDocument()
    expect(ko.querySelector('.gg-ko-confirmed')).toBeNull()
    expect(ko.querySelector('.gg-ko-note')).toBeInTheDocument()
  })

  it('omits the Round-of-32 section for a team that has not clinched', () => {
    renderStandings(MATCHES) // empty clinch map

    fireEvent.click(screen.getByRole('button', { name: 'Mexico' }))
    expect(document.querySelector('.gg-knockout')).toBeNull()
  })

  it('shows no knockout section when a group title (no single team) is opened', () => {
    renderStandings(MATCHES, () => {}, { Mexico: 'won-group' })

    fireEvent.click(screen.getByRole('button', { name: 'Group A' }))
    expect(document.querySelector('.gg-knockout')).toBeNull()
  })
})
