import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StatsView from '../src/components/StatsView.jsx'
import { DetailContext } from '../src/context/detail.js'
import { fetchBootExtras, fetchRecentPlayerStats } from '../src/services/espnStats.js'

// The official-tiebreak enrichment is fetched on mount; default to "nothing
// came back" so the base tests exercise the un-enriched table.
vi.mock('../src/services/espnStats.js', () => ({
  fetchBootExtras: vi.fn(async () => []),
  fetchRecentPlayerStats: vi.fn(async () => []),
}))
vi.mock('../src/services/espnMatchStats.js', () => ({
  fetchMatchLines: vi.fn(async () => ({ length: 90, byName: {} })),
}))

beforeEach(() => {
  fetchBootExtras.mockClear()
  fetchBootExtras.mockImplementation(async () => [])
  fetchRecentPlayerStats.mockClear()
  fetchRecentPlayerStats.mockImplementation(async () => [])
})

// A kickoff recent enough that StatsView treats the match as still reconcilable.
const recentKo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString()

const matches = [
  {
    num: 1,
    stage: 'Group',
    t1: 'Mexico',
    t2: 'South Korea',
    score: [2, 1],
    goals: {
      t1: [{ name: 'Raúl Jiménez' }, { name: 'Raúl Jiménez', penalty: true }],
      t2: [{ name: 'Son Heung-min' }],
    },
  },
  {
    num: 2,
    stage: 'Group',
    t1: 'Mexico',
    t2: 'Canada',
    score: [1, 1],
    goals: { t1: [{ name: 'Raúl Jiménez' }], t2: [{ name: 'Jonathan David' }] },
  },
]

