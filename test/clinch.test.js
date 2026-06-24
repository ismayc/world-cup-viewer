import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'
import {
  computeClinch,
  resolveClinchedSlots,
  resolveRunnerUpSlots,
  groupRunnersUp,
  groupWinners,
  newlyClinched,
  clinchHeadline,
  clinchBadge,
} from '../src/utils/clinch.js'

const GROUPS = Object.keys(TEAMS)

// Apply a { matchNum: [g1, g2] } map onto a clone of the real schedule.
function withScores(scoreByNum) {
  return MATCHES.map((m) => (scoreByNum[m.num] ? { ...m, score: scoreByNum[m.num] } : m))
}

describe('clinch — within a single group', () => {
  // Group A: Mexico, South Africa, South Korea, Czechia.
  // Matchday 1+2 played; m53 (Czechia v Mexico) and m54 (SA v SK) remain.
  it('flags a guaranteed group winner as won-group', () => {
    // Mexico win both matches by 3; nobody else can reach Mexico's 6 points.
    const status = computeClinch(
      withScores({
        1: [3, 0], // Mexico 3–0 South Africa
        2: [0, 0], // South Korea 0–0 Czechia
        25: [0, 0], // Czechia 0–0 South Africa
        28: [3, 0], // Mexico 3–0 South Korea
      }),
    )
    expect(status['Mexico']).toBe('won-group')
    // Cross-group race isn't computable (other groups unplayed), so the chasing
    // teams are simply undecided — never falsely "through" or "out".
    expect(status['Czechia']).toBeNull()
    expect(status['South Korea']).toBeNull()
  })

  it('flags two teams clear of the field as top2 (through, group order open)', () => {
    // Mexico and Czechia both 6 pts; South Africa/South Korea can reach only 3.
    const status = computeClinch(
      withScores({
        1: [1, 0], // Mexico 1–0 South Africa
        2: [0, 1], // South Korea 0–1 Czechia
        25: [1, 0], // Czechia 1–0 South Africa
        28: [1, 0], // Mexico 1–0 South Korea
      }),
    )
    expect(status['Mexico']).toBe('top2')
    expect(status['Czechia']).toBe('top2')
    expect(status['South Africa']).toBeNull()
    expect(status['South Korea']).toBeNull()
  })

  it('treats a live (in-progress) match as undecided, not a final result', () => {
    // Scores that, if all final, clinch the group for Mexico (6 pts; nobody can
    // reach 6). m28 is Mexico's *current* match, shown LIVE with a running 3–0.
    const scores = {
      1: [3, 0], // Mexico 3–0 South Africa (final)
      2: [0, 0], // South Korea 0–0 Czechia (final)
      25: [0, 0], // Czechia 0–0 South Africa (final)
      28: [3, 0], // Mexico 3–0 South Korea (LIVE — running score)
    }
    // If the live game were counted as final, Mexico would read "won-group".
    expect(computeClinch(withScores(scores))['Mexico']).toBe('won-group')

    // But while it's live, the result isn't settled — no clinch yet.
    const live = withScores(scores).map((m) =>
      m.num === 28 ? { ...m, live: { clock: "60'", detail: '' } } : m,
    )
    expect(computeClinch(live)['Mexico']).toBeNull()
  })

  it('eliminates a team the head-to-head locks out of 3rd, even if it could tie on points', () => {
    // Group C: Haiti lost to Scotland (head-to-head) and Brazil. Haiti can reach
    // at most 3 points, but Scotland — who beat them — always finishes above
    // (more points, or level with the H2H edge), and Brazil/Morocco are clear.
    // So Haiti is locked into 4th → eliminated, even though on points alone they
    // could draw level with Scotland.
    const status = computeClinch(
      withScores({
        6: [1, 1], // Brazil 1–1 Morocco
        7: [0, 1], // Haiti 0–1 Scotland (head-to-head to Scotland)
        30: [0, 1], // Scotland 0–1 Morocco
        31: [3, 0], // Brazil 3–0 Haiti
      }),
    )
    expect(status['Haiti']).toBe('eliminated')
  })

  it('does not claim a clinch while a rival can still overtake on points', () => {
    // Only matchday 1 played: far too open for anything to be locked.
    const status = computeClinch(
      withScores({
        1: [1, 0], // Mexico 1–0 South Africa
        2: [0, 0], // South Korea 0–0 Czechia
      }),
    )
    for (const t of TEAMS['A']) expect(status[t.name]).toBeNull()
  })
})

