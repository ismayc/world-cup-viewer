import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import Standings from '../src/components/Standings.jsx'
import { MATCHES } from '../src/data/matches.js'

const renderStandings = (matches, opener = () => {}) =>
  render(
    <FollowProvider>
      <DetailContext.Provider value={opener}>
        <Standings matches={matches} tz="America/New_York" hideScores={false} clinch={{}} />
      </DetailContext.Provider>
    </FollowProvider>,
  )

// Give Group A one finished result so the modal has both a result and upcoming games.
const withGroupAResult = () =>
  MATCHES.map((m) => (m.num === 1 ? { ...m, score: [2, 1] } : m))

describe('Group games pop-up', () => {
  it('shows only the selected team’s three matches when a team is clicked', () => {
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
})
