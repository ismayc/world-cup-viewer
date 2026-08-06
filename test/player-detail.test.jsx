import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PlayerDetail from '../src/components/PlayerDetail.jsx'
import { DetailContext } from '../src/context/detail.js'
import { fetchMatchLines } from '../src/services/espnMatchStats.js'

vi.mock('../src/services/espnMatchStats.js', () => ({ fetchMatchLines: vi.fn() }))

const matches = [
  {
    num: 1, stage: 'Group', group: 'A', t1: 'Mexico', t2: 'South Korea',
    ko: '2026-06-11T15:00:00-04:00', espnId: 'e1', score: [2, 1],
    goals: { t1: [{ name: 'Raúl Jiménez', minute: 12 }, { name: 'Raúl Jiménez', minute: 55, penalty: true }], t2: [] },
  },
  {
    num: 74, stage: 'R32', t1: 'Germany', t2: 'Mexico',
    ko: '2026-06-29T15:00:00-04:00', espnId: 'e2', score: [1, 1], pens: [3, 4],
    goals: { t1: [], t2: [{ name: 'Raul Jimenez', minute: 88 }] }, // ESPN spelling, no accents
  },
  { num: 2, stage: 'Group', group: 'B', t1: 'France', t2: 'Canada', ko: '2026-06-12T15:00:00-04:00', espnId: 'e9', score: [1, 1], goals: { t1: [], t2: [] } },
  { num: 90, stage: 'R16', t1: 'Mexico', t2: 'Chile', ko: '2026-07-05T15:00:00-04:00' }, // unplayed → excluded
]

const scorer = { name: 'Raúl Jiménez', team: 'Mexico', goals: 3, pens: 1, assists: 2, minutes: 300 }

const renderPD = (onOpen = vi.fn()) => {
  const onClose = vi.fn()
  render(
    <DetailContext.Provider value={onOpen}>
      <PlayerDetail scorer={scorer} matches={matches} onClose={onClose} />
    </DetailContext.Provider>,
  )
  return { onOpen, onClose }
}

beforeEach(() => {
  fetchMatchLines.mockReset()
  fetchMatchLines.mockImplementation(async (id) =>
    id === 'e1'
      ? { length: 90, byName: { 'raul jimenez': { played: true, minutes: 90, assists: 1 } } }
      : { length: 120, byName: { 'raul jimenez': { played: true, minutes: 120, assists: 0 } } },
  )
})

describe('PlayerDetail', () => {
  it('lists only the team’s played matches with goals, results, assists and minutes', async () => {
    renderPD()
    expect(screen.getByText('Raúl Jiménez')).toBeInTheDocument()
    expect(screen.getByText(/⚽ 3 \(1 pen\) · 2 assists · 300′ played/)).toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2) // France–Canada and the unplayed R16 excluded
    // Group game: two goals (one pen), W 2–1, then per-match A/Min after load.
    expect(rows[0]).toHaveTextContent('vs')
    expect(rows[0]).toHaveTextContent('South Korea')
    expect(rows[0]).toHaveTextContent('W 2–1')
    expect(rows[0]).toHaveTextContent('⚽ 12’')
    expect(rows[0]).toHaveTextContent('55’')
    expect(rows[0]).toHaveTextContent('pen')
    // R32 as t2: drawn, won on pens → W, goal at 88' despite the accentless feed spelling.
    expect(rows[1]).toHaveTextContent('W 1–1')
    expect(rows[1]).toHaveTextContent('p4–3')
    expect(rows[1]).toHaveTextContent('⚽ 88’')
    await waitFor(() => expect(rows[0]).toHaveTextContent('90′'))
    expect(rows[0].cells[3]).toHaveTextContent('1') // assists in that match
    expect(rows[1]).toHaveTextContent('120′')
  })

  it('shows dashes when a match’s ESPN lines can’t load', async () => {
    fetchMatchLines.mockImplementation(async () => {
      throw new Error('offline')
    })
    renderPD()
    const rows = screen.getAllByRole('row').slice(1)
    await waitFor(() => expect(rows[0].cells[4]).toHaveTextContent('—'))
    expect(rows[0]).toHaveTextContent('⚽ 12’') // local goal data still renders
  })

  it('leaves the row alone when the request was aborted rather than failing', async () => {
    // Unmount/re-run aborts the in-flight lookup. That is this effect being
    // superseded, not the data failing, so the row must not be marked in error —
    // the successor run is what fills it in.
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    fetchMatchLines.mockImplementation(async () => {
      throw abort
    })
    renderPD()
    const rows = screen.getAllByRole('row').slice(1)
    // Local goal data still renders, and the minutes cell stays on its loading
    // placeholder instead of flipping to the error dash.
    await waitFor(() => expect(rows[0]).toHaveTextContent('⚽ 12’'))
    expect(rows[0].cells[4]).not.toHaveTextContent('—')
  })

  it('clicking a match row opens that match’s detail', async () => {
    const { onOpen } = renderPD()
    fireEvent.click(screen.getAllByTitle('Open match details')[0])
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ num: 1 }))
  })
})

