import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { openGroups, possibleOrderings } from '../src/utils/scenarios.js'
import ScenariosView from '../src/components/ScenariosView.jsx'

// Real Group A teams so flags / FIFA ranking resolve. A full round-robin lets us
// drive the standings down to soft tie-breakers (mirrors test/tiebreak-notes.js).
const A = ['Mexico', 'South Africa', 'South Korea', 'Czechia']
const PAIRS = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
]
function groupA(scores) {
  return PAIRS.map(([i, j], k) => ({
    num: 100 + k,
    stage: 'Group',
    group: 'A',
    t1: A[i],
    t2: A[j],
    score: scores[k],
  }))
}

describe('openGroups (scenarios util)', () => {
  it('lists groups that still have an unplayed game and omits decided ones', () => {
    // Group A: five games 0-0, the last (num 105) still to be played.
    const scores = PAIRS.map(() => [0, 0])
    scores[5] = undefined
    expect(openGroups(groupA(scores))).toEqual(['A'])
  })

  it('returns an empty list once every group game is final', () => {
    expect(openGroups(groupA(PAIRS.map(() => [0, 0])))).toEqual([])
  })
})

describe('ScenariosView uncovered branches', () => {
  // Five group games already 0-0, the final game (num 105) open: the group still
  // appears, and pinning the last result settles the order down to FIFA ranking.
  const fiveDrawn = () => {
    const scores = PAIRS.map(() => [0, 0])
    scores[5] = undefined
    return groupA(scores)
  }

  it('toggles a quick pick off when the same outcome is clicked again', () => {
    render(<ScenariosView matches={fiveDrawn()} />)
    expect(screen.getByText('1 game still open')).toBeInTheDocument()
    const homeWin = screen.getAllByTitle(/win$/i)[0]
    fireEvent.click(homeWin) // set the pick
    expect(screen.getByText('0 games still open')).toBeInTheDocument()
    fireEvent.click(homeWin) // same outcome again -> drop the pick (toggle off)
    expect(screen.getByText('1 game still open')).toBeInTheDocument()
  })

  it('shows "order decided" and a soft tie-breaker marker once the order is settled', () => {
    render(<ScenariosView matches={fiveDrawn()} />)
    const card = screen.getByText('Group A').closest('.sc-card')
    // Pick the last game as a draw -> all 0-0/draws -> single reachable order,
    // separated only by FIFA ranking.
    fireEvent.click(within(card).getByTitle('Draw'))
    expect(within(card).getByText('order decided')).toBeInTheDocument()
    // The ⚖️ soft tie-breaker marker renders with its accessible label.
    expect(card.querySelector('.sc-tiebreak')).toBeInTheDocument()
    expect(within(card).getAllByLabelText(/Separated from/).length).toBeGreaterThan(0)
  })

  it('shows the "to pick" state when a group has too many open games to enumerate', () => {
    // Three games still open -> possibleOrderings cannot enumerate -> count == null.
    const scores = PAIRS.map(() => [0, 0])
    scores[3] = undefined
    scores[4] = undefined
    scores[5] = undefined
    const m = groupA(scores)
    // Sanity-check the precondition the UI branch depends on.
    expect(possibleOrderings('A', m).count).toBeNull()
    render(<ScenariosView matches={m} />)
    const card = screen.getByText('Group A').closest('.sc-card')
    expect(within(card).getByText('3 to pick')).toBeInTheDocument()
  })
})


describe('ScenariosView — teams, ties and matchups the projection cannot fill in', () => {
  // Five of the six group games drawn 0-0 and the last still open, plus a red
  // card, so the pair the ranker cannot separate comes down to discipline
  // rather than to the FIFA ranking.
  const withCards = () => {
    const scores = PAIRS.map(() => [0, 0])
    scores[5] = undefined
    const board = groupA(scores)
    // Mexico v Czechia: Czechia pick up a red, so their fair-play score is the
    // worse one and the pair straddling them is split on cards.
    board[2] = { ...board[2], cards: { t1: [], t2: [{ color: 'red' }] } }
    return board
  }

  it('says a soft tie-break was decided on cards, and warns the card data is best-effort', () => {
    render(<ScenariosView matches={withCards()} />)
    const marks = [...document.querySelectorAll('.sc-tiebreak')]
    expect(marks.length).toBeGreaterThan(0)
    expect(marks.some((m) => /fair-play points \(cards\)/.test(m.getAttribute('title')))).toBe(true)
    expect(marks.some((m) => /best-effort card data/.test(m.getAttribute('title')))).toBe(true)
  })

  it('marks a fixture whose teams the flag table does not know', () => {
    // A group game against a name the committed table has never carried — an
    // upstream re-spelling, say. The picker still has to draw the fixture.
    const board = [
      ...groupA(PAIRS.map(() => [0, 0])).slice(0, 5),
      { num: 105, stage: 'Group', group: 'A', t1: 'Nowhere United', t2: 'Elsewhere City' },
    ]
    render(<ScenariosView matches={board} />)
    const teams = [...document.querySelectorAll('.sc-fx-team')].map((n) => n.textContent)
    expect(teams).toEqual(['• Nowhere United', 'Elsewhere City •'])
  })

  it('shows TBD for a projected opponent the bracket cannot name yet', () => {
    // The Round-of-32 tie this group's winner feeds into has one side that is
    // not a group slot at all, so there is no opponent to project — the line
    // still names the qualifier and leaves the other half blank.
    const board = [
      ...groupA((() => { const s = PAIRS.map(() => [0, 0]); s[5] = undefined; return s })()),
      { num: 900, stage: 'R32', t1: 'Winner Group A', t2: 'Winner Match 5', ko: '2026-07-05T15:00:00Z' },
    ]
    render(<ScenariosView matches={board} />)
    const first = document.querySelector('.sc-r32-row')
    expect(first.querySelector('.sc-r32-opp').textContent).toBe('TBD')
    expect(first.querySelector('.sc-r32-num').textContent).toBe('M900')
  })
})
