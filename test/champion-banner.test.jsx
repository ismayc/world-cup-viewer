import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ChampionBanner from '../src/components/ChampionBanner.jsx'
import { DetailContext } from '../src/context/detail.js'

const final = (over = {}) => ({
  num: 104,
  stage: 'Final',
  t1: 'Brazil',
  t2: 'France',
  venue: 'metlife',
  ko: '2026-07-19T15:00:00-04:00',
  ...over,
})

const renderBanner = (match, { hideScores = false, onOpen = vi.fn() } = {}) => {
  render(
    <DetailContext.Provider value={onOpen}>
      <ChampionBanner match={match} hideScores={hideScores} />
    </DetailContext.Provider>,
  )
  return onOpen
}

describe('ChampionBanner', () => {
  it('renders nothing before the Final is decided', () => {
    renderBanner(final())
    renderBanner(final({ score: [1, 1] })) // drawn, no shootout yet
    renderBanner(final({ score: [2, 0], live: { minute: 88 } })) // live = provisional
    expect(screen.queryByText(/World Champions/)).not.toBeInTheDocument()
  })

  it('crowns the champion once the Final is final (pens included)', () => {
    renderBanner(final({ score: [1, 1], pens: [4, 2] }))
    expect(screen.getByText(/World Champions/)).toBeInTheDocument()
    expect(screen.getByText('Brazil')).toBeInTheDocument()
  })

  it('opens the Final’s detail when clicked', () => {
    const onOpen = renderBanner(final({ score: [3, 1] }))
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ num: 104 }))
  })

  it('stays hidden in spoiler-free mode', () => {
    renderBanner(final({ score: [3, 1] }), { hideScores: true })
    expect(screen.queryByText(/World Champions/)).not.toBeInTheDocument()
  })

  it('stays hidden when the Final slots are still placeholders', () => {
    renderBanner(final({ t1: 'Winner Match 101', t2: 'Winner Match 102', score: [1, 0] }))
    expect(screen.queryByText(/World Champions/)).not.toBeInTheDocument()
  })
})
