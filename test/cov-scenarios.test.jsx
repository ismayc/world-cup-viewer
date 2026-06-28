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
