import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'
import { computeClinch } from '../src/utils/clinch.js'
import {
  decideMatch,
  resolveThirdPlaceSlots,
  resolveLockedThirdSlots,
  resolveKnockoutSlots,
  resolveBracket,
} from '../src/utils/bracketResolve.js'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'
import { FINAL_GROUP_RESULTS } from './fixtures/final-group-results.js'

const GROUPS = Object.keys(TEAMS)
const THIRD_SLOT = /^3rd [A-L/]+$/
const ANY_PLACEHOLDER = /^(Winner|Runner-up) Group [A-L]$|^3rd [A-L/]+$|^(Winner|Loser) Match \d+$/

// A complete, tie-free group stage: a strict 9/6/3/0 hierarchy in every group
// (team index 0 strongest … 3 weakest), the 3rd-vs-4th game won by a group-
// specific margin so each third's goal difference is unique (so the best-8 cut
// and the Annexe C combination are unambiguous).
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

describe('decideMatch — winner/loser of a knockout tie', () => {
  it('takes the side with more goals', () => {
    expect(decideMatch({ t1: 'A', t2: 'B', score: [2, 1] })).toEqual({ winner: 'A', loser: 'B' })
    expect(decideMatch({ t1: 'A', t2: 'B', score: [1, 3] })).toEqual({ winner: 'B', loser: 'A' })
  })

  it('breaks a draw on penalties', () => {
    expect(decideMatch({ t1: 'A', t2: 'B', score: [1, 1], pens: [5, 4] })).toEqual({ winner: 'A', loser: 'B' })
    expect(decideMatch({ t1: 'A', t2: 'B', score: [0, 0], pens: [2, 4] })).toEqual({ winner: 'B', loser: 'A' })
  })

  it('returns null when not yet settled (drawn w/o pens, live, voided, unplayed)', () => {
    expect(decideMatch({ t1: 'A', t2: 'B', score: [1, 1] })).toBeNull() // drawn, no shootout yet
    expect(decideMatch({ t1: 'A', t2: 'B', score: [2, 1], live: { clock: "70'" } })).toBeNull()
    expect(decideMatch({ t1: 'A', t2: 'B', score: [2, 1], voided: true })).toBeNull()
    expect(decideMatch({ t1: 'A', t2: 'B' })).toBeNull() // no score
  })
})

describe('resolveThirdPlaceSlots — fill "3rd X/Y/Z" once the group stage is final', () => {
  it('does nothing until every group match is final', () => {
    expect(resolveThirdPlaceSlots(MATCHES)).toBe(MATCHES) // nothing played
    // One group still live → not complete → untouched.
    const live = buildComplete().map((m) =>
      m.num === 1 ? { ...m, live: { clock: "80'" } } : m,
    )
    expect(resolveThirdPlaceSlots(live).some((m) => THIRD_SLOT.test(m.t1) || THIRD_SLOT.test(m.t2))).toBe(true)
  })

  it('replaces every R32 third-place placeholder with a real team', () => {
    const resolved = resolveThirdPlaceSlots(buildComplete())
    const r32 = resolved.filter((m) => m.stage === 'R32')
    // No "3rd …" placeholder remains, and each filled slot is a real team.
    for (const m of r32) {
      expect(THIRD_SLOT.test(m.t1)).toBe(false)
      expect(THIRD_SLOT.test(m.t2)).toBe(false)
    }
    // Exactly the eight winner-v-third ties got a real third-placed opponent.
    const allNames = new Set(Object.values(TEAMS).flat().map((t) => t.name))
    const thirdsPlaced = r32.filter(
      (m) => allNames.has(m.t2) && /^Winner Group [A-L]$/.test(MATCHES.find((x) => x.num === m.num).t1),
    )
    expect(thirdsPlaced.length).toBe(8)
  })
})

