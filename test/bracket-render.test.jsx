import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Bracket from '../src/components/Bracket.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import { MATCHES, STAGE_LABELS } from '../src/data/matches.js'

Element.prototype.scrollIntoView = vi.fn()

// Decorate a few knockout matches with scores/pens/aet/live so the score-display
// branches render.
function withScores() {
  return MATCHES.map((m) => {
    if (m.num === 104) return { ...m, score: [1, 1], pens: [4, 2] } // Final w/ pens
    if (m.num === 103) return { ...m, score: [2, 1], aet: true } // 3rd-place AET
    if (m.num === 74) return { ...m, score: [3, 0] } // plain score
    if (m.num === 77) return { ...m, live: true, score: [0, 0] } // live
    return m
  })
}

const renderBracket = (matches, props = {}) => {
  const openDetail = vi.fn()
  render(
    <FollowProvider>
      <DetailContext.Provider value={openDetail}>
        <Bracket matches={matches} tz="America/New_York" hideScores={false} {...props} />
      </DetailContext.Provider>
    </FollowProvider>,
  )
  return { openDetail }
}

describe('Bracket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all columns including final and third-place', () => {
    renderBracket(MATCHES)
    expect(screen.getAllByText(/Final/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Round of 32/).length).toBeGreaterThan(0)
  })

  it('renders scores, penalties, AET, and the live badge', () => {
    renderBracket(withScores())
    expect(screen.getByText('1–1')).toBeInTheDocument() // final score
    expect(screen.getByText(/\(p 4–2\)/)).toBeInTheDocument() // pens
    expect(screen.getByText('2–1')).toBeInTheDocument() // 3rd place
    expect(screen.getByText(/AET/)).toBeInTheDocument()
    expect(screen.getByText('3–0')).toBeInTheDocument() // plain
  })

  it('hides scores when hideScores is set', () => {
    renderBracket(withScores(), { hideScores: true })
    expect(screen.queryByText('3–0')).not.toBeInTheDocument()
  })

  it('opens detail on click and on keyboard activation', () => {
    const { openDetail } = renderBracket(MATCHES)
    const card = document.getElementById('bx-m74')
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: ' ' })
    fireEvent.keyDown(card, { key: 'Escape' }) // ignored branch
    expect(openDetail).toHaveBeenCalledTimes(3)
  })

  it('expands an R16 slot into the two feeding R32 teams as a potential matchup', () => {
    // R16 match 90 is fed by R32 matches 73 and 75. Once those ties have real
    // teams, the R16 box should read "TeamA / TeamB" instead of "Winner Match 73".
    const matches = MATCHES.map((m) => {
      if (m.num === 73) return { ...m, t1: 'Mexico', t2: 'Canada' }
      if (m.num === 75) return { ...m, t1: 'Spain', t2: 'Brazil' }
      return m
    })
    renderBracket(matches)
    const m90 = document.getElementById('bx-m90')
    expect(m90.textContent).not.toMatch(/Winner Match/)
    expect(m90.querySelectorAll('.bx-side-feeder').length).toBe(2)
    for (const t of ['Mexico', 'Canada', 'Spain', 'Brazil']) {
      expect(within(m90).getByText(t)).toBeInTheDocument()
    }
    // Each pair joins its two teams with "/"; the two pairs are joined by a single
    // "vs" divider (wide layout, hidden on mobile via CSS).
    expect(m90.querySelectorAll('.bx-side-feeder .bx-slash').length).toBe(2)
    const vs = m90.querySelectorAll('.bx-vs-divider')
    expect(vs.length).toBe(1)
    expect(vs[0].textContent).toBe('vs')
  })

  it('shows no "vs" divider when only one R16 side is a resolved pair', () => {
    // Only match 73 resolved → R16 match 90 has one feeder side and one plain
    // "Winner Match 75" placeholder, so there is no all-four-teams "vs" divider.
    const matches = MATCHES.map((m) => (m.num === 73 ? { ...m, t1: 'Mexico', t2: 'Canada' } : m))
    renderBracket(matches)
    const m90 = document.getElementById('bx-m90')
    expect(m90.querySelector('.bx-vs-divider')).toBeNull()
    expect(m90.querySelectorAll('.bx-side-feeder').length).toBe(1)
  })

  it('leaves a feed slot as its plain label while the source tie is unresolved', () => {
    // Raw MATCHES: R32 still holds group placeholders, so R16 can't expand yet.
    renderBracket(MATCHES)
    const m90 = document.getElementById('bx-m90')
    expect(within(m90).getByText('Winner Match 73')).toBeInTheDocument()
    expect(m90.querySelector('.bx-side-feeder')).toBeNull()
  })

  it('scrolls a focused match into view and calls onFocusHandled', () => {
    const onFocusHandled = vi.fn()
    renderBracket(MATCHES, { focusMatch: 74, onFocusHandled })
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(onFocusHandled).toHaveBeenCalled()
  })

  it('handles a focusMatch that does not exist (no element)', () => {
    const onFocusHandled = vi.fn()
    renderBracket(MATCHES, { focusMatch: 99999, onFocusHandled })
    expect(onFocusHandled).toHaveBeenCalled()
  })

  it('does nothing when focusMatch is null', () => {
    const onFocusHandled = vi.fn()
    renderBracket(MATCHES, { focusMatch: null, onFocusHandled })
    expect(onFocusHandled).not.toHaveBeenCalled()
  })

  it('clears the focus highlight after the timeout', () => {
    vi.useFakeTimers()
    try {
      renderBracket(MATCHES, { focusMatch: 74 })
      const el = document.getElementById('bx-m74')
      expect(el.classList.contains('bx-focus')).toBe(true)
      vi.advanceTimersByTime(2300)
      expect(el.classList.contains('bx-focus')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Bracket — mobile round view', () => {
  let originalMM
  beforeEach(() => {
    vi.clearAllMocks()
    originalMM = window.matchMedia
    // Force the mobile branch (narrow viewport).
    window.matchMedia = (q) => ({
      matches: true,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
  })
  afterEach(() => {
    window.matchMedia = originalMM
  })

  it('shows a round selector and only one round at a time (no wide bracket)', () => {
    renderBracket(MATCHES)
    // A pill per round.
    expect(screen.getByRole('tab', { name: STAGE_LABELS.R32 })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: STAGE_LABELS.QF })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: STAGE_LABELS.Final })).toBeInTheDocument()
    // Nothing decided yet → defaults to R32: its matches render, later rounds don't.
    expect(screen.getByRole('tab', { name: STAGE_LABELS.R32 }).getAttribute('aria-selected')).toBe('true')
    expect(document.getElementById('bx-m73')).toBeInTheDocument() // R32
    expect(document.getElementById('bx-m89')).toBeNull() // R16 hidden
    expect(document.getElementById('bx-m104')).toBeNull() // Final hidden
  })

  it('switches the visible round when a pill is tapped', () => {
    renderBracket(MATCHES)
    fireEvent.click(screen.getByRole('tab', { name: STAGE_LABELS.QF }))
    expect(document.getElementById('bx-m97')).toBeInTheDocument() // QF shown
    expect(document.getElementById('bx-m73')).toBeNull() // R32 no longer rendered
  })

  it('opens to the target round when arriving via a focus link', () => {
    renderBracket(MATCHES, { focusMatch: 97 }) // a QF match
    expect(screen.getByRole('tab', { name: STAGE_LABELS.QF }).getAttribute('aria-selected')).toBe('true')
    expect(document.getElementById('bx-m97')).toBeInTheDocument()
  })
})
