import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import NextMatch from '../src/components/NextMatch.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { MATCHES } from '../src/data/matches.js'

const TZ = 'America/New_York'

function renderNM(matches, followedTeams = []) {
  localStorage.setItem('wc2026:followed', JSON.stringify(followedTeams))
  return render(
    <FollowProvider>
      <NextMatch matches={matches} tz={TZ} />
    </FollowProvider>,
  )
}

describe('NextMatch', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('shows the tournament-concluded message when there is no match', () => {
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    renderNM([]) // empty list => no live, no upcoming
    expect(screen.getByText(/tournament has concluded/)).toBeInTheDocument()
  })

  it('crowns the champion (and runners-up) once the Final is decided', () => {
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const final = {
      num: 104,
      stage: 'Final',
      t1: 'Argentina',
      t2: 'France',
      venue: 'metlife',
      ko: '2026-07-19T15:00:00-04:00',
      score: [3, 2],
    }
    renderNM([final])
    expect(screen.getByText('Argentina')).toBeInTheDocument()
    expect(screen.getByText('2026 World Champions!')).toBeInTheDocument()
    expect(screen.getByText(/Runners-up:.*France/)).toBeInTheDocument()
  })

  it('falls back to the generic message when the Final is not yet decided', () => {
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    // Final in the past but no score recorded → no champion to crown.
    const final = { num: 104, stage: 'Final', t1: 'Argentina', t2: 'France', venue: 'metlife', ko: '2026-07-19T15:00:00-04:00' }
    renderNM([final])
    expect(screen.getByText(/tournament has concluded/)).toBeInTheDocument()
    expect(screen.queryByText('2026 World Champions!')).not.toBeInTheDocument()
  })

  it('shows the next upcoming match with a multi-day countdown', () => {
    // Pin before the tournament so the opener is the next match (days > 0).
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
    renderNM(MATCHES)
    expect(screen.getByText('⏱ Next match')).toBeInTheDocument()
    const countdown = screen.getByLabelText('time until kickoff')
    // Days segment present.
    expect(countdown.querySelector('small')).toBeInTheDocument()
    expect(countdown.textContent).toMatch(/d/)
    expect(screen.getByText('vs')).toBeInTheDocument()
  })

  it('prefers a followed team\'s next match and labels it accordingly', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
    // Follow a team that does not play first, so it differs from upcoming[0].
    renderNM(MATCHES, ['Brazil'])
    expect(screen.getByText('⭐ Your next match')).toBeInTheDocument()
    // The chosen match involves Brazil.
    expect(screen.getAllByText('Brazil').length).toBeGreaterThan(0)
  })

  it('renders a live match (followed) with the in-progress state', () => {
    const m = MATCHES[0]
    const live = [{ ...m, live: { clock: "30’" } }]
    vi.setSystemTime(new Date(m.ko))
    renderNM(live, [m.t1])
    expect(screen.getByText('🔴 Live now')).toBeInTheDocument()
    expect(screen.getByText('● in progress')).toBeInTheDocument()
  })

  it('renders a live match not involving a followed team', () => {
    const m = MATCHES[0]
    const live = [{ ...m, live: { clock: "30’" } }]
    vi.setSystemTime(new Date(m.ko))
    renderNM(live) // none followed -> liveMatches[0]
    expect(screen.getByText('🔴 Live now')).toBeInTheDocument()
  })

  it('falls back to a bullet flag for unknown team names', () => {
    const m = { ...MATCHES[0], t1: 'Nowhereland', t2: 'Atlantis', ko: '2026-12-01T15:00:00-04:00' }
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'))
    renderNM([m])
    expect(screen.getAllByText('•').length).toBe(2)
  })

  it('renders a knockout-stage label', () => {
    const ko = MATCHES.find((x) => x.stage !== 'Group')
    vi.setSystemTime(new Date(new Date(ko.ko).getTime() - 3600 * 1000)) // 1h before
    renderNM([ko])
    // Stage label is the non-group STAGE_LABELS form (no "Group X").
    expect(screen.queryByText(/^Group /)).not.toBeInTheDocument()
  })

  it('jumps to the match day when the day element exists', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
    const { container } = renderNM(MATCHES)
    // Provide a target element for scrollIntoView.
    const target = document.createElement('div')
    // Recreate the id the component computes.
    // We don't know exact dayKey, so query the jump and stub getElementById.
    const scrollIntoView = vi.fn()
    const orig = document.getElementById
    document.getElementById = vi.fn(() => ({ scrollIntoView }))
    try {
      fireEvent.click(screen.getByText(/Jump to it/))
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    } finally {
      document.getElementById = orig
    }
    expect(container).toBeTruthy()
    target.remove()
  })

  it('jump is a no-op when the day element is missing', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
    renderNM(MATCHES)
    const orig = document.getElementById
    document.getElementById = vi.fn(() => null)
    try {
      // Should not throw.
      fireEvent.click(screen.getByText(/Jump to it/))
    } finally {
      document.getElementById = orig
    }
  })

  it('ticks the clock on the interval', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
    renderNM(MATCHES)
    const before = screen.getByLabelText('time until kickoff').textContent
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const after = screen.getByLabelText('time until kickoff').textContent
    expect(before).not.toBe(after)
  })
})

describe('NextMatch — knockout slots and teams it has no flag for', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  // Before the bracket resolves, the next match is a knockout tie between two
  // feeder labels. There is no group to name and no flag to show for either
  // side, and the countdown to it is measured in days rather than minutes.
  const KO = '2027-07-04T15:00:00Z'
  const placeholder = {
    num: 700,
    stage: 'QF',
    t1: 'Winner Match 5',
    t2: 'Winner Match 6',
    ko: KO,
    venue: MATCHES[0].venue,
  }

  it('names the round, falls back for both flags, and counts the days down', () => {
    // Four days out, so the countdown carries a day component.
    vi.setSystemTime(new Date('2027-06-30T15:00:00Z'))
    renderNM([placeholder])

    // A knockout tie is labelled by its round, not "Group undefined".
    expect(screen.getByText(/Quarter|QF/i)).toBeInTheDocument()
    expect(screen.queryByText(/Group undefined/)).not.toBeInTheDocument()

    // Neither feeder label has a flag of its own.
    const flags = [...document.querySelectorAll('.nm-flag')].map((n) => n.textContent)
    expect(flags.length).toBeGreaterThanOrEqual(2)
    expect(flags.every((f) => f === '•')).toBe(true)

    // The countdown shows days.
    expect(document.querySelector('.nm-count, .nm-countdown, .nm-timer')?.textContent ?? document.body.textContent)
      .toMatch(/\dd/)
  })

  it('crowns a champion the flag table does not know', () => {
    // A final between two feeder labels that has somehow been decided: the
    // banner still names both, with the fallback where a flag would be.
    vi.setSystemTime(new Date('2027-08-01T00:00:00Z'))
    const decidedFinal = {
      num: 701,
      stage: 'Final',
      t1: 'Winner Match 9',
      t2: 'Winner Match 10',
      ko: '2027-07-20T15:00:00Z',
      venue: MATCHES[0].venue,
      score: [2, 1],
    }
    renderNM([decidedFinal])
    expect(screen.getByText(/Winner Match 9/)).toBeInTheDocument()
    expect(screen.getByText(/Winner Match 10/)).toBeInTheDocument()
    expect(document.querySelector('.nm-champ-flag').textContent).toBe('')
  })
})
