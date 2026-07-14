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

  it('clicking a match row opens that match’s detail', async () => {
    const { onOpen } = renderPD()
    fireEvent.click(screen.getAllByTitle('Open match details')[0])
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ num: 1 }))
  })
})
