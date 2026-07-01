import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import MatchCard from '../src/components/MatchCard.jsx'
import { MATCHES } from '../src/data/matches.js'
import { groupSlotMap } from '../src/utils/bracket.js'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import { VENUES } from '../src/data/venues.js'

const SLOT_MAP = groupSlotMap(MATCHES)
const groupMatch = MATCHES.find((m) => m.num === 28) // Mexico v South Korea (Group A)
const knockoutMatch = MATCHES.find((m) => m.stage === 'R32') // placeholder team names (TBD)

function renderCard(props = {}, openDetail = () => {}) {
  return render(
    <FollowProvider>
      <DetailContext.Provider value={openDetail}>
        <MatchCard
          match={groupMatch}
          tz="America/New_York"
          slotMap={SLOT_MAP}
          {...props}
        />
      </DetailContext.Provider>
    </FollowProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  // downloadICS uses URL.createObjectURL which jsdom lacks.
  global.URL.createObjectURL = vi.fn(() => 'blob:fake')
  global.URL.revokeObjectURL = vi.fn()
})

describe('MatchCard rendering states', () => {
  it('renders an upcoming group match with the "v" separator and no badge', () => {
    vi.useFakeTimers()
    try {
      // Pin "now" before kickoff so the time-based status is "upcoming".
      vi.setSystemTime(new Date(new Date(groupMatch.ko).getTime() - 60 * 60 * 1000))
      const { container } = renderCard()
      expect(container.querySelector('.vs')).toHaveTextContent('v')
      expect(screen.getByText('Mexico')).toBeInTheDocument()
      expect(screen.getByText('South Korea')).toBeInTheDocument()
      // No live/FT badge for upcoming.
      expect(screen.queryByText('FT')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders a finished match score and AET extra', () => {
    const m = { ...groupMatch, score: [2, 1], aet: true }
    const { container } = renderCard({ match: m })
    expect(container.querySelector('.score')).toHaveTextContent('2–1')
    expect(screen.getByText('AET')).toBeInTheDocument()
    expect(screen.getByLabelText('Full time')).toHaveTextContent('FT')
  })

  it('renders a finished match with penalties (pens take precedence over AET)', () => {
    const m = { ...groupMatch, score: [1, 1], aet: true, pens: [4, 3] }
    renderCard({ match: m })
    expect(screen.getByText(/pens 4–3/)).toBeInTheDocument()
    expect(screen.queryByText('AET')).not.toBeInTheDocument()
  })

  it('renders a score confirmation badge from scoreCheck', () => {
    const m = { ...groupMatch, score: [2, 0], scoreCheck: { agree: true, count: 3 } }
    renderCard({ match: m })
    expect(screen.getByText(/confirmed by 3 sources/)).toBeInTheDocument()
  })

  it('shows the LIVE badge for a match flagged live (no ESPN clock)', () => {
    const m = { ...groupMatch, live: {} }
    renderCard({ match: m })
    expect(screen.getByText('● LIVE')).toBeInTheDocument()
  })

  it('shows "Delayed" (not LIVE) when past kickoff but no live feed yet', () => {
    vi.useFakeTimers()
    try {
      // "now" is inside the match window but there's no ESPN live flag → the match
      // is past kickoff and not confirmed started, so it reads Delayed, not LIVE.
      vi.setSystemTime(new Date(groupMatch.ko))
      renderCard()
      expect(screen.getByText(/Delayed/)).toBeInTheDocument()
      expect(screen.queryByText('● LIVE')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('MatchCard spoiler mode', () => {
  it('hides the score behind a tap-to-reveal pill and reveals on click', () => {
    const m = { ...groupMatch, score: [3, 0], scoreCheck: { agree: true, count: 2 } }
    const { container } = renderCard({ match: m, hidden: true })
    expect(screen.getByText('tap to reveal')).toBeInTheDocument()
    // ScoreCheck is hidden while the score is hidden.
    expect(screen.queryByText(/confirmed by/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Reveal score'))
    expect(container.querySelector('.score')).toHaveTextContent('3–0')
    expect(screen.getByText(/confirmed by 2 sources/)).toBeInTheDocument()
  })
})

describe('MatchCard team follow + clinch + slot tooltip', () => {
  it('toggles follow state when the star is clicked', () => {
    renderCard()
    const followBtn = screen.getByRole('button', { name: 'Follow Mexico' })
    fireEvent.click(followBtn)
    expect(screen.getByRole('button', { name: 'Unfollow Mexico' })).toBeInTheDocument()
  })

  it('renders a clinch badge for a team', () => {
    renderCard({ clinch: { Mexico: 'won-group' } })
    expect(screen.getByText(/Won group/)).toBeInTheDocument()
  })

  it('shows the eliminated slot tooltip', () => {
    renderCard({ clinch: { Mexico: 'eliminated' } })
    expect(screen.getByText('Mexico').getAttribute('title')).toMatch(
      /Eliminated from Group A/,
    )
  })

  it('renders TBD placeholder team (no flag) for a knockout slot', () => {
    render(
      <FollowProvider>
        <DetailContext.Provider value={() => {}}>
          <MatchCard match={knockoutMatch} tz="America/New_York" slotMap={SLOT_MAP} />
        </DetailContext.Provider>
      </FollowProvider>,
    )
    // Placeholder names have no flag → fallback flag, no follow star, no slot tooltip.
    expect(screen.getByText(knockoutMatch.t1)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Follow/ })).not.toBeInTheDocument()
  })
})

describe('MatchCard actions', () => {
  it('toggles the "How to watch" panel and shows both feeds by default', () => {
    renderCard()
    const toggle = screen.getByRole('button', { name: /How to watch/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Spanish')).toBeInTheDocument()
  })

  it('shows only the english feed when feed="english"', () => {
    renderCard({ feed: 'english' })
    fireEvent.click(screen.getByRole('button', { name: /How to watch/ }))
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.queryByText('Spanish')).not.toBeInTheDocument()
  })

  it('shows only the spanish feed when feed="spanish"', () => {
    renderCard({ feed: 'spanish' })
    fireEvent.click(screen.getByRole('button', { name: /How to watch/ }))
    expect(screen.getByText('Spanish')).toBeInTheDocument()
    expect(screen.queryByText('English')).not.toBeInTheDocument()
  })

  it('renders the free-over-the-air chip tag', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /How to watch/ }))
    // At least one feed marks a TV channel as free.
    expect(screen.getAllByText('free').length).toBeGreaterThan(0)
  })

  it('downloads an ICS file when "Add to calendar" is clicked', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }))
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })

  it('opens the detail modal via the Details button', () => {
    const openDetail = vi.fn()
    renderCard({}, openDetail)
    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    expect(openDetail).toHaveBeenCalledWith(groupMatch)
  })
})

describe('MatchCard venue local time', () => {
  it('shows the venue local clock when it differs from the viewer clock', () => {
    // A non-Eastern venue match viewed from New York differs in clock time.
    const pacificMatch = MATCHES.find((m) => {
      const tz = VENUES[m.venue]?.tz
      return tz === 'America/Los_Angeles' || tz === 'America/Vancouver'
    })
    render(
      <FollowProvider>
        <DetailContext.Provider value={() => {}}>
          <MatchCard match={pacificMatch} tz="America/New_York" slotMap={SLOT_MAP} />
        </DetailContext.Provider>
      </FollowProvider>,
    )
    expect(screen.getByText(/local/)).toBeInTheDocument()
  })

  it('omits the venue local clock when viewer tz matches the venue tz', () => {
    // Viewing in the venue's own timezone makes sameClock true.
    const m = MATCHES.find((x) => x.num === 28)
    render(
      <FollowProvider>
        <DetailContext.Provider value={() => {}}>
          <MatchCard match={m} tz={VENUES[m.venue].tz} slotMap={SLOT_MAP} />
        </DetailContext.Provider>
      </FollowProvider>,
    )
    expect(screen.queryByText(/local$/)).not.toBeInTheDocument()
  })
})
