import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MATCHES } from '../src/data/matches.js'
import BracketOddsView from '../src/components/BracketOddsView.jsx'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'

const snapshot = MATCHES.map((m) =>
  m.stage === 'Group' && GROUP_STAGE_MD3[m.num] ? { ...m, score: GROUP_STAGE_MD3[m.num] } : m,
)

describe('BracketOddsView', () => {
  it('simulates and renders locked + open R32 spots', async () => {
    render(<BracketOddsView matches={snapshot} />)
    // The async simulation replaces the busy label with the run count.
    await waitFor(() => expect(screen.getByText(/equally-weighted outcomes/)).toBeInTheDocument())

    // Match 81 shows a locked, confirmed opponent (Bosnia).
    const m81 = screen.getByText('Match 81').closest('.bo-match')
    expect(within(m81).getByText('USA')).toBeInTheDocument()
    expect(within(m81).getByText('Bosnia & Herzegovina')).toBeInTheDocument()
    expect(within(m81).getAllByText('✅').length).toBeGreaterThan(0)

    // An open match (88) shows percentage candidates rather than a lock.
    const m88 = screen.getByText('Match 88').closest('.bo-match')
    expect(within(m88).getAllByText(/%$/).length).toBeGreaterThan(1)
  })
})
