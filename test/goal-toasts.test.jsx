import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import GoalToasts, { TOAST_MS } from '../src/components/GoalToasts.jsx'

const ev = (over = {}) => ({
  match: {
    num: 101,
    stage: 'SF',
    t1: 'France',
    t2: 'Spain',
    goals: { t1: [{ name: 'Kylian Mbappé', minute: 12 }], t2: [] },
    ...over,
  },
  side: 't1',
  goal: { name: 'Kylian Mbappé', minute: 12 },
})

afterEach(() => vi.useRealTimers())

describe('GoalToasts', () => {
  it('renders nothing without items', () => {
    const { container } = render(<GoalToasts items={[]} onOpen={vi.fn()} onDismiss={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows scorer, minute, and derived score; click opens the match and dismisses', () => {
    const onOpen = vi.fn()
    const onDismiss = vi.fn()
    render(<GoalToasts items={[{ id: 'g1', ev: ev() }]} onOpen={onOpen} onDismiss={onDismiss} />)
    expect(screen.getByText('⚽ GOAL — France')).toBeInTheDocument()
    expect(screen.getByText(/Kylian Mbappé 12'/)).toBeInTheDocument()
    expect(screen.getByText('France 1–0 Spain')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Open match details'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ num: 101 }))
    expect(onDismiss).toHaveBeenCalledWith('g1')
  })

  it('dismisses via ✕ and auto-dismisses after the timeout', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<GoalToasts items={[{ id: 'g1', ev: ev() }]} onOpen={vi.fn()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledWith('g1')
    onDismiss.mockClear()
    act(() => vi.advanceTimersByTime(TOAST_MS + 50))
    expect(onDismiss).toHaveBeenCalledWith('g1')
  })

  it('caps the visible stack at the most recent four', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `g${i}`, ev: ev() }))
    render(<GoalToasts items={items} onOpen={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getAllByLabelText('Dismiss')).toHaveLength(4)
  })
})
