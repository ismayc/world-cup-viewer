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

describe('reconcileLocks — never clinch a slot a still-alive team can reach', () => {
  const slotLabels = {
    79: ['Winner Group A', '3rd C/E/F/H/I'],
    74: ['Winner Group E', '3rd A/B/C/D/F'],
  }
  const lockedSide = (team) => ({ locked: team, candidates: [{ team, count: 10, pct: 1 }] })

  it('demotes a one-goal-locked third slot when a margin-dependent team can reach it', () => {
    const result = {
      perMatch: {
        79: [lockedSide('Mexico'), lockedSide('Ecuador')], // Mexico vs Ecuador, both "locked"
        74: [lockedSide('Germany'), lockedSide('Paraguay')],
      },
    }
    // Scotland is still mathematically alive and could land in Match 79's 3rd slot.
    const { byMatch, locked } = reconcileLocks(result, slotLabels, ['Scotland'], {
      Scotland: [{ matchNum: 79, winnerGroup: 'A' }],
    })
    // Match 79: winner side stays locked, but the third side is NO LONGER clinched
    // (Scotland can still take it) — so Ecuador won't show a false ✅.
    expect(locked[79]).toEqual([true, false])
    expect(byMatch[79]).toContain('Scotland')
    // Match 74 has no alive reacher → stays fully locked.
    expect(locked[74]).toEqual([true, true])
  })

  it('leaves slots locked when nobody margin-dependent is alive', () => {
    const result = {
      perMatch: {
        79: [lockedSide('Mexico'), lockedSide('Ecuador')],
        74: [lockedSide('Germany'), lockedSide('Paraguay')],
      },
    }
    const { locked } = reconcileLocks(result, slotLabels, [], {})
    expect(locked[79]).toEqual([true, true])
    expect(locked[74]).toEqual([true, true])
  })
})
