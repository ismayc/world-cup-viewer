import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LiveBadge from '../src/components/LiveBadge.jsx'

describe('LiveBadge', () => {
  it('renders nothing when the match is not live', () => {
    const { container } = render(<LiveBadge match={{ num: 1 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the live clock and detail when present', () => {
    render(<LiveBadge match={{ live: { clock: "45’", detail: 'HT' } }} />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveTextContent("45’")
    expect(badge).toHaveAttribute('aria-label', 'Live, HT')
    expect(badge).toHaveAttribute('title', 'HT')
    expect(badge).toHaveClass('badge-live')
  })

  it('falls back to LIVE text and default labels when clock/detail are missing', () => {
    render(<LiveBadge match={{ live: {} }} className="custom" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveTextContent('LIVE')
    expect(badge).toHaveAttribute('aria-label', 'Live')
    expect(badge).toHaveAttribute('title', 'Live')
    expect(badge).toHaveClass('custom')
  })

  // Spoiler-free mode: a stoppage minute or an ET clock says the match went long.
  it('shows only LIVE, with no clock or tooltip detail, when scores are hidden', () => {
    render(<LiveBadge match={{ live: { clock: "ET 105’", detail: 'Extra Time 105’' } }} hideScores />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveTextContent('● LIVE')
    expect(badge.textContent).not.toMatch(/ET|105/)
    expect(badge).toHaveAttribute('aria-label', 'Live')
    expect(badge).toHaveAttribute('title', 'Live')
  })
})
