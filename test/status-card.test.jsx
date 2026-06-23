import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import MatchCard from '../src/components/MatchCard.jsx'
import { MATCHES } from '../src/data/matches.js'
import { groupSlotMap } from '../src/utils/bracket.js'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import { VENUES } from '../src/data/venues.js'

const SLOT_MAP = groupSlotMap(MATCHES)
const base = MATCHES.find((m) => m.num === 28) // Mexico v South Korea (Group A)
const knockout = MATCHES.find((m) => m.stage === 'R32')

function renderCard(match = base, props = {}, openDetail = () => {}) {
  return render(
    <FollowProvider>
      <DetailContext.Provider value={openDetail}>
        <MatchCard match={match} tz="America/New_York" slotMap={SLOT_MAP} {...props} />
      </DetailContext.Provider>
    </FollowProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  global.URL.createObjectURL = vi.fn(() => 'blob:fake')
  global.URL.revokeObjectURL = vi.fn()
})

describe('MatchCard one-off status', () => {
  it('postponed: shows a status pill, no countdown, no score', () => {
    renderCard({ ...base, voided: true, statusLabel: 'Postponed' })
    expect(screen.getByText(/Postponed/)).toBeInTheDocument()
    expect(screen.getByText(/⏸/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Full time')).not.toBeInTheDocument()
    expect(screen.queryByText('● LIVE')).not.toBeInTheDocument()
    expect(screen.getByText('v')).toBeInTheDocument()
  })

  it('canceled: shows the warning pill', () => {
    renderCard({ ...base, voided: true, statusLabel: 'Canceled' })
    expect(screen.getByText(/Canceled/)).toBeInTheDocument()
    expect(screen.getByText(/⚠/)).toBeInTheDocument()
  })

  it('abandoned: labeled partial score, no source confirmation, no FT', () => {
    renderCard({ ...base, voided: true, statusLabel: 'Abandoned', score: [1, 1], scoreCheck: { agree: true, count: 3 } })
    expect(screen.getAllByText('Abandoned').length).toBeGreaterThanOrEqual(1)
    expect(document.querySelector('.score')).toHaveTextContent('1–1')
    expect(screen.queryByText(/confirmed by/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Full time')).not.toBeInTheDocument()
  })

  it('abandoned respects spoiler mode (hidden score)', () => {
    renderCard({ ...base, voided: true, statusLabel: 'Abandoned', score: [2, 0] }, { hidden: true })
    expect(screen.getByText('tap to reveal')).toBeInTheDocument()
  })

  it('awarded: normal final with an "awarded" note', () => {
    renderCard({ ...base, score: [3, 0], awarded: true })
    expect(screen.getByText('awarded')).toBeInTheDocument()
    expect(screen.getByLabelText('Full time')).toHaveTextContent('FT')
    expect(document.querySelector('.score')).toHaveTextContent('3–0')
  })
})

describe('MatchCard normal states (full coverage)', () => {
  it('upcoming: "v" separator, no badge', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(new Date(base.ko).getTime() - 60 * 60 * 1000))
      renderCard()
      expect(screen.getByText('v')).toBeInTheDocument()
      expect(screen.queryByText('FT')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('finished: score, AET, FT badge, source confirmation', () => {
    renderCard({ ...base, score: [2, 1], aet: true, scoreCheck: { agree: true, count: 3 } })
    expect(document.querySelector('.score')).toHaveTextContent('2–1')
    expect(screen.getByText('AET')).toBeInTheDocument()
    expect(screen.getByLabelText('Full time')).toHaveTextContent('FT')
    expect(screen.getByText(/confirmed by 3 sources/)).toBeInTheDocument()
  })

  it('finished with pens (pens beat AET)', () => {
    renderCard({ ...base, score: [1, 1], aet: true, pens: [4, 3] })
    expect(screen.getByText(/pens 4–3/)).toBeInTheDocument()
    expect(screen.queryByText('AET')).not.toBeInTheDocument()
  })

  it('live via m.live flag (LiveBadge ● LIVE)', () => {
    renderCard({ ...base, live: {} })
    expect(screen.getByText('● LIVE')).toBeInTheDocument()
  })

  it('live via the time window', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(base.ko))
      renderCard()
      expect(screen.getByText('● LIVE')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('spoiler reveal flow', () => {
    renderCard({ ...base, score: [3, 0], scoreCheck: { agree: true, count: 2 } }, { hidden: true })
    expect(screen.getByText('tap to reveal')).toBeInTheDocument()
    expect(screen.queryByText(/confirmed by/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Reveal score'))
    expect(document.querySelector('.score')).toHaveTextContent('3–0')
    expect(screen.getByText(/confirmed by 2 sources/)).toBeInTheDocument()
  })
})

describe('MatchCard follow / clinch / slot tooltip', () => {
  it('toggles follow', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Follow Mexico' }))
    expect(screen.getByRole('button', { name: 'Unfollow Mexico' })).toBeInTheDocument()
  })

  it('won-group clinch badge + slot tooltip', () => {
    renderCard(base, { clinch: { Mexico: 'won-group' } })
    expect(screen.getByText(/Won group/)).toBeInTheDocument()
    expect(screen.getByText('Mexico').getAttribute('title')).toMatch(/Clinched Group A winner/)
  })

  it('eliminated slot tooltip', () => {
    renderCard(base, { clinch: { Mexico: 'eliminated' } })
    expect(screen.getByText('Mexico').getAttribute('title')).toMatch(/Eliminated from Group A/)
  })

  it('TBD knockout placeholder: no flag, no star, no slot tooltip', () => {
    renderCard(knockout)
    expect(screen.getByText(knockout.t1)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Follow/ })).not.toBeInTheDocument()
  })
})

describe('MatchCard actions / watch / venue', () => {
  it('watch toggle shows both feeds + free chip', () => {
    renderCard()
    const toggle = screen.getByRole('button', { name: /How to watch/ })
    fireEvent.click(toggle)
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Spanish')).toBeInTheDocument()
    expect(screen.getAllByText('free').length).toBeGreaterThan(0)
  })

  it('feed="english" shows only english', () => {
    renderCard(base, { feed: 'english' })
    fireEvent.click(screen.getByRole('button', { name: /How to watch/ }))
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.queryByText('Spanish')).not.toBeInTheDocument()
  })

  it('feed="spanish" shows only spanish', () => {
    renderCard(base, { feed: 'spanish' })
    fireEvent.click(screen.getByRole('button', { name: /How to watch/ }))
    expect(screen.getByText('Spanish')).toBeInTheDocument()
    expect(screen.queryByText('English')).not.toBeInTheDocument()
  })

  it('downloads ICS', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }))
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })

  it('opens detail', () => {
    const openDetail = vi.fn()
    renderCard(base, {}, openDetail)
    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    expect(openDetail).toHaveBeenCalledWith(base)
  })

  it('shows venue local clock when it differs', () => {
    const pacific = MATCHES.find((m) => {
      const tz = VENUES[m.venue]?.tz
      return tz === 'America/Los_Angeles' || tz === 'America/Vancouver'
    })
    renderCard(pacific)
    expect(screen.getByText(/local/)).toBeInTheDocument()
  })

  it('omits venue local clock when viewer tz matches venue tz', () => {
    render(
      <FollowProvider>
        <DetailContext.Provider value={() => {}}>
          <MatchCard match={base} tz={VENUES[base.venue].tz} slotMap={SLOT_MAP} />
        </DetailContext.Provider>
      </FollowProvider>,
    )
    expect(screen.queryByText(/local$/)).not.toBeInTheDocument()
  })
})
