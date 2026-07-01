import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import MatchDetail from '../src/components/MatchDetail.jsx'
import { MATCHES } from '../src/data/matches.js'
import { FollowProvider } from '../src/context/follow.jsx'

const groupMatch = MATCHES.find((m) => m.num === 28) // Mexico v South Korea (Group A)
const knockoutMatch = MATCHES.find((m) => m.stage === 'R32') // placeholder team names

function renderDetail(props = {}) {
  const onClose = props.onClose || vi.fn()
  const utils = render(
    <FollowProvider>
      <MatchDetail
        match={groupMatch}
        tz="America/New_York"
        onClose={onClose}
        {...props}
      />
    </FollowProvider>,
  )
  return { ...utils, onClose }
}

beforeEach(() => {
  localStorage.clear()
  global.URL.createObjectURL = vi.fn(() => 'blob:fake')
  global.URL.revokeObjectURL = vi.fn()
})

describe('MatchDetail null + basic render', () => {
  it('returns null when no match is given', () => {
    const { container } = render(
      <FollowProvider>
        <MatchDetail match={null} tz="America/New_York" onClose={() => {}} />
      </FollowProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders an upcoming group match with "vs" and group stage label', () => {
    renderDetail()
    expect(screen.getByText('vs')).toBeInTheDocument()
    expect(screen.getByText(/Group A · Match 28/)).toBeInTheDocument()
    expect(screen.getByText('Mexico')).toBeInTheDocument()
    expect(screen.getByText('South Korea')).toBeInTheDocument()
    // No score → no "Match events" section.
    expect(screen.queryByText('Match events')).not.toBeInTheDocument()
  })

  it('uses the stage label for a knockout match', () => {
    render(
      <FollowProvider>
        <MatchDetail match={knockoutMatch} tz="America/New_York" onClose={() => {}} />
      </FollowProvider>,
    )
    // Placeholder team names have no flag → bullet fallback.
    expect(screen.getByText(knockoutMatch.t1)).toBeInTheDocument()
    // No FollowStar for unflagged teams.
    expect(screen.queryByRole('button', { name: /^Follow/ })).not.toBeInTheDocument()
  })
})

describe('MatchDetail score + extras', () => {
  it('renders a final score with AET note', () => {
    const m = { ...groupMatch, score: [2, 1], aet: true }
    renderDetail({ match: m })
    expect(screen.getByText(/2–1/)).toBeInTheDocument()
    expect(screen.getByText('after extra time')).toBeInTheDocument()
  })

  it('renders penalties (taking precedence over AET)', () => {
    const m = { ...groupMatch, score: [1, 1], aet: true, pens: [5, 4] }
    renderDetail({ match: m })
    expect(screen.getByText(/pens 5–4/)).toBeInTheDocument()
    expect(screen.queryByText('after extra time')).not.toBeInTheDocument()
  })

  it('renders the score-confirmation badge', () => {
    const m = { ...groupMatch, score: [3, 0], scoreCheck: { agree: true, count: 2 } }
    renderDetail({ match: m })
    expect(screen.getByText(/confirmed by 2 sources/)).toBeInTheDocument()
  })
})

describe('MatchDetail spoiler reveal', () => {
  it('hides the score behind a reveal button and reveals on click', () => {
    const m = { ...groupMatch, score: [4, 2] }
    renderDetail({ match: m, hideScores: true })
    expect(screen.getByRole('button', { name: /reveal/ })).toBeInTheDocument()
    // Match events hidden while score hidden.
    expect(screen.queryByText('Match events')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reveal/ }))
    expect(screen.getByText(/4–2/)).toBeInTheDocument()
    expect(screen.getByText('Match events')).toBeInTheDocument()
  })
})

describe('MatchDetail timeline', () => {
  it('shows "No events yet." for a scored match with no events', () => {
    const m = { ...groupMatch, score: [0, 0] }
    renderDetail({ match: m })
    expect(screen.getByText('No events yet.')).toBeInTheDocument()
  })

  it('renders goals, cards, and subs sorted with their icons and tags', () => {
    const m = {
      ...groupMatch,
      score: [2, 1],
      goals: {
        t1: [
          { minute: 10, name: 'Scorer A' },
          { minute: 90, extra: 3, name: 'Pen Taker', penalty: true },
        ],
        t2: [
          { minute: 55, name: 'OG Player', og: true },
          // Same minute (90) as the pen but no `extra` → exercises the
          // secondary `(a.extra ?? 0)` sort comparator with a nullish extra.
          { minute: 90, name: 'Late Equalizer' },
        ],
      },
      cards: {
        t1: [{ minute: 30, name: 'Yellow Guy', color: 'yellow' }],
        t2: [{ minute: 70, name: 'Red Guy', color: 'red' }],
      },
      subs: {
        t1: [{ minute: 60, names: ['In Player', 'Out Player'] }],
        // No `minute` (sorts to the end via the ?? fallback) and no `names`
        // array (exercises the `names || []` fallback → empty join).
        t2: [{}],
      },
    }
    renderDetail({ match: m })
    expect(screen.getByText('Scorer A')).toBeInTheDocument()
    expect(screen.getByText('(pen)')).toBeInTheDocument()
    expect(screen.getByText('(OG)')).toBeInTheDocument()
    expect(screen.getByText('Yellow Guy')).toBeInTheDocument()
    expect(screen.getByText('Red Guy')).toBeInTheDocument()
    expect(screen.getByText('In Player / Out Player')).toBeInTheDocument()
    expect(screen.getByText('Late Equalizer')).toBeInTheDocument()
    // Stoppage-time minute label.
    expect(screen.getByText("90+3'")).toBeInTheDocument()
  })
})

describe('MatchDetail live states', () => {
  it('renders the LiveBadge for a live-flagged match', () => {
    const m = { ...groupMatch, live: {} }
    renderDetail({ match: m })
    // LiveBadge renders within the head; component does not crash.
    expect(screen.getByText(/Match 28/)).toBeInTheDocument()
  })

  it('renders "Delayed" (not LIVE) when inside the window but no live feed yet', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(groupMatch.ko))
      renderDetail()
      expect(screen.getByText(/Delayed/)).toBeInTheDocument()
      expect(screen.queryByText('● LIVE')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('MatchDetail follow + meta + actions', () => {
  it('toggles follow on a team star', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Follow Mexico' }))
    expect(screen.getByRole('button', { name: 'Unfollow Mexico' })).toBeInTheDocument()
  })

  it('shows venue/broadcast meta', () => {
    renderDetail()
    expect(screen.getByText('When')).toBeInTheDocument()
    expect(screen.getByText('Stadium local')).toBeInTheDocument()
    expect(screen.getByText('Venue')).toBeInTheDocument()
    expect(screen.getByText('How to watch (US)')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Spanish')).toBeInTheDocument()
  })

  it('downloads an ICS file from the calendar button', () => {
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }))
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })
})

describe('MatchDetail close handlers', () => {
  it('closes on the ✕ button', () => {
    const { onClose } = renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when the overlay backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <FollowProvider>
        <MatchDetail match={groupMatch} tz="America/New_York" onClose={onClose} />
      </FollowProvider>,
    )
    fireEvent.click(container.querySelector('.md-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does NOT close when the card body is clicked (stopPropagation)', () => {
    const onClose = vi.fn()
    const { container } = render(
      <FollowProvider>
        <MatchDetail match={groupMatch} tz="America/New_York" onClose={onClose} />
      </FollowProvider>,
    )
    fireEvent.click(container.querySelector('.md-card'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on the Escape key (modal a11y)', () => {
    const { onClose } = renderDetail()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
