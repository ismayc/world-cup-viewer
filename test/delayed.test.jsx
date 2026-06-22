import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import LiveBadge from '../src/components/LiveBadge.jsx'
import NextMatch from '../src/components/NextMatch.jsx'
import Standings from '../src/components/Standings.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { fetchLive, applyLive } from '../src/services/espn.js'
import { MATCHES } from '../src/data/matches.js'

describe('LiveBadge — delayed', () => {
  it('shows an amber "⏸ Delayed" badge (not the red clock) for a delayed match', () => {
    render(<LiveBadge match={{ live: { clock: 'Delay', detail: 'Delayed', delayed: true } }} />)
    const badge = screen.getByText(/⏸ Delayed/)
    expect(badge).toHaveClass('badge-delayed')
    expect(badge).toHaveAttribute('title', 'Delayed')
  })

  it('defaults the title to "Delayed" when no detail is present', () => {
    render(<LiveBadge match={{ live: { delayed: true } }} />)
    expect(screen.getByText(/⏸ Delayed/)).toHaveAttribute('title', 'Delayed')
  })

  it('still renders the red running clock for a normal live match', () => {
    render(<LiveBadge match={{ live: { clock: "45'", detail: 'First Half' } }} />)
    expect(screen.getByText(/● 45/)).toHaveClass('badge-live')
  })
})

describe('NextMatch — delayed', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) }))
  })

  it('labels a delayed current match "Delayed", not "in progress"', () => {
    const m = { ...MATCHES[0], live: { clock: 'Delay', detail: 'Delayed', delayed: true }, score: [1, 0] }
    render(
      <FollowProvider>
        <NextMatch matches={[m]} tz="America/New_York" />
      </FollowProvider>,
    )
    // Appears in both the label and the countdown slot.
    expect(screen.getAllByText('⏸ Delayed').length).toBe(2)
    expect(screen.queryByText('● in progress')).not.toBeInTheDocument()
  })
})

describe('Standings — delayed group', () => {
  it('shows amber "⏸ DELAYED" + delayed dots for a group whose match is paused', () => {
    // M28 = Mexico v South Korea (Group A) — mark it delayed.
    const matches = MATCHES.map((m) => (m.num === 28 ? { ...m, live: { delayed: true }, score: [1, 0] } : m))
    const { container } = render(
      <FollowProvider>
        <Standings matches={matches} hideScores={false} clinch={{}} />
      </FollowProvider>,
    )
    const groupA = screen.getByText('Group A').closest('.group-card')
    expect(within(groupA).getByText(/⏸ DELAYED/)).toBeInTheDocument()
    expect(within(groupA).queryByText(/● LIVE/)).toBeNull()
    expect(container.querySelectorAll('.row-live-dot.delayed')).toHaveLength(2)
  })
})

describe('espn — STATUS_DELAYED flows through to m.live.delayed', () => {
  it('flags a delayed match via fetchLive + applyLive', async () => {
    const type = { state: 'in', name: 'STATUS_DELAYED', description: 'Delayed', shortDetail: 'Delay' }
    const event = {
      date: '2026-06-22T21:00Z',
      status: { type },
      competitions: [
        {
          status: { type },
          competitors: [
            { homeAway: 'home', team: { id: '1', displayName: 'France' }, score: '1' },
            { homeAway: 'away', team: { id: '2', displayName: 'Iraq' }, score: '0' },
          ],
        },
      ],
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [event] }) }))
    const map = await fetchLive()
    const fra = MATCHES.find(
      (m) => (m.t1 === 'France' && m.t2 === 'Iraq') || (m.t1 === 'Iraq' && m.t2 === 'France'),
    )
    const [out] = applyLive([fra], map)
    expect(out.live.delayed).toBe(true)
  })
})
