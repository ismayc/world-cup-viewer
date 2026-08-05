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
    // The champion's name lights up under the (glowing) trophy.
    expect(screen.getByText(/— Champions$/)).toBeInTheDocument()
    expect(container.querySelector('.rb-trophy-won')).toBeTruthy()
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

  it('labels the rounds down the top seam and shows kickoff times on unplayed ties', () => {
    const { container } = renderRB(MATCHES)
    for (const label of ['ROUND OF 32', 'ROUND OF 16', 'QUARTER-FINALS', 'SEMI-FINALS']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Every knockout tie is unplayed → each shows its kickoff time (16+15+8+4+2
    // matchups plus the third-place line).
    expect(container.querySelectorAll('.rb-time').length).toBeGreaterThan(30)
    // A played bracket swaps times for scores.
    const done = renderRB(playedBracket())
    expect(done.container.querySelectorAll('.rb-time').length).toBe(0)
  })

  it('spotlights matches playing today with a halo', () => {
    vi.useFakeTimers()
    try {
      // "Today" = the semifinals' first day → M101 gets a halo, M102 (next day) doesn't.
      vi.setSystemTime(new Date('2026-07-14T10:00:00-04:00'))
      const { container } = renderRB(MATCHES)
      expect(container.querySelectorAll('.rb-halo').length).toBe(1)
      // A quiet day → no halos anywhere.
      const quiet = renderRB(MATCHES.map((m) => ({ ...m })))
      vi.setSystemTime(new Date('2026-08-01T10:00:00-04:00'))
      quiet.rerender(
        <FollowProvider>
          <DetailContext.Provider value={() => {}}>
            <RadialBracket matches={MATCHES.map((m) => ({ ...m }))} />
          </DetailContext.Provider>
        </FollowProvider>,
      )
      expect(quiet.container.querySelectorAll('.rb-halo').length).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('dims eliminated teams while the tournament is on, none once it is over', () => {
    // Play everything up to (not including) the semis: only 4 semifinalists
    // (plus unresolved slots) stay vivid, plenty of flags fade.
    let cur = buildComplete()
    const clinch = computeClinch(cur)
    cur = resolveBracket(cur, clinch)
    for (let pass = 0; pass < 10; pass++) {
      cur = cur.map((m) => {
        if (m.stage === 'Group' || Array.isArray(m.score)) return m
        if ([101, 102, 103, 104].includes(m.num)) return m
        if (!ALL.has(m.t1) || !ALL.has(m.t2)) return m
        return { ...m, score: [1, 0] }
      })
      cur = resolveBracket(cur, clinch)
    }
    const { container } = renderRB(cur)
    expect(container.querySelectorAll('.rb-node.out').length).toBeGreaterThan(10)
    // Fully played → the race is over; the finished bracket stays vivid.
    const done = renderRB(playedBracket())
    expect(done.container.querySelectorAll('.rb-node.out').length).toBe(0)
  })

  it('lights the champion’s golden trail once the Final is decided', () => {
    const { container } = renderRB(playedBracket())
    // The champion's route: R32 → R16 → QF → SF → Final = 5 matchups.
    expect(container.querySelectorAll('.rb-matchup.champ-trail').length).toBe(5)
    expect(container.querySelectorAll('.rb-node.on-trail').length).toBeGreaterThan(0)
    // No trail while the Final is unplayed.
    const pending = renderRB(MATCHES)
    expect(pending.container.querySelectorAll('.champ-trail').length).toBe(0)
  })
})

describe('RadialBracket — keyboard and the rest of the ring', () => {
  // Every clickable node in the ring is also a focusable button, so the same
  // matchups have to open from the keyboard. Space and Enter both activate;
  // anything else must be left alone so the page still scrolls.
  const keyOpens = (el, key) => {
    fireEvent.keyDown(el, { key })
  }

  it('opens a matchup from the keyboard with Enter and Space, and ignores other keys', () => {
    const { container, openDetail } = renderRB(playedBracket())
    const group = container.querySelector('.rb-matchup.rb-click')
    expect(group).toBeTruthy()

    keyOpens(group, 'Enter')
    expect(openDetail).toHaveBeenCalledTimes(1)
    keyOpens(group, ' ')
    expect(openDetail).toHaveBeenCalledTimes(2)
    // Arrow keys and Tab belong to the page, not to this control.
    keyOpens(group, 'ArrowDown')
    keyOpens(group, 'Tab')
    expect(openDetail).toHaveBeenCalledTimes(2)
  })

  it('opens a team node from the keyboard too', () => {
    const { container, openDetail } = renderRB(playedBracket())
    const node = container.querySelector('.rb-node.rb-click')
    expect(node).toBeTruthy()
    keyOpens(node, 'Enter')
    expect(openDetail).toHaveBeenCalledTimes(1)
    keyOpens(node, ' ')
    expect(openDetail).toHaveBeenCalledTimes(2)
    keyOpens(node, 'Escape')
    expect(openDetail).toHaveBeenCalledTimes(2)
  })
})

describe('RadialBracket — every clickable, and the shapes it guards against', () => {
  it('opens the detail from every clickable node and matchup, by mouse and by key', () => {
    // The ring, the final, and the third-place play-off each wire their own
    // opener, so exercising one of them proves nothing about the others. Drive
    // all of them, both ways round, and count the openings rather than trusting
    // that the first one found is representative.
    const { container, openDetail } = renderRB(playedBracket())
    const clickables = [
      ...container.querySelectorAll('.rb-node.rb-click'),
      ...container.querySelectorAll('.rb-matchup.rb-click'),
    ]
    expect(clickables.length).toBeGreaterThan(8)

    for (const el of clickables) fireEvent.click(el)
    const afterClicks = openDetail.mock.calls.length
    expect(afterClicks).toBe(clickables.length)

    for (const el of clickables) {
      fireEvent.keyDown(el, { key: 'Enter' })
      fireEvent.keyDown(el, { key: ' ' })
      fireEvent.keyDown(el, { key: 'ArrowRight' }) // must be ignored
    }
    expect(openDetail.mock.calls.length).toBe(afterClicks + clickables.length * 2)
  })

  it('notes extra time on a tie that went to a.e.t. without penalties', () => {
    // A knockout can be settled in extra time on its own; the score then carries
    // an "aet" note rather than a shootout line.
    const played = playedBracket().map((m) => {
      if (m.stage === 'Group' || !Array.isArray(m.score)) return m
      const { pens, ...rest } = m
      return { ...rest, score: [2, 1], aet: true }
    })
    const { container } = renderRB(played)
    const scores = [...container.querySelectorAll('.rb-score')].map((t) => t.textContent)
    expect(scores.some((s) => /aet$/.test(s))).toBe(true)
    expect(scores.some((s) => /p\d/.test(s))).toBe(false)
  })

  it('notes a shootout on a tie decided from the spot', () => {
    // The other half of the same line: penalties are appended in place of the
    // a.e.t. note, so a ring full of shootouts shows p-scores and no "aet".
    const played = playedBracket().map((m) =>
      m.stage === 'Group' || !Array.isArray(m.score)
        ? m
        : { ...m, score: [1, 1], aet: true, pens: [4, 2] },
    )
    const { container } = renderRB(played)
    const scores = [...container.querySelectorAll('.rb-score')].map((t) => t.textContent)
    expect(scores.some((s) => /p4–2$/.test(s))).toBe(true)
    expect(scores.some((s) => /aet$/.test(s))).toBe(false)
  })

  it('renders a ring whose matches are not on the board', () => {
    // The ring is laid out from the format, so a board missing its knockout
    // records still has to draw an empty bracket rather than throw.
    const groupOnly = MATCHES.filter((m) => m.stage === 'Group')
    const { container } = renderRB(groupOnly)
    expect(container.querySelector('.rb-svg')).toBeTruthy()
    expect(container.querySelectorAll('.rb-node.rb-click').length).toBe(0)
  })
})
