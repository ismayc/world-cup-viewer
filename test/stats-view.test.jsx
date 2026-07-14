import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatsView from '../src/components/StatsView.jsx'

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
})