describe('resolveKnockoutSlots — propagate winners/losers up the bracket', () => {
  it('feeds a round’s winners into the next round', () => {
    const ms = [
      { num: 73, stage: 'R32', t1: 'Canada', t2: 'Brazil', score: [2, 1] },
      { num: 75, stage: 'R32', t1: 'Spain', t2: 'Mexico', score: [0, 0], pens: [4, 3] },
      { num: 90, stage: 'R16', t1: 'Winner Match 73', t2: 'Winner Match 75' },
    ]
    const r = resolveKnockoutSlots(ms)
    const m90 = r.find((m) => m.num === 90)
    expect([m90.t1, m90.t2]).toEqual(['Canada', 'Spain'])
  })

  it('routes semi-final losers to the third-place play-off and winners to the final', () => {
    const ms = [
      { num: 101, stage: 'SF', t1: 'Argentina', t2: 'France', score: [1, 0] },
      { num: 102, stage: 'SF', t1: 'Brazil', t2: 'Spain', score: [2, 3] },
      { num: 103, stage: '3rd', t1: 'Loser Match 101', t2: 'Loser Match 102' },
      { num: 104, stage: 'Final', t1: 'Winner Match 101', t2: 'Winner Match 102' },
    ]
    const r = resolveKnockoutSlots(ms)
    expect([r.find((m) => m.num === 103).t1, r.find((m) => m.num === 103).t2]).toEqual(['France', 'Brazil'])
    expect([r.find((m) => m.num === 104).t1, r.find((m) => m.num === 104).t2]).toEqual(['Argentina', 'Spain'])
  })

  it('leaves a slot as a placeholder while its tie is unsettled', () => {
    const ms = [
      { num: 73, stage: 'R32', t1: 'Canada', t2: 'Brazil', score: [1, 1] }, // drawn, no pens
      { num: 90, stage: 'R16', t1: 'Winner Match 73', t2: 'Winner Match 75' },
    ]
    const r = resolveKnockoutSlots(ms)
    expect(r.find((m) => m.num === 90).t1).toBe('Winner Match 73')
    // Original array returned untouched when nothing resolves.
    expect(resolveKnockoutSlots(ms)).toEqual(ms)
  })

  it('does NOT advance a LIVE knockout — even one with a leading score — until full time', () => {
    // A tie in play (Brazil leading 2-1 at 70') must not propagate: the lead can
    // still change, so the next round stays a placeholder until the match is final.
    const live = [
      { num: 73, stage: 'R32', t1: 'Canada', t2: 'Brazil', score: [1, 2], live: { clock: "70'" } },
      { num: 90, stage: 'R16', t1: 'Winner Match 73', t2: 'Winner Match 75' },
    ]
    const r = resolveKnockoutSlots(live)
    expect(r.find((m) => m.num === 90).t1).toBe('Winner Match 73')
    expect(resolveKnockoutSlots(live)).toEqual(live) // nothing resolved → untouched

    // The instant the SAME score goes final (live cleared), it propagates.
    const finalized = live.map((m) => (m.num === 73 ? { ...m, live: undefined } : m))
    expect(resolveKnockoutSlots(finalized).find((m) => m.num === 90).t1).toBe('Brazil')
  })
})

