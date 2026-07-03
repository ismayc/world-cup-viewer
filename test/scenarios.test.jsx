import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MATCHES } from '../src/data/matches.js'
import { computeQualification } from '../src/utils/qualification.js'
import {
  remainingGroupMatches,
  applyScenarioPicks,
  unpickedCount,
  possibleOrderings,
  pickOutcome,
  groupStageArchived,
  stageArchived,
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

  it('applies a scoreline pick without mutating input', () => {
    const before = MATCHES.find((m) => m.num === 59)
    const out = applyScenarioPicks(snapshot, { 59: [0, 2] })
    expect(out.find((m) => m.num === 59).score).toEqual([0, 2])
    expect(before.score).toBeUndefined() // original untouched
    expect(unpickedCount(snapshot, { 59: [0, 2] })).toBe(13)
  })

  it('reads the win/draw/loss category of a scoreline', () => {
    expect(pickOutcome(PICK_SCORES.home)).toBe('home')
    expect(pickOutcome([2, 2])).toBe('draw')
    expect(pickOutcome([0, 3])).toBe('away')
    expect(pickOutcome(undefined)).toBeNull()
  })

  it('a chosen result changes the projected standings', () => {
    // Group D, match 59 (Türkiye v USA): give Türkiye the win and they gain points.
    const base = computeQualification(snapshot).groups['D'].find((r) => r.name === 'Türkiye')
    const after = computeQualification(applyScenarioPicks(snapshot, { 59: PICK_SCORES.home })).groups[
      'D'
    ].find((r) => r.name === 'Türkiye')
    expect(after.Pts).toBe(base.Pts + 3)
  })

  it('counts distinct reachable final standings, collapsing to 1 when fully set', () => {
    // Group D has 2 games left -> several possible orders; pinning both exact
    // scorelines leaves exactly one final standing.
    const open = possibleOrderings('D', snapshot)
    expect(open.count).toBeGreaterThan(1)
    expect(open.decided).toBe(false)
    const set = applyScenarioPicks(snapshot, { 59: [0, 1], 60: [2, 0] })
    expect(possibleOrderings('D', set)).toEqual({ count: 1, decided: true })
  })
})

describe('groupStageArchived', () => {
  const allDone = MATCHES.map((m) => (m.stage === 'Group' ? { ...m, score: m.score || [1, 0] } : m))

  it('is false while any group game is unplayed', () => {
    expect(groupStageArchived(MATCHES)).toBe(false)
  })
  it('is false while a group game is still live (not yet settled)', () => {
    const oneLive = allDone.map((m) => (m.num === 1 ? { ...m, live: { clock: "70'" } } : m))
    expect(groupStageArchived(oneLive)).toBe(false)
  })
  it('is true as soon as every group game is final', () => {
    expect(groupStageArchived(allDone)).toBe(true)
  })
})

describe('stageArchived (generic, per-stage)', () => {
  const r32Done = MATCHES.map((m) => (m.stage === 'R32' ? { ...m, score: [1, 0] } : m))

  it('is false while any of the stage’s games is unplayed', () => {
    expect(stageArchived(MATCHES, 'R32')).toBe(false)
  })
  it('is false while one of the stage’s games is still live', () => {
    const oneLive = r32Done.map((m) => (m.num === 73 ? { ...m, live: { clock: "70'" } } : m))
    expect(stageArchived(oneLive, 'R32')).toBe(false)
  })
  it('is true once every game in the stage is final', () => {
    expect(stageArchived(r32Done, 'R32')).toBe(true)
  })
  it('is false for a stage with no games', () => {
    expect(stageArchived(MATCHES, 'Nope')).toBe(false)
  })
})

describe('ScenariosView', () => {
  it('renders a card per group still in play and reacts to a pick', () => {
    render(<ScenariosView matches={snapshot} />)
    expect(screen.getByText('14 games still open')).toBeInTheDocument()
    // One card per incomplete group.
    expect(screen.getByText('Group D')).toBeInTheDocument()
    expect(screen.getByText('Group L')).toBeInTheDocument()
    // Each in-play group reports how many final orders are still possible.
    expect(screen.getAllByText(/possible orders/).length).toBeGreaterThan(0)

    // Picking a result decrements the open-game counter and reveals Clear.
    const firstWin = screen.getAllByTitle(/win$/i)[0]
    fireEvent.click(firstWin)
    expect(screen.getByText('13 games still open')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Clear picks'))
    expect(screen.getByText('14 games still open')).toBeInTheDocument()
  })

  it('marks a locked projected R32 matchup with a confirmed checkmark', () => {
    // Live snapshot already locks USA (Group D winner) vs Bosnia. Group D shows
    // its "1st" projected line confirmed without any picks needed.
    render(<ScenariosView matches={snapshot} />)
    const card = screen.getByText('Group D').closest('.sc-card')
    expect(card.querySelector('.sc-r32-lock')).toBeInTheDocument()
    // The bare checkmark carries an accessible label but no "Matchup confirmed" text.
    expect(within(card).getByLabelText('Matchup confirmed')).toBeInTheDocument()
    expect(within(card).queryByText(/Matchup confirmed/)).toBeNull()
    // A wide-open group shows no confirmed matchup yet.
    const open = screen.getByText('Group G').closest('.sc-card')
    expect(open.querySelector('.sc-r32-lock')).toBeNull()
  })

  it('exposes goal steppers once a result is set, and they adjust the score', () => {
    render(<ScenariosView matches={snapshot} />)
    // Set the first fixture to a home win, which reveals the score steppers.
    fireEvent.click(screen.getAllByTitle(/win$/i)[0])
    expect(screen.getByText('1–0')).toBeInTheDocument()
    // Bump the home side to 2 goals.
    fireEvent.click(screen.getAllByLabelText(/goals plus$/i)[0])
    expect(screen.getByText('2–0')).toBeInTheDocument()
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