describe('PlayerDetail — the shapes a scorer’s row can take', () => {
  // One scorer, one board, every rendering fork the table has: playing as the
  // away side (so score and penalties both need flipping), a shootout won and
  // one lost, a goal with no recorded minute, a stoppage-time goal, a penalty,
  // a match still in play, and a match the player did not appear in.
  const KEY = 'Solo Striker'
  const away = (num, stage, extra = {}) => ({
    num,
    stage,
    group: stage === 'Group' ? 'A' : undefined,
    t1: 'Someone Else',
    t2: 'Home Nation',
    ko: `2026-06-1${num}T15:00:00-04:00`,
    espnId: `e${num}`,
    ...extra,
  })

  const board = [
    // Away win, a goal with no minute and one in stoppage time, plus a penalty.
    away(1, 'Group', {
      score: [0, 3],
      goals: {
        t1: [],
        t2: [
          { name: KEY },                                   // no minute recorded
          { name: KEY, minute: 90, extra: 3 },             // 90+3
          { name: KEY, minute: 55, penalty: true },        // from the spot
          { name: KEY, minute: 12, og: true },             // own goal — never counted
        ],
      },
    }),
    // Level after 90 and lost from the spot, seen from the away side.
    away(2, 'R16', { score: [1, 1], pens: [5, 4], goals: { t1: [], t2: [] } }),
    // Level after 90 and won from the spot, seen from the away side.
    away(3, 'QF', { score: [2, 2], pens: [2, 4], goals: { t1: [], t2: [] } }),
    // Still in play.
    away(4, 'SF', { score: [0, 0], live: { clock: "60'" }, goals: { t1: [], t2: [] } }),
  ]

  const scorer = {
    name: KEY,
    team: 'Home Nation',   // not a real team, so the flag falls back
    goals: 3,
    pens: 1,               // singular
    assists: 1,            // singular
    minutes: 300,
  }

  const renderVariants = () => {
    const onOpen = vi.fn()
    render(
      <DetailContext.Provider value={onOpen}>
        <PlayerDetail scorer={scorer} matches={board} onClose={vi.fn()} />
      </DetailContext.Provider>,
    )
    return onOpen
  }

  it('flips the score and the shootout for a player on the away side', async () => {
    fetchMatchLines.mockImplementation(async () => ({ length: 90, byName: {} }))
    renderVariants()
    const rows = screen.getAllByRole('row').slice(1)
    // Away 3–0 reads as a win, from this player's side.
    expect(rows[0].cells[1]).toHaveTextContent('W 3–0')
    // 1–1, lost 4–5 on penalties: the shootout is shown their way round.
    expect(rows[1].cells[1]).toHaveTextContent('L 1–1')
    expect(rows[1].cells[1]).toHaveTextContent('p4–5')
    // 2–2, won 4–2 on penalties.
    expect(rows[2].cells[1]).toHaveTextContent('W 2–2')
    expect(rows[2].cells[1]).toHaveTextContent('p4–2')
  })

  it('labels a minuteless goal, a stoppage-time goal and a penalty, and drops an own goal', () => {
    fetchMatchLines.mockImplementation(async () => ({ length: 90, byName: {} }))
    renderVariants()
    const goalsCell = screen.getAllByRole('row')[1].cells[2]
    expect(goalsCell).toHaveTextContent('?’')     // no minute recorded
    expect(goalsCell).toHaveTextContent('90+3’')  // stoppage time
    expect(goalsCell).toHaveTextContent('pen')
    // The own goal is not this player's, even though it carries their name.
    expect(goalsCell.querySelectorAll('.pd-goal')).toHaveLength(3)
  })

  it('writes the singular forms of a single penalty and a single assist', () => {
    fetchMatchLines.mockImplementation(async () => ({ length: 90, byName: {} }))
    renderVariants()
    expect(screen.getByText(/1 pen\)/)).toBeInTheDocument()
    expect(screen.getByText(/1 assist(?!s)/)).toBeInTheDocument()
    // An unknown team has no flag of its own.
    expect(document.querySelector('.pd-flag').textContent).toBe('•')
  })

  it('shows a dash for a match still in play and DNP for one the player missed', async () => {
    fetchMatchLines.mockImplementation(async (id) =>
      id === 'e4'
        ? { length: 90, byName: { [KEY.toLowerCase()]: { played: true, minutes: 60, assists: 0 } } }
        : { length: 90, byName: { [KEY.toLowerCase()]: { played: false, minutes: 0, assists: 0 } } },
    )
    renderVariants()
    const rows = () => screen.getAllByRole('row').slice(1)
    await waitFor(() => expect(rows()[0]).toHaveClass('pd-benched'))
    // Did not appear: minutes read DNP rather than 0′.
    expect(rows()[0].cells[4]).toHaveTextContent('DNP')
    // Still in play: the final minutes are not knowable yet.
    expect(rows()[3].cells[4]).toHaveTextContent('—')
    expect(rows()[3].cells[1].querySelector('.boot-live')).toBeTruthy()
  })

  it('falls back to a blank line for a match the feed has no entry for', async () => {
    // byName has no row for this player, so the component substitutes a
    // did-not-play line rather than leaving the cells on their loading dots.
    fetchMatchLines.mockImplementation(async () => ({ length: 90, byName: { someone_else: {} } }))
    renderVariants()
    await waitFor(() => expect(screen.getAllByRole('row')[1].cells[3]).toHaveTextContent('0'))
    expect(screen.getAllByRole('row')[1].cells[4]).toHaveTextContent('DNP')
  })
})


