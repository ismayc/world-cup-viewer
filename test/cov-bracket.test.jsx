import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Bracket from '../src/components/Bracket.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import { MATCHES, STAGE_LABELS } from '../src/data/matches.js'

Element.prototype.scrollIntoView = vi.fn()

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

describe('Bracket — currentRound Final fallback', () => {
  let originalMM
  beforeEach(() => {
    vi.clearAllMocks()
    originalMM = window.matchMedia
    // Force the mobile branch so the round tabs (which use currentRound) render.
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

  it('opens on the Final round when every knockout match is already decided', () => {
    // Give EVERY knockout match a final score and no live flag, so currentRound
    // finds no still-to-be-decided round and falls through to `return 'Final'`.
    const matches = MATCHES.map((m) =>
      m.stage === 'Group' ? m : { ...m, score: [2, 1], live: false },
    )
    renderBracket(matches)
    expect(
      screen.getByRole('tab', { name: STAGE_LABELS.Final }).getAttribute('aria-selected'),
    ).toBe('true')
    // The Final match (104) is the one shown.
    expect(document.getElementById('bx-m104')).toBeInTheDocument()
    // An earlier round is not rendered.
    expect(document.getElementById('bx-m73')).toBeNull()
  })
})


describe('Bracket — a followed team, wherever it appears', () => {
  it('marks a followed team on a resolved side and inside a feeder pair', () => {
    // Following a team highlights it everywhere the bracket names it: on the
    // side of a tie it has already reached, and among the two candidates of a
    // tie it might still feed into.
    localStorage.setItem('wc2026:followed', JSON.stringify(['Mexico', 'Canada']))
    try {
      const board = MATCHES.map((m) =>
        m.num === 73 ? { ...m, t1: 'Mexico', t2: 'Canada', score: [2, 0] } : m,
      )
      renderBracket(board)
      // The resolved side of Match 73.
      expect(document.querySelector('.bx-side.followed')).toBeTruthy()
      // And the same team as one of the two candidates feeding the next round.
      expect(document.querySelector('.bx-feeder-team.followed')).toBeTruthy()
    } finally {
      localStorage.clear()
    }
  })
})