describe('resolveBracket — full pipeline', () => {
  it('leaves all knockout placeholders intact before anything is played', () => {
    expect(resolveBracket(MATCHES, {})).toBe(MATCHES)
  })

  it('fills the entire R32 once the group stage is complete', () => {
    const complete = buildComplete()
    const clinch = computeClinch(complete)
    const resolved = resolveBracket(complete, clinch)
    // Every R32 side is now a real team — no group/third placeholders remain.
    for (const m of resolved.filter((m) => m.stage === 'R32')) {
      expect(ANY_PLACEHOLDER.test(m.t1)).toBe(false)
      expect(ANY_PLACEHOLDER.test(m.t2)).toBe(false)
    }
  })

  it('fills a LOCKED third-place opponent early, while groups are still in play', () => {
    // Live snapshot: USA have won Group D and Bosnia is their mathematically
    // locked third-place opponent (Match 81) — even though 7 groups are unfinished.
    const snapshot = MATCHES.map((m) =>
      m.stage === 'Group' && GROUP_STAGE_MD3[m.num] ? { ...m, score: GROUP_STAGE_MD3[m.num] } : m,
    )
    const clinch = computeClinch(snapshot)
    const resolved = resolveBracket(snapshot, clinch)
    const m81 = resolved.find((m) => m.num === 81)
    expect(m81.t1).toBe('USA')
    expect(m81.t2).toBe('Bosnia & Herzegovina')

    // A third slot that is NOT yet locked stays a placeholder (no over-claiming).
    const m74 = resolved.find((m) => m.num === 74)
    expect(THIRD_SLOT.test(m74.t2)).toBe(true)
  })

  it('resolveLockedThirdSlots is a no-op before any group is complete', () => {
    expect(resolveLockedThirdSlots(MATCHES)).toBe(MATCHES)
  })

  it('plays a full bracket end-to-end (incl. a shootout) to a single champion', () => {
    const ALL_TEAMS = new Set(Object.values(TEAMS).flat().map((t) => t.name))
    const clinch = computeClinch(buildComplete())
    let cur = resolveBracket(buildComplete(), clinch)

    // Repeatedly: assign a result to every ready-but-unplayed knockout tie, then
    // re-resolve so winners feed the next round. Match 73 goes to penalties; a
    // semifinal (101) is drawn-then-shootout too, exercising the 3rd-place route.
    for (let pass = 0; pass < 10; pass++) {
      let changed = false
      cur = cur.map((m) => {
        if (m.stage === 'Group' || Array.isArray(m.score)) return m
        if (!ALL_TEAMS.has(m.t1) || !ALL_TEAMS.has(m.t2)) return m
        changed = true
        if (m.num === 73 || m.num === 101) return { ...m, score: [1, 1], pens: [4, 2] }
        return { ...m, score: [1, 0] } // home side advances
      })
      cur = resolveBracket(cur, clinch)
      if (!changed) break
    }

    // Every knockout tie resolved to real teams, and the Final has a winner.
    const ko = cur.filter((m) => m.stage !== 'Group')
    for (const m of ko) {
      expect(ALL_TEAMS.has(m.t1)).toBe(true)
      expect(ALL_TEAMS.has(m.t2)).toBe(true)
    }
    const final = cur.find((m) => m.stage === 'Final')
    expect(decideMatch(final)).not.toBeNull()
    // The third-place play-off (fed by the semifinal losers) also fully resolved.
    const third = cur.find((m) => m.stage === '3rd')
    expect(ALL_TEAMS.has(third.t1) && ALL_TEAMS.has(third.t2)).toBe(true)
  })

  it('propagates REAL R32 winners through the bracket (frozen group results)', () => {
    const ALL_TEAMS = new Set(Object.values(TEAMS).flat().map((t) => t.name))
    const scores = Object.assign({}, ...Object.values(FINAL_GROUP_RESULTS).map((r) => r.scores))
    const clinch = computeClinch(MATCHES.map((m) => (scores[m.num] ? { ...m, score: scores[m.num] } : m)))
    let cur = resolveBracket(
      MATCHES.map((m) => (scores[m.num] ? { ...m, score: scores[m.num] } : m)),
      clinch,
    )
    // Knockout sim: home side advances; the Mexico–Ecuador R32 (M79) goes to a
    // shootout to exercise the penalty path on real data.
    for (let pass = 0; pass < 10; pass++) {
      let changed = false
      cur = cur.map((m) => {
        if (m.stage === 'Group' || Array.isArray(m.score)) return m
        if (!ALL_TEAMS.has(m.t1) || !ALL_TEAMS.has(m.t2)) return m
        changed = true
        return m.num === 79 ? { ...m, score: [1, 1], pens: [4, 2] } : { ...m, score: [1, 0] }
      })
      cur = resolveBracket(cur, clinch)
      if (!changed) break
    }
    const byNum = Object.fromEntries(cur.map((m) => [m.num, m]))
    // R32 winners land in the right R16 slots: M79 (Mexico, on pens) and M80
    // (England) feed R16 M92.
    expect([byNum[92].t1, byNum[92].t2]).toEqual(['Mexico', 'England'])
    // Every knockout slot resolved to a real team, and the Final has a winner.
    for (const m of cur.filter((x) => x.stage !== 'Group')) {
      expect(ALL_TEAMS.has(m.t1) && ALL_TEAMS.has(m.t2), `M${m.num}`).toBe(true)
    }
    expect(decideMatch(byNum[104])).not.toBeNull()
  })
})
