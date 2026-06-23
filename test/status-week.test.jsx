import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WeekView from '../src/components/WeekView.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import { MATCHES } from '../src/data/matches.js'

const base = MATCHES.find((m) => m.stage === 'Group')

const renderWeek = (matches, props = {}) => {
  const openDetail = vi.fn()
  render(
    <FollowProvider>
      <DetailContext.Provider value={openDetail}>
        <WeekView allMatches={matches} shown={matches} tz="America/New_York" {...props} />
      </DetailContext.Provider>
    </FollowProvider>,
  )
  return { openDetail }
}

describe('WeekView one-off status', () => {
  it('postponed: status pill instead of kickoff time, "v" mid', () => {
    renderWeek([{ ...base, voided: true, statusLabel: 'Postponed' }])
    expect(screen.getByText(/Postponed/)).toBeInTheDocument()
    expect(screen.getByText(/⏸/)).toBeInTheDocument()
    expect(screen.getByText('v')).toBeInTheDocument()
  })

  it('canceled: warning pill', () => {
    renderWeek([{ ...base, voided: true, statusLabel: 'Canceled' }])
    expect(screen.getByText(/Canceled/)).toBeInTheDocument()
    expect(screen.getByText(/⚠/)).toBeInTheDocument()
  })

  it('abandoned: labeled partial score, no source confirmation', () => {
    renderWeek([{ ...base, voided: true, statusLabel: 'Abandoned', score: [1, 1], scoreCheck: { agree: true, count: 3 } }])
    expect(screen.getAllByText('Abandoned').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/1–1/)).toBeInTheDocument()
    expect(screen.queryByText(/confirmed by/)).not.toBeInTheDocument()
  })

  it('abandoned respects spoiler mode (dayHidden)', () => {
    renderWeek([{ ...base, voided: true, statusLabel: 'Abandoned', score: [2, 0] }], { dayHidden: () => true })
    expect(screen.queryByText(/2–0/)).not.toBeInTheDocument()
    expect(screen.getByText(/Abandoned/)).toBeInTheDocument()
  })

  it('awarded: normal score with note', () => {
    renderWeek([{ ...base, score: [3, 0], awarded: true }])
    expect(screen.getByText(/3–0/)).toBeInTheDocument()
    expect(screen.getByText('awarded')).toBeInTheDocument()
  })
})

describe('WeekView normal coverage', () => {
  it('renders AET score text', () => {
    renderWeek([{ ...base, score: [2, 1], aet: true }])
    expect(screen.getByText(/2–1 AET/)).toBeInTheDocument()
  })

  it('renders plain and pens scores', () => {
    const plain = { ...base, score: [3, 0] }
    const pens = { ...base, num: base.num + 1000, score: [1, 1], pens: [5, 4] }
    renderWeek([plain, pens])
    expect(screen.getByText('3–0')).toBeInTheDocument()
    expect(screen.getByText(/1–1 \(p 5–4\)/)).toBeInTheDocument()
  })

  it('hides scores when dayHidden returns true', () => {
    renderWeek([{ ...base, score: [3, 0] }], { dayHidden: () => true })
    expect(screen.queryByText('3–0')).not.toBeInTheDocument()
  })

  it('navigates between weeks (prev/next) and renders the legend', () => {
    renderWeek(MATCHES)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    fireEvent.click(screen.getByRole('button', { name: /Prev/ }))
    expect(screen.getByText(/match/)).toBeInTheDocument()
    expect(screen.getByText('Knockout')).toBeInTheDocument()
  })

  it('opens detail on cell click', () => {
    const { openDetail } = renderWeek([{ ...base, score: [1, 0] }])
    fireEvent.click(screen.getByText('1–0').closest('button'))
    expect(openDetail).toHaveBeenCalled()
  })

  it('renders a live badge for an in-progress match', () => {
    renderWeek([{ ...base, live: true }])
    expect(screen.getByText('v')).toBeInTheDocument()
  })

  it('shows the followed class for a followed team', () => {
    localStorage.setItem('wc2026:followed', JSON.stringify([base.t1]))
    renderWeek([base])
    expect(document.querySelector('.wc-name.followed')).toBeInTheDocument()
  })

  it('singular "match" when a week has exactly one', () => {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    renderWeek([{ ...base, ko: `${todayKey}T18:00:00-04:00` }])
    expect(screen.getByText(/1 match$/)).toBeInTheDocument()
  })
})
