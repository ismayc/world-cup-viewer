import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MATCHES } from '../src/data/matches.js'
import OutlookView, { reconcileLocks } from '../src/components/OutlookView.jsx'

describe('OutlookView', () => {
  it('waits (no enumeration) when too many group games remain', () => {
    // Pre-tournament: all 72 group games unplayed → 3^72 outcomes, far past the
    // exact-enumeration threshold, so it shows the "too many" notice rather than
    // spawning the worker.
    const { container } = render(<OutlookView matches={MATCHES} />)
    expect(screen.getByText(/Too many games remain/i)).toBeInTheDocument()
    expect(container.querySelector('.bo-count')).toHaveTextContent('72 group games left')
  })
})

describe('reconcileLocks — never clinch a slot a team can still reach', () => {
  const slotLabels = {
    79: ['Winner Group A', '3rd C/E/F/H/I'],
    85: ['Winner Group B', '3rd E/F/G/I/J'],
    74: ['Winner Group E', '3rd A/B/C/D/F'],
  }
  const lockedSide = (team) => ({ locked: team, candidates: [{ team, count: 10, pct: 1 }] })

  it('demotes a one-goal-locked third slot a margin-dependent team can still reach', () => {
    const result = {
      perMatch: {
        79: [lockedSide('Mexico'), lockedSide('Ecuador')], // Mexico vs Ecuador, both "locked"
        85: [lockedSide('Switzerland'), lockedSide('Senegal')],
        74: [lockedSide('Germany'), lockedSide('Paraguay')],
      },
    }
    // Scotland (still alive) can reach Match 79's 3rd slot; Ecuador is already
    // shown at 79 but could ALSO reach Match 85's 3rd slot (Annexe C shift).
    const { byMatch, locked } = reconcileLocks(result, slotLabels, {
      Scotland: [{ matchNum: 79, winnerGroup: 'A' }],
      Ecuador: [{ matchNum: 79, winnerGroup: 'A' }, { matchNum: 85, winnerGroup: 'B' }],
    })
    // Match 79 third side no longer clinched (Scotland can take it). Ecuador is
    // NOT re-added at 79 (already shown there), but IS added at 85.
    expect(locked[79]).toEqual([true, false])
    expect(byMatch[79]).toContain('Scotland')
    expect(byMatch[79] || []).not.toContain('Ecuador')
    expect(byMatch[85]).toContain('Ecuador')
    expect(locked[85]).toEqual([true, false])
    // Match 74 has no reacher → stays fully locked.
    expect(locked[74]).toEqual([true, true])
  })

  it('leaves slots locked when no team can reach them', () => {
    const result = {
      perMatch: {
        79: [lockedSide('Mexico'), lockedSide('Ecuador')],
        85: [lockedSide('Switzerland'), lockedSide('Senegal')],
        74: [lockedSide('Germany'), lockedSide('Paraguay')],
      },
    }
    const { locked } = reconcileLocks(result, slotLabels, {})
    expect(locked[79]).toEqual([true, true])
    expect(locked[85]).toEqual([true, true])
    expect(locked[74]).toEqual([true, true])
  })
})