describe('resolveClinchedSlots — fill knockout placeholders in the data', () => {
  it('rewrites "Winner Group X" to the clinched winner in every match (so all views agree)', () => {
    const clinch = { Mexico: 'won-group' }
    expect(groupWinners(clinch)).toEqual({ A: 'Mexico' })

    const resolved = resolveClinchedSlots(MATCHES, clinch)
    // M79's first side was the "Winner Group A" placeholder — now the data
    // itself says Mexico, so the bracket AND the detail modal show the same.
    const m79 = resolved.find((m) => m.num === 79)
    expect(m79.t1).toBe('Mexico')
    // Unclinched slots untouched.
    const m85 = resolved.find((m) => m.num === 85) // "Winner Group B"
    expect(m85.t1).toBe('Winner Group B')
    // No "Winner Group A" placeholder remains anywhere.
    expect(resolved.some((m) => m.t1 === 'Winner Group A' || m.t2 === 'Winner Group A')).toBe(false)
  })

  it('returns the original array untouched when nothing is clinched', () => {
    expect(resolveClinchedSlots(MATCHES, {})).toBe(MATCHES)
  })
})

describe('resolveRunnerUpSlots — fill the runner-up once a group is fully final', () => {
  // Group A all six matches final: Mexico 9, South Korea 6, South Africa 3,
  // Czechia 0 — so South Korea is the unambiguous runner-up (no tie-breaker).
  const groupAFinal = { 1: [2, 0], 2: [2, 0], 25: [0, 1], 28: [1, 0], 53: [0, 2], 54: [0, 2] }

  it('rewrites "Runner-up Group A" to the real team in every match', () => {
    const matches = withScores(groupAFinal)
    expect(groupRunnersUp(matches)).toEqual({ A: 'South Korea' })

    const resolved = resolveRunnerUpSlots(matches)
    // M73 = "Runner-up Group A" vs "Runner-up Group B".
    const m73 = resolved.find((m) => m.num === 73)
    expect(m73.t1).toBe('South Korea')
    // Group B isn't final, so its runner-up slot stays a placeholder.
    expect(m73.t2).toBe('Runner-up Group B')
    expect(resolved.some((m) => m.t1 === 'Runner-up Group A' || m.t2 === 'Runner-up Group A')).toBe(false)
  })

  it('does NOT resolve while any group match is still live (score provisional)', () => {
    const live = withScores(groupAFinal).map((m) =>
      m.num === 53 ? { ...m, live: { clock: "70'", detail: '' } } : m,
    )
    expect(groupRunnersUp(live)).toEqual({})
    expect(resolveRunnerUpSlots(live).find((m) => m.num === 73).t1).toBe('Runner-up Group A')
  })

  it('returns the original array untouched when no group has settled', () => {
    expect(resolveRunnerUpSlots(MATCHES)).toBe(MATCHES)
  })
})

describe('newlyClinched — announce what a result settled (for the email)', () => {
  it('reports a team the latest result pushed over the line, with phrasing', () => {
    // Group A with matchday 1–2 played EXCEPT m28; then m28 (Mexico beat South
    // Korea) is the freshly-synced result that wins Mexico the group.
    const before = withScores({ 1: [2, 0], 2: [2, 1], 25: [1, 1] })
    const after = withScores({ 1: [2, 0], 2: [2, 1], 25: [1, 1], 28: [1, 0] })
    const changes = newlyClinched(before, after)
    expect(changes).toContainEqual({ team: 'Mexico', group: 'A', status: 'won-group' })
    expect(clinchHeadline({ team: 'Mexico', group: 'A', status: 'won-group' })).toBe(
      '🥇 Mexico have WON Group A',
    )
  })

  it('does not repeat a clinch that was already true before the result', () => {
    const settled = withScores({ 1: [2, 0], 2: [2, 1], 25: [1, 1], 28: [1, 0] })
    expect(newlyClinched(settled, settled)).toEqual([])
  })
})

