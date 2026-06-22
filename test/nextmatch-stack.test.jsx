import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NextMatch from '../src/components/NextMatch.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { MATCHES } from '../src/data/matches.js'

const a = MATCHES.find((m) => m.num === 49) // Switzerland v Canada
const b = MATCHES.find((m) => m.num === 50) // Bosnia & Herzegovina v Qatar
const live = (m) => ({ ...m, live: { clock: "30'", detail: '1st Half' }, score: [0, 0] })
const renderNM = (matches) =>
  render(
    <FollowProvider>
      <NextMatch matches={matches} tz="America/New_York" />
    </FollowProvider>,
  )

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) }))
  localStorage.clear()
})

describe('NextMatch — stacking multiple live matches', () => {
  it('stacks every live match when none involve a followed team (rows jump on click)', () => {
    renderNM([live(a), live(b)])
    expect(screen.getByText(/Live now/)).toBeInTheDocument()
    expect(screen.getByText('2 matches')).toBeInTheDocument()
    const rows = document.querySelectorAll('.nm-live-row')
    expect(rows).toHaveLength(2)
    for (const name of [a.t1, a.t2, b.t1, b.t2]) expect(screen.getByText(name)).toBeInTheDocument()
    fireEvent.click(rows[0]) // exercises the row's jump handler (no day element → no-op)
  })

  it('shows only the followed team’s match (no stack) when a single followed team is live', () => {
    localStorage.setItem('wc2026:followed', JSON.stringify([b.t1]))
    renderNM([live(a), live(b)])
    expect(document.querySelector('.nm-live-row')).toBeNull()
    expect(screen.getByText(b.t1)).toBeInTheDocument()
    expect(screen.queryByText(a.t1)).toBeNull()
  })

  it('stacks BOTH followed matches when two followed teams are live at once', () => {
    localStorage.setItem('wc2026:followed', JSON.stringify([a.t1, b.t1]))
    renderNM([live(a), live(b)])
    expect(document.querySelectorAll('.nm-live-row')).toHaveLength(2)
    for (const name of [a.t1, b.t1]) expect(screen.getByText(name)).toBeInTheDocument()
  })
})
