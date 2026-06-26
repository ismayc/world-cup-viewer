import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MATCHES } from '../src/data/matches.js'
import { computeQualification } from '../src/utils/qualification.js'
import {
  remainingGroupMatches,
  applyScenarioPicks,
  unpickedCount,
  PICK_SCORES,
} from '../src/utils/scenarios.js'
import ScenariosView from '../src/components/ScenariosView.jsx'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'

const snapshot = MATCHES.map((m) =>
  m.stage === 'Group' && GROUP_STAGE_MD3[m.num] ? { ...m, score: GROUP_STAGE_MD3[m.num] } : m,
)

describe('scenarios util', () => {
  it('lists only unplayed group games, grouped by group', () => {
    const rem = remainingGroupMatches(snapshot)
    // Snapshot has exactly the 7 incomplete groups, each with its final 2 games.
    expect(Object.keys(rem).sort()).toEqual(['D', 'G', 'H', 'I', 'J', 'K', 'L'])
    for (const g of Object.keys(rem)) expect(rem[g]).toHaveLength(2)
    expect(unpickedCount(snapshot, {})).toBe(14)
  })

  it('applies a pick as a representative score without mutating input', () => {
    const before = MATCHES.find((m) => m.num === 59)
    const out = applyScenarioPicks(snapshot, { 59: 'away' })
    expect(out.find((m) => m.num === 59).score).toEqual(PICK_SCORES.away)
    expect(before.score).toBeUndefined() // original untouched
    expect(unpickedCount(snapshot, { 59: 'away' })).toBe(13)
  })

  it('a chosen result changes the projected standings', () => {
    // Group D, match 59 (Türkiye v USA): give Türkiye the win and they gain points.
    const base = computeQualification(snapshot).groups['D'].find((r) => r.name === 'Türkiye')
    const after = computeQualification(applyScenarioPicks(snapshot, { 59: 'home' })).groups['D'].find(
      (r) => r.name === 'Türkiye',
    )
    expect(after.Pts).toBe(base.Pts + 3)
  })
})

describe('ScenariosView', () => {
  it('renders a card per group still in play and reacts to a pick', () => {
    render(<ScenariosView matches={snapshot} />)
    expect(screen.getByText('14 games still open')).toBeInTheDocument()
    // One card per incomplete group.
    expect(screen.getByText('Group D')).toBeInTheDocument()
    expect(screen.getByText('Group L')).toBeInTheDocument()

    // Picking a result decrements the open-game counter and reveals Clear.
    const firstWin = screen.getAllByTitle(/win$/i)[0]
    fireEvent.click(firstWin)
    expect(screen.getByText('13 games still open')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Clear picks'))
    expect(screen.getByText('14 games still open')).toBeInTheDocument()
  })

  it('shows the all-groups-decided empty state', () => {
    // Every group already complete → no scenarios.
    const allDone = MATCHES.map((m) =>
      m.stage === 'Group' ? { ...m, score: m.score || [1, 0] } : m,
    )
    render(<ScenariosView matches={allDone} />)
    expect(screen.getByText(/Every group is decided/i)).toBeInTheDocument()
  })
})
