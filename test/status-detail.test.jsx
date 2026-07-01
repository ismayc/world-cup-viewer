import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import MatchDetail from '../src/components/MatchDetail.jsx'
import { MATCHES } from '../src/data/matches.js'
import { FollowProvider } from '../src/context/follow.jsx'

const base = MATCHES.find((m) => m.num === 28) // Mexico v South Korea

function renderDetail(match = base, props = {}) {
  return render(
    <FollowProvider>
      <MatchDetail match={match} tz="America/New_York" onClose={() => {}} {...props} />
    </FollowProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  global.URL.createObjectURL = vi.fn(() => 'blob:fake')
  global.URL.revokeObjectURL = vi.fn()
})

describe('MatchDetail one-off status', () => {
  it('returns null with no match (guard)', () => {
    const { container } = render(
      <FollowProvider>
        <MatchDetail match={null} tz="America/New_York" onClose={() => {}} />
      </FollowProvider>,
    )
    expect(container.querySelector('.md-card')).not.toBeInTheDocument()
  })

  it('postponed: status pill, no score, no LIVE', () => {
    renderDetail({ ...base, voided: true, statusLabel: 'Postponed' })
    expect(screen.getByText(/Postponed/)).toBeInTheDocument()
    expect(screen.getByText(/⏸/)).toBeInTheDocument()
    expect(screen.queryByText('● LIVE')).not.toBeInTheDocument()
    expect(screen.getByText('vs')).toBeInTheDocument()
  })

  it('canceled: warning pill', () => {
    renderDetail({ ...base, voided: true, statusLabel: 'Canceled' })
    expect(screen.getByText(/Canceled/)).toBeInTheDocument()
    expect(screen.getByText(/⚠/)).toBeInTheDocument()
  })

  it('abandoned: labeled partial score, no source confirmation', () => {
    renderDetail({ ...base, voided: true, statusLabel: 'Abandoned', score: [1, 1], scoreCheck: { agree: true, count: 3 } })
    expect(screen.getAllByText('Abandoned').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/1–1/)).toBeInTheDocument()
    expect(screen.queryByText(/confirmed by/)).not.toBeInTheDocument()
  })

  it('abandoned respects spoiler mode', () => {
    renderDetail({ ...base, voided: true, statusLabel: 'Abandoned', score: [2, 0] }, { hideScores: true })
    expect(screen.getByText(/reveal/)).toBeInTheDocument()
    expect(screen.queryByText(/2–0/)).not.toBeInTheDocument()
  })

  it('awarded: normal final with note', () => {
    renderDetail({ ...base, score: [3, 0], awarded: true })
    expect(screen.getByText('awarded')).toBeInTheDocument()
    expect(screen.getByText(/3–0/)).toBeInTheDocument()
  })
})

describe('MatchDetail normal states (full coverage)', () => {
  it('upcoming: "vs", no score sections', () => {
    renderDetail()
    expect(screen.getByText('vs')).toBeInTheDocument()
    expect(screen.queryByText('Match events')).not.toBeInTheDocument()
  })

  it('live via m.live flag', () => {
    renderDetail({ ...base, live: {} })
    expect(screen.getByText('● LIVE')).toBeInTheDocument()
  })

  it('past kickoff with no m.live → Delayed (not LIVE)', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(base.ko))
      renderDetail()
      expect(screen.getByText(/Delayed/)).toBeInTheDocument()
      expect(screen.queryByText('● LIVE')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('finished with pens (md-extra pens)', () => {
    renderDetail({ ...base, score: [1, 1], pens: [4, 2] })
    expect(screen.getByText(/pens 4–2/)).toBeInTheDocument()
  })

  it('finished AET (after extra time)', () => {
    renderDetail({ ...base, score: [2, 1], aet: true })
    expect(screen.getByText(/after extra time/)).toBeInTheDocument()
  })

  it('timeline renders goals (pen + OG), cards (red/yellow), subs', () => {
    const m = {
      ...base,
      score: [2, 1],
      goals: {
        t1: [{ minute: 10, name: 'A' }, { minute: 45, extra: 2, name: 'B', penalty: true }],
        t2: [{ minute: 30, name: 'C', og: true }],
      },
      cards: {
        t1: [{ minute: 50, name: 'D', color: 'yellow' }],
        t2: [{ minute: 70, name: 'E', color: 'red' }],
      },
      subs: { t1: [{ minute: 60, names: ['On', 'Off'] }], t2: [] },
    }
    renderDetail(m)
    expect(screen.getByText('Match events')).toBeInTheDocument()
    expect(screen.getByText('(pen)')).toBeInTheDocument()
    expect(screen.getByText('(OG)')).toBeInTheDocument()
    expect(screen.getByText('On / Off')).toBeInTheDocument()
    expect(screen.getByText('45+2\'')).toBeInTheDocument()
  })

  it('timeline shows "No events yet." when score but no events', () => {
    renderDetail({ ...base, score: [0, 0] })
    expect(screen.getByText('No events yet.')).toBeInTheDocument()
  })

  it('spoiler reveal flow', () => {
    renderDetail({ ...base, score: [3, 0] }, { hideScores: true })
    fireEvent.click(screen.getByText(/reveal/))
    expect(screen.getByText(/3–0/)).toBeInTheDocument()
  })

  it('follow star toggles', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Follow Mexico' }))
    expect(screen.getByRole('button', { name: 'Unfollow Mexico' })).toBeInTheDocument()
  })

  it('close button and overlay click invoke onClose', () => {
    const onClose = vi.fn()
    renderDetail(base, { onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('dialog'))
    // Clicking inside the card does not close.
    fireEvent.click(screen.getByText('vs'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('downloads ICS', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }))
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })

  it('knockout placeholder: no follow star', () => {
    const k = MATCHES.find((m) => m.stage === 'R32')
    renderDetail(k)
    expect(screen.queryByRole('button', { name: /^Follow/ })).not.toBeInTheDocument()
  })
})
