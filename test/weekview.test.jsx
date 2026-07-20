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

  // Pinned mid-tournament so BOTH arrows are live. WeekView mounts on the week
  // containing today; on the real clock that's the last week, where `Next ▶` is
  // disabled and the forward click is a silent no-op.
  it('navigates between weeks with prev/next', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      renderWeek({ allMatches: MATCHES, shown: MATCHES })
      const next = screen.getByRole('button', { name: /Next/ })
      const prev = screen.getByRole('button', { name: /Prev/ })
      expect(next).toBeEnabled()
      expect(prev).toBeEnabled()
      const weekTitle = () => document.querySelector('.week-title').textContent
      const start = weekTitle()
      fireEvent.click(next)
      expect(weekTitle()).not.toBe(start) // the week actually advanced
      fireEvent.click(prev)
      expect(weekTitle()).toBe(start)
    } finally {
      vi.useRealTimers()
    }
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

  it('expands a knockout cell into its potential matchups (both sides resolved)', () => {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const venue = MATCHES.find((x) => x.stage === 'R32').venue
    // Both feeding ties (Matches 73 & 74) have real teams → both slots expand.
    const feed1 = { num: 73, stage: 'R32', venue, ko: `${todayKey}T12:00:00-04:00`, t1: 'Mexico', t2: 'Canada' }
    const feed2 = { num: 74, stage: 'R32', venue, ko: `${todayKey}T15:00:00-04:00`, t1: 'Brazil', t2: 'Croatia' }
    const r16 = { num: 89, stage: 'R16', venue, ko: `${todayKey}T18:00:00-04:00`, t1: 'Winner Match 73', t2: 'Winner Match 74' }
    // r16 is the only shown cell; feeds live in allMatches so byNum can resolve them.
    renderWeek({ allMatches: [feed1, feed2, r16], shown: [r16] })
    expect(screen.getByText('Mexico')).toBeInTheDocument()
    expect(screen.getByText('Canada')).toBeInTheDocument()
    expect(screen.getByText('Brazil')).toBeInTheDocument()
    expect(screen.getByText('Croatia')).toBeInTheDocument()
    expect(screen.queryByText('Winner Match 73')).not.toBeInTheDocument()
    expect(screen.queryByText('Winner Match 74')).not.toBeInTheDocument()
  })

  it('keeps the raw placeholder label when a knockout cell is unresolved', () => {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const venue = MATCHES.find((x) => x.stage === 'R32').venue
    const r16 = { num: 90, stage: 'R16', venue, ko: `${todayKey}T18:00:00-04:00`, t1: 'Winner Match 75', t2: 'Winner Match 76' }
    renderWeek({ allMatches: [r16], shown: [r16] })
    expect(screen.getByText('Winner Match 75')).toBeInTheDocument()
    expect(screen.getByText('Winner Match 76')).toBeInTheDocument()
  })
})
