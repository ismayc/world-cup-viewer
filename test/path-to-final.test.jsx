import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { knockoutTeams, pathToFinal, matchesByNum } from '../src/utils/bracket.js'
import { PathProvider as PP, usePath } from '../src/context/path.jsx'
import Bracket from '../src/components/Bracket.jsx'
import RadialBracket from '../src/components/RadialBracket.jsx'
import PathPicker from '../src/components/PathPicker.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { PathProvider } from '../src/context/path.jsx'
import { DetailContext } from '../src/context/detail.js'
import { MATCHES } from '../src/data/matches.js'

Element.prototype.scrollIntoView = vi.fn()

// MATCHES with a filled Round-of-32 tie (Match 73: Mexico v Canada), optionally
// carrying results down Mexico's winner chain 73→90→97→101→104.
function withPath(overrides = {}) {
  return MATCHES.map((m) => (overrides[m.num] ? { ...m, ...overrides[m.num] } : m))
}
const R32_TEAMS = { 73: { t1: 'Mexico', t2: 'Canada' }, 75: { t1: 'Spain', t2: 'Brazil' } }

const renderWith = (ui, { pathTeam } = {}) => {
  if (pathTeam) localStorage.setItem('wc2026:pathTeam', pathTeam)
  return render(
    <FollowProvider>
      <PathProvider>
        <DetailContext.Provider value={vi.fn()}>{ui}</DetailContext.Provider>
      </PathProvider>
    </FollowProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('pathToFinal + knockoutTeams (util)', () => {
  it('lists the real teams in the Round of 32, sorted', () => {
    const byNum = matchesByNum(withPath(R32_TEAMS))
    expect(knockoutTeams(byNum)).toEqual(['Brazil', 'Canada', 'Mexico', 'Spain'])
  })

  it('returns null for a team not (yet) in the Round of 32', () => {
    const byNum = matchesByNum(withPath(R32_TEAMS))
    expect(pathToFinal('Argentina', byNum)).toBeNull()
    expect(pathToFinal(null, byNum)).toBeNull()
  })

  it('traces the full winner route from the R32 tie to the Final', () => {
    const byNum = matchesByNum(withPath(R32_TEAMS))
    const p = pathToFinal('Mexico', byNum)
    expect(p.nums).toEqual([73, 90, 97, 101, 104])
    expect(p.active).toEqual([73, 90, 97, 101, 104]) // alive → whole route lit
    expect(p.here).toEqual([73]) // only the R32 tie has Mexico so far
    expect(p.exitNum).toBeNull()
  })

  it('stops the active stretch at the match where the team was eliminated', () => {
    // Canada beats Mexico in the R32 tie.
    const byNum = matchesByNum(withPath({ 73: { t1: 'Mexico', t2: 'Canada', score: [0, 1] } }))
    const p = pathToFinal('Mexico', byNum)
    expect(p.exitNum).toBe(73)
    expect(p.active).toEqual([73]) // nothing downstream is lit once out
  })

  it('breaks an R32 draw on penalties to decide the exit', () => {
    const byNum = matchesByNum(
      withPath({ 73: { t1: 'Mexico', t2: 'Canada', score: [1, 1], pens: [3, 4] } }),
    )
    expect(pathToFinal('Mexico', byNum).exitNum).toBe(73) // lost the shootout
    expect(pathToFinal('Canada', byNum).exitNum).toBeNull() // advanced
  })

  it('keeps the team alive through a win and follows it into the next round', () => {
    const byNum = matchesByNum(
      withPath({ 73: { t1: 'Mexico', t2: 'Canada', score: [2, 0] }, 90: { t1: 'Mexico' } }),
    )
    const p = pathToFinal('Mexico', byNum)
    expect(p.here).toEqual([73, 90])
    expect(p.exitNum).toBeNull()
    expect(p.active).toEqual([73, 90, 97, 101, 104])
  })

  it('treats a drawn tie with no shootout as unsettled — neither out nor through', () => {
    const byNum = matchesByNum(withPath({ 73: { t1: 'Mexico', t2: 'Canada', score: [1, 1] } }))
    // No winner decided yet → the team is neither eliminated nor advanced.
    expect(pathToFinal('Mexico', byNum).exitNum).toBeNull()
    expect(pathToFinal('Canada', byNum).exitNum).toBeNull()
  })
})

describe('PathProvider context', () => {
  const wrapper = ({ children }) => <PP>{children}</PP>

  it('persists the selection and clears it from localStorage', () => {
    const { result } = renderHook(() => usePath(), { wrapper })
    act(() => result.current.setPathTeam('Mexico'))
    expect(localStorage.getItem('wc2026:pathTeam')).toBe('Mexico')
    act(() => result.current.setPathTeam(null))
    expect(localStorage.getItem('wc2026:pathTeam')).toBeNull()
  })

  it('falls back to null when reading localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => usePath(), { wrapper })
    expect(result.current.pathTeam).toBeNull()
    spy.mockRestore()
  })

  it('swallows localStorage write errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const { result } = renderHook(() => usePath(), { wrapper })
    expect(() => act(() => result.current.setPathTeam('Brazil'))).not.toThrow()
    spy.mockRestore()
  })

  it('returns inert defaults without a provider', () => {
    const { result } = renderHook(() => usePath())
    expect(result.current.pathTeam).toBeNull()
    expect(() => result.current.setPathTeam('x')).not.toThrow()
  })
})