describe('PlayerDetail — the same shapes seen from the home side', () => {
  // The mirror of the away-side describe: this player is t1 in every match, so
  // the score and the shootout are read straight rather than flipped. Two
  // penalties (plural), a shootout that the data records as level, and a match
  // whose feed carries no goal list for this side at all.
  const KEY = 'Home Striker'
  const home = (num, stage, extra = {}) => ({
    num,
    stage,
    group: stage === 'Group' ? 'A' : undefined,
    t1: 'Home Nation',
    t2: 'Someone Else',
    ko: `2026-06-1${num}T15:00:00-04:00`,
    espnId: `h${num}`,
    ...extra,
  })

  const board = [
    // Home win. The feed carries no goal list for either side of this match.
    home(1, 'Group', { score: [2, 0] }),
    // Level after 90 and won from the spot, seen from the home side.
    home(2, 'R16', { score: [1, 1], pens: [4, 2], goals: { t1: [{ name: KEY, minute: 30 }], t2: [] } }),
    // Level after 90 and a shootout the data has as level too — nothing to read
    // a winner from, so the tie stays a draw rather than being guessed at.
    home(3, 'QF', { score: [0, 0], pens: [3, 3], goals: { t1: [], t2: [] } }),
    // A goal the feed gives no name at all: it is nobody's, least of all this
    // player's, so it must not be credited to them.
    home(4, 'SF', { score: [1, 0], goals: { t1: [{ minute: 44 }], t2: [] } }),
  ]

  const scorer = { name: KEY, team: 'Home Nation', goals: 2, pens: 2, assists: 2, minutes: 300 }

  const renderHome = () => {
    fetchMatchLines.mockImplementation(async () => ({ length: 90, byName: {} }))
    render(
      <DetailContext.Provider value={vi.fn()}>
        <PlayerDetail scorer={scorer} matches={board} onClose={vi.fn()} />
      </DetailContext.Provider>,
    )
  }

  it('reads the score and the shootout straight for a player on the home side', () => {
    renderHome()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0].cells[1]).toHaveTextContent('W 2–0')
    expect(rows[1].cells[1]).toHaveTextContent('W 1–1')
    expect(rows[1].cells[1]).toHaveTextContent('p4–2')
  })

  it('leaves a level shootout as a draw rather than picking a winner', () => {
    renderHome()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[2].cells[1]).toHaveTextContent('D 0–0')
    expect(rows[2].cells[1]).toHaveTextContent('p3–3')
  })

  it('credits no goals from a match with no goal list, or from a nameless goal', () => {
    renderHome()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0].cells[2].querySelectorAll('.pd-goal')).toHaveLength(0)
    expect(rows[3].cells[2].querySelectorAll('.pd-goal')).toHaveLength(0)
  })

  it('writes the plural form of a two-penalty tally', () => {
    renderHome()
    expect(screen.getByText(/2 pens\)/)).toBeInTheDocument()
  })
})