describe('clinch — full group stage, cross-group third place', () => {
  // Build a complete, tie-free group stage with a strict 9/6/3/0 hierarchy in
  // every group (team index 0 strongest … 3 weakest). The third-placed team's
  // goal difference is made distinct per group so the best-8-of-12 cut is
  // unambiguous, letting us assert exact clinch statuses.
  function buildComplete() {
    const score = {}
    GROUPS.forEach((g, i) => {
      const names = TEAMS[g].map((t) => t.name)
      const idx = Object.fromEntries(names.map((n, k) => [n, k]))
      for (const m of MATCHES) {
        if (m.stage !== 'Group' || m.group !== g) continue
        const a = idx[m.t1]
        const b = idx[m.t2]
        const hi = Math.min(a, b)
        const lo = Math.max(a, b)
        // The 3rd-vs-4th game (indices 2 v 3) wins by a group-specific margin so
        // every group's third place has a unique goal difference.
        const margin = hi === 2 && lo === 3 ? i + 1 : 1
        score[m.num] = a < b ? [margin, 0] : [0, margin]
      }
    })
    return withScores(score)
  }

  it('marks a team THROUGH via the best-third bound even when its group is too lopsided to enumerate exactly', () => {
    // Every group except D finished with a strict hierarchy, so each of their
    // thirds has only 3 points — none can reach 6.
    const score = {}
    for (const g of GROUPS) {
      if (g === 'D') continue
      const idx = Object.fromEntries(TEAMS[g].map((t, k) => [t.name, k]))
      for (const m of MATCHES) {
        if (m.stage !== 'Group' || m.group !== g) continue
        score[m.num] = idx[m.t1] < idx[m.t2] ? [1, 0] : [0, 1]
      }
    }
    // Group D: USA 4–1 Paraguay (M4), Australia 2–0 Türkiye (M8), USA 2–0
    // Australia (M29). USA on 6 with a big GD and 3 games left — too many high-
    // cap scorelines to enumerate, so the points-based path must carry it.
    score[4] = [4, 1]
    score[8] = [2, 0]
    score[29] = [2, 0]
    const status = computeClinch(withScores(score))
    // USA can still finish 3rd in their group, but a 6-point third is guaranteed
    // top-8 here (no other group can produce a 6-point third) → THROUGH.
    expect(status['USA']).toBe('third')
  })

  it('matches the final qualification picture for every team', () => {
    const status = computeClinch(buildComplete())
    GROUPS.forEach((g, i) => {
      const [first, second, third, fourth] = TEAMS[g].map((t) => t.name)
      expect(status[first]).toBe('won-group')
      expect(status[second]).toBe('top2')
      // Third places with GD = i-1; the 8 highest (i = 4..11) advance.
      expect(status[third]).toBe(i >= 4 ? 'third' : 'eliminated')
      expect(status[fourth]).toBe('eliminated')
    })
  })
})

describe('clinchBadge', () => {
  it('maps each status to a distinct badge, and unknown → null', () => {
    expect(clinchBadge('won-group')).toMatchObject({ cls: 'c-won', text: 'Won group' })
    expect(clinchBadge('top2')).toMatchObject({ cls: 'c-in', text: 'Through' })
    expect(clinchBadge('third')).toMatchObject({ cls: 'c-in', text: 'Through' })
    expect(clinchBadge('eliminated')).toMatchObject({ cls: 'c-out', text: 'Eliminated' })
    expect(clinchBadge(null)).toBeNull()
    expect(clinchBadge(undefined)).toBeNull()
    expect(clinchBadge('weird')).toBeNull()
  })
})

describe('groupWinners', () => {
  it('maps only won-group teams to their group letter', () => {
    const winners = groupWinners({ Mexico: 'won-group', Brazil: 'won-group', USA: 'top2', Haiti: 'eliminated' })
    expect(winners).toEqual({ A: 'Mexico', C: 'Brazil' }) // Mexico→A, Brazil→C; top2/eliminated excluded
  })
  it('returns an empty object when nothing is clinched', () => {
    expect(groupWinners({})).toEqual({})
    expect(groupWinners(null)).toEqual({})
  })
})

describe('resolveClinchedSlots — leaves runner-up / third slots alone', () => {
  it('fills only the clinched Winner Group X slot, not runner-up or third slots', () => {
    const resolved = resolveClinchedSlots(MATCHES, { Mexico: 'won-group', Canada: 'won-group' })
    const find = (num) => resolved.find((m) => m.num === num)
    expect(find(79).t1).toBe('Mexico') // Winner Group A
    expect(find(85).t1).toBe('Canada') // Winner Group B
    // Runner-up and third placeholders are untouched.
    expect(find(73).t1).toBe('Runner-up Group A')
    expect(find(79).t2).toBe('3rd C/E/F/H/I')
  })
})

describe('newlyClinched — detects new verdicts and upgrades', () => {
  it('reports a newly eliminated team', () => {
    const before = withScores({ 6: [1, 1], 7: [0, 1] }) // Haiti lost once, still alive
    const after = withScores({ 6: [1, 1], 7: [0, 1], 30: [0, 1], 31: [3, 0] }) // Haiti locked 4th
    const changes = newlyClinched(before, after)
    expect(changes).toContainEqual({ team: 'Haiti', group: 'C', status: 'eliminated' })
  })

  it('reports an upgrade from top2 to won-group', () => {
    // before: Mexico & Czechia both through (top2). after: Mexico has won the group.
    const before = withScores({ 1: [1, 0], 2: [0, 1], 25: [1, 0], 28: [1, 0] })
    const after = withScores({ 1: [3, 0], 2: [0, 0], 25: [0, 0], 28: [3, 0] })
    expect(computeClinch(before)['Mexico']).toBe('top2')
    const changes = newlyClinched(before, after)
    expect(changes).toContainEqual({ team: 'Mexico', group: 'A', status: 'won-group' })
  })
})