describe('PathPicker', () => {
  const fullRun = {
    73: { t1: 'Mexico', t2: 'Canada', score: [2, 0] },
    90: { t1: 'Mexico', score: [1, 0] },
    97: { t1: 'Mexico', score: [1, 0] },
    101: { t1: 'Mexico', score: [1, 0] },
    104: { t1: 'Mexico', score: [1, 0] },
  }

  it('renders nothing until the Round of 32 has real teams', () => {
    const { container } = renderWith(<PathPicker byNum={matchesByNum(MATCHES)} />)
    expect(container.querySelector('.path-picker')).toBeNull()
  })

  it('selecting a team from the dropdown sets the path and shows a status', () => {
    renderWith(<PathPicker byNum={matchesByNum(withPath(R32_TEAMS))} />)
    fireEvent.change(screen.getByLabelText(/Path to the Final/), { target: { value: 'Mexico' } })
    expect(screen.getByText(/Up next/)).toBeInTheDocument()
    // Clearing removes the status.
    fireEvent.click(screen.getByRole('button', { name: /Clear/ }))
    expect(screen.queryByText(/Up next/)).not.toBeInTheDocument()
  })

  it('summarizes "through to the next round" after winning its deepest match', () => {
    // Won the R32 (73) and the R16 (90); the QF (97) doesn't list Mexico yet →
    // "through to the Quarterfinal".
    renderWith(
      <PathPicker byNum={matchesByNum(withPath({ 73: { t1: 'Mexico', t2: 'Canada', score: [2, 0] }, 90: { t1: 'Mexico', score: [1, 0] } }))} />,
      { pathTeam: 'Mexico' },
    )
    expect(screen.getByText(/Through to the Quarterfinal/)).toBeInTheDocument()
  })

  it('summarizes elimination', () => {
    renderWith(
      <PathPicker byNum={matchesByNum(withPath({ 73: { t1: 'Mexico', t2: 'Canada', score: [0, 2] } }))} />,
      { pathTeam: 'Mexico' },
    )
    expect(screen.getByText(/Out — lost in the Round of 32/i)).toBeInTheDocument()
  })

  it('summarizes a live match and the champion', () => {
    // Live in the R32.
    const { unmount } = renderWith(
      <PathPicker byNum={matchesByNum(withPath({ 73: { t1: 'Mexico', t2: 'Canada', live: true } }))} />,
      { pathTeam: 'Mexico' },
    )
    expect(screen.getByText(/Playing now/)).toBeInTheDocument()
    unmount()
    // Won the Final → champions.
    renderWith(<PathPicker byNum={matchesByNum(withPath(fullRun))} />, { pathTeam: 'Mexico' })
    expect(screen.getByText(/Champions/)).toBeInTheDocument()
  })

  it('offers a quick chip for a followed knockout team', () => {
    localStorage.setItem('wc2026:followed', JSON.stringify(['Mexico']))
    renderWith(<PathPicker byNum={matchesByNum(withPath(R32_TEAMS))} />)
    const chip = screen.getByRole('button', { name: /Mexico/ })
    fireEvent.click(chip)
    expect(chip.className).toMatch(/active/)
    fireEvent.click(chip) // toggles back off
    expect(chip.className).not.toMatch(/active/)
  })
})

describe('Bracket path highlight', () => {
  it('marks the route boxes on-path and dims the rest', () => {
    const { container } = renderWith(
      <Bracket matches={withPath(R32_TEAMS)} tz="America/New_York" hideScores={false} />,
      { pathTeam: 'Mexico' },
    )
    expect(container.querySelector('.bracket-wrap.has-path')).toBeTruthy()
    for (const n of [73, 90, 97, 101, 104]) {
      expect(document.getElementById(`bx-m${n}`).classList.contains('on-path')).toBe(true)
    }
    expect(document.getElementById('bx-m74').classList.contains('on-path')).toBe(false)
    // The traced team's name is emphasized inside its box.
    expect(document.querySelector('#bx-m73 .bx-side.on-path-team')).toBeTruthy()
  })

  it('flags the elimination box with the exit style and lights nothing beyond it', () => {
    renderWith(
      <Bracket matches={withPath({ 73: { t1: 'Mexico', t2: 'Canada', score: [0, 1] } })} tz="America/New_York" hideScores={false} />,
      { pathTeam: 'Mexico' },
    )
    const exit = document.getElementById('bx-m73')
    expect(exit.classList.contains('on-path')).toBe(true)
    expect(exit.classList.contains('path-exit')).toBe(true)
    expect(document.getElementById('bx-m90').classList.contains('on-path')).toBe(false)
  })

  it('shows no highlight when no team is selected', () => {
    const { container } = renderWith(
      <Bracket matches={withPath(R32_TEAMS)} tz="America/New_York" hideScores={false} />,
    )
    expect(container.querySelector('.bracket-wrap.has-path')).toBeNull()
    expect(document.querySelector('.bx-match.on-path')).toBeNull()
  })
})

describe('RadialBracket path highlight', () => {
  it('lights the route connectors and the team flags, dims the rest', () => {
    const { container } = renderWith(
      <RadialBracket matches={withPath(R32_TEAMS)} tz="America/New_York" hideScores={false} />,
      { pathTeam: 'Mexico' },
    )
    expect(container.querySelector('.radial-wrap.has-path')).toBeTruthy()
    // At least the R32 matchup and Mexico's outer flag are on the route.
    expect(container.querySelectorAll('.rb-matchup.on-path').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.rb-node.on-path').length).toBeGreaterThan(0)
  })
})
