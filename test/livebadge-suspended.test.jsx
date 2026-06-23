import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LiveBadge from '../src/components/LiveBadge.jsx'

describe('LiveBadge — paused badge shows the status label', () => {
  it('renders "⏸ Suspended" for a suspended match', () => {
    render(<LiveBadge match={{ live: { delayed: true, label: 'Suspended' } }} />)
    const badge = screen.getByText(/⏸ Suspended/)
    expect(badge).toHaveClass('badge-delayed')
    expect(badge).toHaveAttribute('aria-label', 'Suspended')
  })
})
