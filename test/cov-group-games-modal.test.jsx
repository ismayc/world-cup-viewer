import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import GroupGamesModal from '../src/components/GroupGamesModal.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import { MATCHES } from '../src/data/matches.js'

// Group A fixtures (num/teams) used to craft scores, live and voided states.
const GROUP_A = MATCHES.filter((m) => m.stage === 'Group' && m.group === 'A')

// The bundled MATCHES kick off in June 2026 — already in the past relative to
// "now", so without a score they read as finished. Push Group A's kickoffs into
// the future so the "upcoming" branches render.
const FUTURE = '2099-06-11T15:00:00-04:00'
const groupAInFuture = () =>
  MATCHES.map((m) => (m.stage === 'Group' && m.group === 'A' ? { ...m, ko: FUTURE } : m))

const renderModal = (props = {}) => {
  const openDetail = vi.fn()
  const onClose = vi.fn()
  const result = render(
    <FollowProvider>
      <DetailContext.Provider value={openDetail}>
        <GroupGamesModal
          group="A"
          matches={MATCHES}
          tz="America/New_York"
          hideScores={false}
          onClose={onClose}
          {...props}
        />
      </DetailContext.Provider>
    </FollowProvider>,
  )
  return { openDetail, onClose, ...result }
}

describe('GroupGamesModal (coverage)', () => {
  it('renders the empty "Results" and full "Still to play" lists for an untouched group', () => {
    // No scores → nothing played (line 183 empty state) and every fixture is
    // upcoming (lines 190-194 list + Upcoming badge on line 65).
    renderModal({ matches: groupAInFuture() })
    expect(screen.getByText('No games played yet.')).toBeInTheDocument()
    expect(screen.getAllByText('Upcoming').length).toBe(GROUP_A.length)
    expect(document.querySelectorAll('.gg-vs').length).toBe(GROUP_A.length)
  })

  it('renders a finished score, a live badge and a voided badge', () => {
    // m1 final, m2 live, m25 voided → covers lines 59 (live), 61 (voided),
    // plus the FT/score paths.
    const matches = MATCHES.map((m) => {
      if (m.num === 1) return { ...m, score: [2, 0] }
      if (m.num === 2) return { ...m, live: { clock: "60'", detail: '' }, score: [1, 1] }
      if (m.num === 25) return { ...m, voided: true, statusLabel: 'Abandoned' }
      return m
    })
    renderModal({ matches })
    expect(screen.getByText('2–0')).toBeInTheDocument()
    expect(screen.getAllByText('FT').length).toBeGreaterThan(0)
    expect(screen.getByText('Abandoned')).toBeInTheDocument()
    // Live badge present.
    expect(document.querySelector('.gg-status')).toBeTruthy()
  })

  it('hides scores in spoiler-free mode and reveals them on click', () => {
    // hideScores → spoiler bar (lines 166-171). A finished match shows the
    // hidden •–• placeholder (line 50) until revealed.
    const matches = MATCHES.map((m) => (m.num === 1 ? { ...m, score: [3, 1] } : m))
    renderModal({ matches, hideScores: true })
    expect(screen.getByText(/Scores hidden in spoiler-free mode/)).toBeInTheDocument()
    expect(document.querySelector('.gg-score-hidden')).toBeTruthy()
    expect(screen.queryByText('3–1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reveal scores/ }))
    // After reveal the real score shows and the reveal button is gone.
    expect(screen.getByText('3–1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reveal scores/ })).not.toBeInTheDocument()
  })

  it('opens the detail modal (and closes itself) when a fixture row is clicked', () => {
    // Covers the openMatch path: onClose() then openDetail(m).
    const matches = MATCHES.map((m) => (m.num === 1 ? { ...m, score: [1, 0] } : m))
    const { openDetail, onClose } = renderModal({ matches })
    fireEvent.click(screen.getByText('1–0').closest('button'))
    expect(onClose).toHaveBeenCalled()
    expect(openDetail).toHaveBeenCalledTimes(1)
  })

  it('shows the "won-group" knockout section with a confirmed opponent', () => {
    renderModal({
      team: 'Mexico',
      knockout: { status: 'won-group', opponent: 'Brazil', settled: true, matchNum: 73 },
    })
    expect(screen.getByText('Round of 32')).toBeInTheDocument()
    expect(screen.getByText(/as group winners/)).toBeInTheDocument()
    expect(screen.getByText(/will play:/)).toBeInTheDocument()
    expect(screen.getByText(/confirmed/)).toBeInTheDocument()
    expect(screen.getByText('Match 73')).toBeInTheDocument()
  })

  it('shows the "runner-up" knockout wording (line 80)', () => {
    renderModal({ team: 'Mexico', knockout: { status: 'runner-up', opponent: 'Brazil' } })
    expect(screen.getByText(/as group runners-up/)).toBeInTheDocument()
  })

  it('shows the "top2" knockout wording (line 82)', () => {
    renderModal({ team: 'Mexico', knockout: { status: 'top2', opponent: 'Brazil' } })
    expect(screen.getByText(/with a top-two finish/)).toBeInTheDocument()
  })

  it('shows the best-third wording and a TBD opponent (lines 84 + 111)', () => {
    // status 'third' hits the final fallback in the ternary; no opponent hits the
    // "To be determined" branch on line 111 and the projected-matchup note.
    renderModal({ team: 'Mexico', knockout: { status: 'third' } })
    expect(screen.getByText(/as one of the best third-placed teams/)).toBeInTheDocument()
    expect(screen.getByText('To be determined')).toBeInTheDocument()
    expect(screen.getByText(/currently projected to play:/)).toBeInTheDocument()
  })

  it('filters to a single team and shows its three group matches', () => {
    // team set → fixtures filtered; also renders the team head (lines 158-162).
    renderModal({ matches: groupAInFuture(), team: 'Mexico' })
    const head = document.querySelector('.gg-head-team')
    expect(head.textContent).toMatch(/Mexico/)
    // Mexico plays 3 of Group A's matches.
    expect(screen.getAllByText('Upcoming').length).toBe(3)
  })
})
