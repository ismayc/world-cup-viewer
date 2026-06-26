import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MATCHES } from '../src/data/matches.js'
import OutlookView from '../src/components/OutlookView.jsx'

describe('OutlookView', () => {
  it('waits (no enumeration) when too many group games remain', () => {
    // Pre-tournament: all 72 group games unplayed → 3^72 outcomes, far past the
    // exact-enumeration threshold, so it shows the "too many" notice rather than
    // spawning the worker.
    const { container } = render(<OutlookView matches={MATCHES} />)
    expect(screen.getByText(/Too many games remain/i)).toBeInTheDocument()
    expect(container.querySelector('.bo-count')).toHaveTextContent('72 group games left')
  })
})
