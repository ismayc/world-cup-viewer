import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WeekView from '../src/components/WeekView.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import { MATCHES } from '../src/data/matches.js'

const renderWeek = (props) => {
  const openDetail = vi.fn()
  render(
    <FollowProvider>
      <DetailContext.Provider value={openDetail}>
        <WeekView tz="America/New_York" {...props} />
      </DetailContext.Provider>
    </FollowProvider>,
  )
  return { openDetail }
}

describe('WeekView', () => {
  it('renders the AET score text (pens-less knockout) — covers the aet branch', () => {
    const aetMatch = { ...MATCHES.find((m) => m.stage === 'Group'), score: [2, 1], aet: true }
    renderWeek({ allMatches: [aetMatch], shown: [aetMatch] })
    expect(screen.getByText(/2–1 AET/)).toBeInTheDocument()
  })

  it('renders a plain score and a pens score', () => {
    const base = MATCHES.find((m) => m.stage === 'Group')
    const plain = { ...base, num: base.num, score: [3, 0] }
    const pens = { ...base, num: base.num + 1000, score: [1, 1], pens: [5, 4] }
    renderWeek({ allMatches: [plain, pens], shown: [plain, pens] })
    expect(screen.getByText('3–0')).toBeInTheDocument()
    expect(screen.getByText(/1–1 \(p 5–4\)/)).toBeInTheDocument()
  })

  it('hides scores when dayHidden returns true', () => {
    const m = { ...MATCHES.find((x) => x.stage === 'Group'), score: [3, 0] }
    renderWeek({ allMatches: [m], shown: [m], dayHidden: () => true })
    expect(screen.queryByText('3–0')).not.toBeInTheDocument()
  })

  it('navigates between weeks with prev/next', () => {
    renderWeek({ allMatches: MATCHES, shown: MATCHES })
    const next = screen.getByRole('button', { name: /Next/ })
    fireEvent.click(next)
    const prev = screen.getByRole('button', { name: /Prev/ })
    fireEvent.click(prev)
    expect(screen.getByText(/match/)).toBeInTheDocument()
  })

  it('opens detail when a cell is clicked', () => {
    const m = { ...MATCHES.find((x) => x.stage === 'Group'), score: [1, 0] }
    const { openDetail } = renderWeek({ allMatches: [m], shown: [m] })
    fireEvent.click(screen.getByText('1–0').closest('button'))
    expect(openDetail).toHaveBeenCalled()
  })

  it('renders a live badge for an in-progress match', () => {
    const m = { ...MATCHES.find((x) => x.stage === 'Group'), live: true }
    renderWeek({ allMatches: [m], shown: [m] })
    expect(screen.getByText('v')).toBeInTheDocument()
  })

  it('opens a day pop-up from the date-header button and drills into match detail', () => {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const m = { ...MATCHES.find((x) => x.stage === 'Group'), ko: `${todayKey}T18:00:00-04:00`, score: [2, 1] }
    const { openDetail } = renderWeek({ allMatches: [m], shown: [m] })
    // The date-header button appears only for days that have matches.
    fireEvent.click(screen.getByRole('button', { name: /Show all 1 match on/ }))
    // The day pop-up opens, listing the day's matches as compact rows.
    const dialog = screen.getByRole('dialog')
    const row = dialog.querySelector('.dm-row')
    expect(row).toBeTruthy()
    // Clicking a row drills into the full match-detail modal.
    fireEvent.click(row)
    expect(openDetail).toHaveBeenCalled()
  })

  it('shows no day-header button for an empty day', () => {
    // A single match on one day → only that day has a button; the other six don't.
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const m = { ...MATCHES.find((x) => x.stage === 'Group'), ko: `${todayKey}T18:00:00-04:00` }
    renderWeek({ allMatches: [m], shown: [m] })
    expect(screen.getAllByRole('button', { name: /Show all .* match/ })).toHaveLength(1)
  })

  it('shows singular "match" count when a week has exactly one match', () => {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const m = { ...MATCHES.find((x) => x.stage === 'Group'), ko: `${todayKey}T18:00:00-04:00` }
    renderWeek({ allMatches: [m], shown: [m] })
    expect(screen.getByText(/1 match$/)).toBeInTheDocument()
  })
})
