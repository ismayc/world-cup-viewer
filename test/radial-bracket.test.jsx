import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RadialBracket from '../src/components/RadialBracket.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'
import { computeClinch } from '../src/utils/clinch.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'

const GROUPS = Object.keys(TEAMS)
const ALL = new Set(Object.values(TEAMS).flat().map((t) => t.name))

// A clean 9/6/3/0 group stage so the R32 resolves unambiguously.
function buildComplete() {
  const score = {}
  GROUPS.forEach((g, i) => {
    const idx = Object.fromEntries(TEAMS[g].map((t, k) => [t.name, k]))
    for (const m of MATCHES) {
      if (m.stage !== 'Group' || m.group !== g) continue
      const a = idx[m.t1]
      const b = idx[m.t2]
      const margin = Math.min(a, b) === 2 && Math.max(a, b) === 3 ? i + 1 : 1
      score[m.num] = a < b ? [margin, 0] : [0, margin]
    }
  })
  return MATCHES.map((m) => (score[m.num] ? { ...m, score: score[m.num] } : m))
}

// Play the whole bracket through (home advances; one shootout) to a champion.
function playedBracket() {
  let cur = buildComplete()
  const clinch = computeClinch(cur)
  cur = resolveBracket(cur, clinch)
  for (let pass = 0; pass < 10; pass++) {
    let changed = false
    cur = cur.map((m) => {
      if (m.stage === 'Group' || Array.isArray(m.score)) return m
      if (!ALL.has(m.t1) || !ALL.has(m.t2)) return m
      changed = true
      return m.num === 79 ? { ...m, score: [1, 1], pens: [4, 2] } : { ...m, score: [1, 0] }
    })
    cur = resolveBracket(cur, clinch)
    if (!changed) break
  }
  return cur
}

const renderRB = (matches) => {
  const openDetail = vi.fn()
  const utils = render(
    <FollowProvider>
      <DetailContext.Provider value={openDetail}>
        <RadialBracket matches={matches} />
      </DetailContext.Provider>
    </FollowProvider>,
  )
  return { ...utils, openDetail }
}

describe('RadialBracket', () => {
  it('renders the ring structure, trophy, and third-place section before any results', () => {
    const { container } = renderRB(MATCHES)
    expect(container.querySelector('.rb-svg')).toBeTruthy()
    expect(screen.getByText('🏆')).toBeInTheDocument()
    expect(screen.getByText(/Third place/)).toBeInTheDocument()
    // Connectors for the whole tree are drawn.
    expect(container.querySelectorAll('.rb-line').length).toBeGreaterThan(30)
    // A clickable matchup group + match-number label for every knockout match.
    expect(container.querySelectorAll('.rb-matchup.rb-click').length).toBeGreaterThan(15)
    expect(container.querySelectorAll('.rb-mnum').length).toBeGreaterThan(15)
    expect(screen.getByText('M76')).toBeInTheDocument() // Brazil v Japan match number
    // Pre-knockout there's no champion crown yet.
    expect(screen.queryByText('👑')).toBeNull()
  })

  it('fills flags with country-name tooltips and crowns the champion once played', () => {
    const { container } = renderRB(playedBracket())
    // Each flag node carries an SVG <title> = the country name (hover tooltip).
    const titles = [...container.querySelectorAll('title')].map((t) => t.textContent)
    expect(titles.some((t) => /^Germany/.test(t))).toBe(true)
    expect(titles.some((t) => /^Brazil/.test(t))).toBe(true)
    // The champion is crowned, and a "Champion: …" title is present.
    expect(screen.getByText('👑')).toBeInTheDocument()
    expect(titles.some((t) => /^Champion: /.test(t))).toBe(true)
  })

  it('pins the final (M104) above the trophy, with third place below it (no overlap)', () => {
    const { container } = renderRB(playedBracket())
    const m104 = [...container.querySelectorAll('.rb-mnum')].find((t) => t.textContent === 'M104')
    expect(m104).toBeTruthy()
    // viewBox centre is y=500; the final must sit above it…
    expect(parseFloat(m104.getAttribute('y'))).toBeLessThan(500)
    // …and the third-place label below it.
    const third = [...container.querySelectorAll('.rb-3rd-label')][0]
    expect(parseFloat(third.getAttribute('y'))).toBeGreaterThan(500)
  })

  it('opens the match detail when a flag is clicked', () => {
    const { container, openDetail } = renderRB(playedBracket())
    const node = container.querySelector('.rb-node.rb-click')
    expect(node).toBeTruthy()
    fireEvent.click(node)
    expect(openDetail).toHaveBeenCalledTimes(1)
  })

  it('shows scores on played matches, hides them in spoiler-free mode, and blinks a live dot', () => {
    // Played bracket → scores present; mark one R32 tie live.
    const played = playedBracket().map((m) => (m.num === 73 ? { ...m, live: { clock: "70'" } } : m))
    const { container, rerender } = renderRB(played)
    expect(container.querySelectorAll('.rb-score').length).toBeGreaterThan(0)
    expect(container.querySelector('.rb-live-dot')).toBeTruthy() // M73 is in play
    // Spoiler-free: scores hidden (the live dot, a status not a score, remains).
    rerender(
      <FollowProvider>
        <DetailContext.Provider value={() => {}}>
          <RadialBracket matches={played} hideScores />
        </DetailContext.Provider>
      </FollowProvider>,
    )
    expect(container.querySelectorAll('.rb-score').length).toBe(0)
    expect(container.querySelector('.rb-live-dot')).toBeTruthy()
  })

  it('opens the match detail when a matchup group (its bracket join / number) is clicked', () => {
    const { container, openDetail } = renderRB(playedBracket())
    const group = container.querySelector('.rb-matchup.rb-click')
    expect(group).toBeTruthy()
    fireEvent.click(group)
    expect(openDetail).toHaveBeenCalledTimes(1)
  })
})