describe('StatsView', () => {
  it('renders totals and the Golden Boot table', () => {
    render(<StatsView matches={matches} hideScores={false} />)
    expect(screen.getByText('👟 Golden Boot race')).toBeInTheDocument()
    // Leader with 3 goals (1 pen noted), sharing the table with the 1-goal pack.
    expect(screen.getByText('Raúl Jiménez')).toBeInTheDocument()
    expect(screen.getByText('1 pen')).toBeInTheDocument()
    expect(screen.getByText('Son Heung-min')).toBeInTheDocument()
    // Totals strip: 2 matches, 5 goals.
    expect(screen.getByText('matches played').previousSibling).toHaveTextContent('2')
    expect(screen.getByText('goals').previousSibling).toHaveTextContent('5')
  })

  it('ranks ties with a shared rank', () => {
    render(<StatsView matches={matches} hideScores={false} />)
    const rows = screen.getAllByRole('row').slice(1) // skip header
    // Leader row is rank 1; the two 1-goal scorers share rank 2 (second shows blank).
    expect(rows[0]).toHaveTextContent('Raúl Jiménez')
    expect(rows[1].cells[0]).toHaveTextContent('2')
    expect(rows[2].cells[0]).toHaveTextContent('')
  })

  it('stays behind a reveal in spoiler-free mode', () => {
    render(<StatsView matches={matches} hideScores />)
    expect(screen.queryByText('👟 Golden Boot race')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('🙈 reveal stats'))
    expect(screen.getByText('👟 Golden Boot race')).toBeInTheDocument()
  })

  it('shows an empty note when no goals exist yet', () => {
    render(<StatsView matches={[{ num: 1, stage: 'Group', t1: 'A', t2: 'B' }]} hideScores={false} />)
    expect(screen.getByText('No goals recorded yet.')).toBeInTheDocument()
  })

  it('adds assists/minutes columns and award ordering once ESPN extras load', async () => {
    // Son (1 goal) gets an assist edge over Jonathan David (1 goal, 0 assists).
    fetchBootExtras.mockImplementation(async () => [
      { name: 'Raúl Jiménez', goals: 3, assists: 0, minutes: 180 },
      { name: 'Son Heung-min', goals: 1, assists: 3, minutes: 90 },
      { name: 'Jonathan David', goals: 1, assists: 0, minutes: 90 },
    ])
    render(<StatsView matches={matches} hideScores={false} />)
    expect(await screen.findByTitle('Assists')).toBeInTheDocument()
    expect(screen.getByTitle('Minutes played')).toBeInTheDocument()
    expect(screen.getByText(/official award criteria/)).toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1)
    // Award order: Jiménez (3g), then Son above David on assists; all get ranks
    // (no shared rank — the full key differs).
    expect(rows[0]).toHaveTextContent('Raúl Jiménez')
    expect(rows[1]).toHaveTextContent('Son Heung-min')
    expect(rows[1].cells[0]).toHaveTextContent('2')
    expect(rows[2]).toHaveTextContent('Jonathan David')
    expect(rows[2].cells[0]).toHaveTextContent('3')
    // Son's row shows his 3 assists and 90 minutes.
    expect(rows[1].cells[4]).toHaveTextContent('3')
    expect(rows[1].cells[5]).toHaveTextContent('90')
  })

  it('bolds scorers whose team still has football to play', () => {
    // Add an unplayed SF for Mexico → Jiménez & co. are active; the others frozen.
    const withRemaining = [...matches, { num: 101, stage: 'SF', t1: 'Mexico', t2: 'France' }]
    render(<StatsView matches={withRemaining} hideScores={false} />)
    const rows = screen.getAllByRole('row').slice(1)
    const jimenez = rows.find((r) => r.textContent.includes('Raúl Jiménez'))
    const son = rows.find((r) => r.textContent.includes('Son Heung-min'))
    expect(jimenez.className).toContain('boot-active')
    expect(son.className).not.toContain('boot-active')
    expect(screen.getByText(/still in the tournament/)).toBeInTheDocument()
  })

  it('bolds nothing (and drops the legend) once the tournament is over', () => {
    render(<StatsView matches={matches} hideScores={false} />)
    expect(document.querySelector('.boot-active')).toBeNull()
    expect(screen.queryByText(/still in the tournament/)).not.toBeInTheDocument()
  })

  it('keeps the fallback ordering when the extras fetch fails', async () => {
    fetchBootExtras.mockImplementation(async () => { throw new Error('offline') })
    render(<StatsView matches={matches} hideScores={false} />)
    expect(screen.getByText('👟 Golden Boot race')).toBeInTheDocument()
    expect(screen.queryByTitle('Assists')).not.toBeInTheDocument()
    expect(await screen.findByText(/official award would split them/)).toBeInTheDocument()
  })

  it('force-refreshes the extras the moment the goal tally changes', async () => {
    const { rerender } = render(<StatsView matches={matches} hideScores={false} />)
    expect(fetchBootExtras).toHaveBeenCalledTimes(1)
    expect(fetchBootExtras.mock.calls[0][1]).toEqual({ force: false })
    // Same matches identity-refreshed but no new goal → no refetch.
    rerender(<StatsView matches={[...matches]} hideScores={false} />)
    expect(fetchBootExtras).toHaveBeenCalledTimes(1)
    // A goal lands → refetch, skipping the cache.
    const scored = matches.map((m) =>
      m.num === 2
        ? { ...m, goals: { ...m.goals, t2: [...m.goals.t2, { name: 'Alphonso Davies', minute: 80 }] } }
        : m,
    )
    rerender(<StatsView matches={scored} hideScores={false} />)
    expect(fetchBootExtras).toHaveBeenCalledTimes(2)
    expect(fetchBootExtras.mock.calls[1][1]).toEqual({ force: true })
  })

  it('overrides the lagging aggregate assists + minutes for a live match', async () => {
    // Aggregate credits Jiménez 2 assists / 300 min; his true totals are 4 / 320.
    fetchBootExtras.mockImplementation(async () => [
      { name: 'Raúl Jiménez', goals: 3, assists: 2, minutes: 300 },
    ])
    fetchRecentPlayerStats.mockImplementation(async () => [{ name: 'Raúl Jiménez', assists: 4, minutes: 320 }])
    const live = [
      ...matches,
      { num: 101, stage: 'SF', t1: 'Mexico', t2: 'France', score: [0, 0], live: { minute: 80 }, espnId: '999', ko: recentKo(), goals: { t1: [], t2: [] } },
    ]
    render(<StatsView matches={live} hideScores={false} />)
    const row = (await screen.findByText('Raúl Jiménez')).closest('tr')
    expect(row.cells[4]).toHaveTextContent('4') // assists
    expect(row.cells[5]).toHaveTextContent('320') // minutes
    expect(fetchRecentPlayerStats).toHaveBeenCalled()
  })

  it('fills in minutes for a scorer the aggregate omits entirely (outside ESPN leaders)', async () => {
    // Lautaro-style: 2 goals, not in the leader lists, so no aggregate row — but
    // a recent match lets us recompute his assists + minutes from box scores.
    fetchBootExtras.mockImplementation(async () => [
      { name: 'Raúl Jiménez', goals: 3, assists: 5, minutes: 300 },
    ])
    fetchRecentPlayerStats.mockImplementation(async () => [{ name: 'Lautaro Martínez', assists: 1, minutes: 311 }])
    const finished = [
      { num: 1, stage: 'Group', t1: 'Argentina', t2: 'Chile', score: [2, 0], ko: recentKo(), espnId: '999',
        goals: { t1: [{ name: 'Lautaro Martínez' }, { name: 'Lautaro Martínez' }], t2: [] } },
    ]
    render(<StatsView matches={finished} hideScores={false} />)
    const row = (await screen.findByText('Lautaro Martínez')).closest('tr')
    expect(row.cells[4]).toHaveTextContent('1') // assists filled in
    expect(row.cells[5]).toHaveTextContent('311') // minutes filled in — not '—'
    expect(fetchRecentPlayerStats).toHaveBeenCalled()
  })

  it('clicking a player opens their match-by-match popup', () => {
    render(<StatsView matches={matches} hideScores={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Son Heung-min' }))
    expect(screen.getByRole('dialog', { name: /Son Heung-min — match by match/ })).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('marks players whose team is in a live match with an in-action dot', () => {
    const live = [...matches, { num: 101, stage: 'SF', t1: 'Mexico', t2: 'France', score: [0, 0], live: { minute: 10 }, goals: { t1: [], t2: [] } }]
    render(<StatsView matches={live} hideScores={false} />)
    const rows = screen.getAllByRole('row').slice(1)
    const jimenez = rows.find((r) => r.textContent.includes('Raúl Jiménez'))
    const son = rows.find((r) => r.textContent.includes('Son Heung-min'))
    expect(jimenez.querySelector('.boot-live')).toBeTruthy() // Mexico are playing now
    expect(son.querySelector('.boot-live')).toBeNull()
    expect(screen.getByText(/in action right now/)).toBeInTheDocument()
  })

  it('keeps refreshing on an interval while a match is live', async () => {
    vi.useFakeTimers()
    try {
      const live = [...matches, { num: 101, stage: 'SF', t1: 'Mexico', t2: 'France', score: [0, 0], live: { minute: 10 }, goals: { t1: [], t2: [] } }]
      render(<StatsView matches={live} hideScores={false} />)
      expect(fetchBootExtras).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000)
      expect(fetchBootExtras).toHaveBeenCalledTimes(2)
      expect(fetchBootExtras.mock.calls[1][1]).toEqual({ force: true })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('StatsView enrichment failures', () => {
  // Both enrichment calls are best-effort: the boot table is built from the
  // committed goals and stands on its own. A refused or offline request must
  // leave the rendered table exactly as it was, not blank it or surface an error.
  it('keeps the table when the interval refresh is refused', async () => {
    vi.useFakeTimers()
    try {
      const live = [...matches, { num: 61, stage: 'SF', t1: 'Japan', t2: 'Colombia', score: [0, 0], live: { minute: 10 }, goals: { t1: [], t2: [] } }]
      render(<StatsView matches={live} hideScores={false} />)
      const before = screen.getAllByRole('row').length
      fetchBootExtras.mockImplementation(async () => {
        throw new Error('offline')
      })
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000)
      expect(fetchBootExtras).toHaveBeenCalledTimes(2)
      expect(screen.getAllByRole('row')).toHaveLength(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the table when the per-match reconciliation is refused', async () => {
    fetchRecentPlayerStats.mockImplementation(async () => {
      throw new Error('offline')
    })
    const recent = [
      ...matches,
      { num: 62, stage: 'SF', t1: 'Japan', t2: 'Colombia', ko: recentKo(), score: [1, 0], espnId: 'e62', goals: { t1: [{ name: 'Hinata Miyazawa' }], t2: [] } },
    ]
    render(<StatsView matches={recent} hideScores={false} />)
    await vi.waitFor(() => expect(fetchRecentPlayerStats).toHaveBeenCalled())
    // The committed aggregate still stands behind the failed override.
    expect(screen.getByText('Hinata Miyazawa')).toBeInTheDocument()
  })
})

describe('StatsView — enrichment that arrives, and a scorer the tables barely know', () => {
  it('adopts an interval refresh that actually brings something back', async () => {
    vi.useFakeTimers()
    try {
      const live = [...matches, { num: 63, stage: 'SF', t1: 'Mexico', t2: 'France', score: [0, 0], live: { minute: 10 }, goals: { t1: [], t2: [] } }]
      render(<StatsView matches={live} hideScores={false} />)
      // The mount call returns nothing, so the table starts un-enriched.
      expect(screen.queryByTitle('Assists')).toBeNull()
      fetchBootExtras.mockImplementation(async () => [
        { name: 'Raúl Jiménez', goals: 3, assists: 2, minutes: 270 },
      ])
      // The re-render is driven by a timer and a promise, so flush both inside
      // act or the assertion runs against the pre-update tree.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000)
      })
      // The refresh brought rows this time, so the assists/minutes columns appear.
      expect(screen.getByTitle('Assists')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears the per-match overrides when the reconciliation comes back empty', async () => {
    // A recent match to reconcile, but ESPN has nothing to say about any of the
    // shown scorers. The overrides must be cleared rather than set to an empty
    // list, so the committed aggregate stands on its own.
    const recent = [
      ...matches,
      { num: 64, stage: 'SF', t1: 'Mexico', t2: 'France', ko: recentKo(), score: [1, 0], espnId: 'e64', goals: { t1: [{ name: 'Raúl Jiménez' }], t2: [] } },
    ]
    render(<StatsView matches={recent} hideScores={false} />)
    await vi.waitFor(() => expect(fetchRecentPlayerStats).toHaveBeenCalled())
    expect(screen.getByText('Raúl Jiménez')).toBeInTheDocument()
  })

  it('falls back for a scorer whose team has no flag, and pluralises their penalties', () => {
    // An upstream re-spelling the flag table has never carried, with a scorer on
    // two penalties — both the fallback mark and the plural have to render.
    const odd = [
      {
        num: 65,
        stage: 'Group',
        t1: 'Nowhere United',
        t2: 'Mexico',
        score: [2, 0],
        goals: {
          t1: [
            { name: 'Spot Kicker', penalty: true },
            { name: 'Spot Kicker', penalty: true },
          ],
          t2: [],
        },
      },
    ]
    render(<StatsView matches={odd} hideScores={false} />)
    expect(document.querySelector('.boot-flag').textContent).toBe('•')
    expect(screen.getByText('2 pens')).toBeInTheDocument()
  })
})

describe('StatsView tile drill-down', () => {
  const knockout = [
    ...matches,
    { num: 90, stage: 'R16', t1: 'France', t2: 'Ghana', ko: '2026-07-06T15:00:00-04:00', score: [2, 1], aet: true },
    { num: 97, stage: 'QF', t1: 'Spain', t2: 'Brazil', ko: '2026-07-10T15:00:00-04:00', score: [1, 1], aet: true, pens: [4, 2] },
  ]

  it('expands the extra-time tile into its match list (shootout noted)', () => {
    render(<StatsView matches={knockout} hideScores={false} />)
    const tile = screen.getByRole('button', { name: /extra-time games/ })
    expect(tile).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(tile)
    expect(screen.getByText(/Went to extra time \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/France 2–1 Ghana/)).toBeInTheDocument()
    expect(screen.getByText(/Spain 1–1 Brazil/)).toBeInTheDocument()
    expect(screen.getByText('pens 4–2')).toBeInTheDocument()
    expect(screen.getByText(/1 of these went all the way to penalties/)).toBeInTheDocument()
    fireEvent.click(tile) // toggles closed
    expect(screen.queryByText(/Went to extra time/)).not.toBeInTheDocument()
  })

  it('expands shootouts separately, and a row opens the match detail', () => {
    const openDetail = vi.fn()
    render(
      <DetailContext.Provider value={openDetail}>
        <StatsView matches={knockout} hideScores={false} />
      </DetailContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /shootouts/ }))
    expect(screen.getByText(/Decided from the spot \(1\)/)).toBeInTheDocument()
    expect(screen.queryByText(/France 2–1 Ghana/)).not.toBeInTheDocument() // ET-only tie stays out
    fireEvent.click(screen.getByText(/Spain 1–1 Brazil/))
    expect(openDetail).toHaveBeenCalledWith(expect.objectContaining({ num: 97 }))
  })

  it('disables the tiles when there is nothing behind them', () => {
    render(<StatsView matches={matches} hideScores={false} />)
    expect(screen.getByRole('button', { name: /extra-time games/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /shootouts/ })).toBeDisabled()
  })
})
