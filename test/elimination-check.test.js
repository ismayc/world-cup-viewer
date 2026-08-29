import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'
import { FINAL_GROUP_RESULTS } from './fixtures/final-group-results.js'
import {
  eliminationStatus,
  survivingTeams,
  isAlive,
  thirdRanksAbove,
  thirdPlaceR32Slots,
  aliveR32Slots,
  advancementRequirements,
} from '../src/utils/eliminationCheck.js'
import { computeQualification } from '../src/utils/qualification.js'
import { enumerateOutlook } from '../src/utils/outlookEnum.js'

const GROUPS = Object.keys(TEAMS)

// Apply a { matchNum: [g1, g2] } map onto a clone of the real schedule. Matches
// left out of the map stay scoreless = "still to play".
function withScores(map) {
  return MATCHES.map((m) => (map[m.num] ? { ...m, score: map[m.num] } : m))
}

// Per-group result builder. Teams are ranked by their index in TEAMS[g]
// (0 = strongest … 3 = weakest); `template(hi, lo)` decides the result of the
// game between the better-ranked (hi) and worse-ranked (lo) team, then it's
// oriented back to the fixture's t1/t2.
function groupScores(g, template) {
  const idx = Object.fromEntries(TEAMS[g].map((t, k) => [t.name, k]))
  const out = {}
  for (const m of MATCHES) {
    if (m.stage !== 'Group' || m.group !== g) continue
    const a = idx[m.t1]
    const b = idx[m.t2]
    const hi = Math.min(a, b)
    const lo = Math.max(a, b)
    const r = template(hi, lo)
    if (r.draw) out[m.num] = [0, 0]
    else out[m.num] = a < b ? [r.margin, 0] : [0, r.margin] // hi (better rank) wins
  }
  return out
}

// Third place finishes on 4 points with GD 0 → clearly ABOVE a 3-point third.
const STRONG = (hi, lo) => (hi === 0 && lo === 2 ? { draw: true } : { margin: 1 })
// Third place finishes on 3 points but GD −9 (two 5-goal beatings) → clearly
// BELOW a 3-point / −3 third like Scotland.
const WEAK = (hi, lo) => (lo === 2 && hi <= 1 ? { margin: 5 } : { margin: 1 })

describe('thirdRanksAbove — official cross-group third-place order', () => {
  it('orders by points, then GD, then GF, then conduct, then FIFA ranking', () => {
    const base = { name: 'X', Pts: 3, GD: -3, GF: 1, conduct: 0 }
    expect(thirdRanksAbove({ ...base, Pts: 4 }, base)).toBe(true) // more points
    expect(thirdRanksAbove({ ...base, GD: 0 }, base)).toBe(true) // better GD
    expect(thirdRanksAbove(base, { ...base, GD: 0 })).toBe(false)
    expect(thirdRanksAbove({ ...base, GF: 3 }, base)).toBe(true) // more goals
    // All equal except name → FIFA ranking decides (Scotland 42 above Tunisia 45).
    expect(thirdRanksAbove({ ...base, name: 'Scotland' }, { ...base, name: 'Tunisia' })).toBe(true)
  })
})

describe('eliminationStatus — exactness vs the qualification picture (complete stage)', () => {
  // A complete, tie-free group stage: every group runs 9/6/3/0, and the third-
  // placed team's goal difference is made unique per group so the best-8-of-12
  // cut is unambiguous (third GD = group index − 1, so the 8 highest-indexed
  // groups' thirds advance). Mirrors the cross-check in clinch.test.js.
  function buildComplete() {
    const score = {}
    GROUPS.forEach((g, i) => {
      const idx = Object.fromEntries(TEAMS[g].map((t, k) => [t.name, k]))
      for (const m of MATCHES) {
        if (m.stage !== 'Group' || m.group !== g) continue
        const a = idx[m.t1]
        const b = idx[m.t2]
        const hi = Math.min(a, b)
        const lo = Math.max(a, b)
        const margin = hi === 2 && lo === 3 ? i + 1 : 1
        score[m.num] = a < b ? [margin, 0] : [0, margin]
      }
    })
    return withScores(score)
  }

  it('marks top-two as alive, the 8 best thirds alive, and everyone else eliminated', () => {
    const matches = buildComplete()
    const status = eliminationStatus(matches)
    const qual = computeQualification(matches)

    GROUPS.forEach((g, i) => {
      const [first, second, third, fourth] = TEAMS[g].map((t) => t.name)
      expect(status[first]).toBe('alive')
      expect(status[second]).toBe('alive')
      // Third GD = i − 1; the 8 highest (i = 4..11) make the cut.
      expect(status[third]).toBe(i >= 4 ? 'alive' : 'eliminated')
      expect(status[fourth]).toBe('eliminated')
    })

    // The alive thirds must be exactly computeQualification's best 8.
    const aliveThirds = GROUPS.map((g) => TEAMS[g][2].name).filter((n) => status[n] === 'alive')
    expect(new Set(aliveThirds)).toEqual(qual.bestThirds)
  })
})

describe('eliminationStatus — Scotland is alive but margin-dependent (the one-goal gap)', () => {
  // Frozen scenario: Scotland finished Group C 3rd on 3 pts / −3 GD (the real
  // result). Group G has one game left (Egypt v Iran) and is the swing — its
  // third can drop below Scotland ONLY on a heavy scoreline. Of the other ten
  // groups, seven field a third clearly above Scotland and three below. So:
  //   exact   → Group G's third can finish below Scotland → only 7 thirds forced
  //             above → Scotland makes the top 8 → ALIVE.
  //   one-goal→ at a one-goal margin Group G's third always stays above Scotland
  //             → 8 thirds above → Scotland is 9th → never shown.
  function scenario(strong, weak) {
    const scores = {}
    Object.assign(scores, FINAL_GROUP_RESULTS.C.scores) // Group C: Scotland 3rd, −3
    // Group G with match 65 (Egypt v Iran) left to play. Belgium win the group;
    // Egypt 4 / Iran 3 contest 2nd–3rd in that final game.
    Object.assign(scores, { 14: [0, 0], 16: [2, 0], 38: [1, 0], 40: [0, 2], 66: [0, 2] })
    for (const g of strong) Object.assign(scores, groupScores(g, STRONG))
    for (const g of weak) Object.assign(scores, groupScores(g, WEAK))
    return withScores(scores)
  }

  const STRONG_7 = ['A', 'B', 'D', 'E', 'F', 'H', 'I']
  const WEAK_3 = ['J', 'K', 'L']

  it('reports Scotland as still alive (exact check finds the heavy-defeat path)', () => {
    const matches = scenario(STRONG_7, WEAK_3)
    expect(isAlive(matches, 'Scotland')).toBe(true)
    expect(survivingTeams(matches)).toContain('Scotland')
  })

  it('the goal-difference enumeration now SURFACES Scotland with a real share', () => {
    // Under the old one-goal model Scotland tallied 0% and vanished. The margin
    // enumeration walks the heavy-defeat paths (Group G third dropping below −3),
    // so Scotland now appears as a real (small) candidate in its reachable slot.
    const matches = scenario(STRONG_7, WEAK_3)
    const { perMatch, total } = enumerateOutlook(matches)
    let scotlandCount = 0
    const shown = new Set()
    for (const sides of Object.values(perMatch)) {
      for (const s of sides) {
        if (s.locked) shown.add(s.locked)
        for (const c of s.candidates) {
          shown.add(c.team)
          if (c.team === 'Scotland') scotlandCount += c.count
        }
      }
    }
    expect(shown.has('Scotland')).toBe(true)
    expect(scotlandCount).toBeGreaterThan(0)
    // It's a long shot, not a lock — a tiny share of the space.
    expect(scotlandCount / total).toBeLessThan(0.5)
    expect(survivingTeams(matches)).toContain('Scotland')
  })

  it('reports where Scotland would play if they advanced (Annexe C third slots)', () => {
    const matches = scenario(STRONG_7, WEAK_3)
    const slots = thirdPlaceR32Slots(matches, 'Scotland')
    expect(slots.length).toBeGreaterThan(0)
    // A third from Group C can only face the winners whose R32 third-slot label
    // lists C — i.e. matches 74 (Winner E), 77 (Winner I), 79 (Winner A).
    for (const s of slots) {
      expect([74, 77, 79]).toContain(s.matchNum)
      expect(['A', 'E', 'I']).toContain(s.winnerGroup)
    }
    // The batch form keys the same data by team.
    const all = aliveR32Slots(matches, survivingTeams(matches))
    expect(all['Scotland']).toEqual(slots)
  })

  it('spells out the goal-difference requirements to advance', () => {
    const matches = scenario(STRONG_7, WEAK_3)
    const req = advancementRequirements(matches, 'Scotland')
    expect(req).toBeTruthy()
    expect(req.profile).toMatchObject({ Pts: 3, GD: -3 })
    expect(req.ownGroupComplete).toBe(true) // Group C is done
    // Seven groups are already ahead, three already below → only Group G (the
    // one with a game left) is in the balance, and Scotland needs it to go their
    // way: "needs at least 1 of these 1".
    expect(req.forcedAbove).toBe(7)
    expect(req.variable.map((v) => v.group)).toEqual(['G'])
    expect(req.needAtLeast).toBe(1)
    // The condition is phrased in goal-difference terms relative to Scotland.
    expect(req.variable[0].condition).toMatch(/fewer than 3 points/)
    expect(req.variable[0].condition).toMatch(/worse than -3/)
  })

  it('frames a team whose own group is still playing as the GD race (no fixed checklist)', () => {
    // Iran's Group G still has a game to play, so its points/GD as a third aren't
    // settled — the requirements must NOT be a fixed "needs N (GD threshold)"
    // checklist, but the two-step "finish 3rd, then win the GD race" framing.
    const matches = scenario(STRONG_7, WEAK_3)
    const req = advancementRequirements(matches, 'Iran')
    expect(req).toBeTruthy()
    expect(req.ownGroupComplete).toBe(false)
    expect(req.ownGroup).toBe('G')
    expect(typeof req.thirdPts).toBe('number')
    expect(Array.isArray(req.unresolvedGroups)).toBe(true)
    // The fixed-checklist fields are absent in this mode.
    expect(req.variable).toBeUndefined()
    expect(req.needAtLeast).toBeUndefined()
  })

  it('flips to eliminated once an eighth group is forced above Scotland', () => {
    // Promote group J from weak to strong → 8 thirds always above Scotland.
    const matches = scenario(['A', 'B', 'D', 'E', 'F', 'H', 'I', 'J'], ['K', 'L'])
    expect(isAlive(matches, 'Scotland')).toBe(false)
    expect(eliminationStatus(matches)['Scotland']).toBe('eliminated')
  })
})

describe('eliminationStatus — basic verdicts', () => {
  it('eliminates a team locked into 4th and keeps a top-two team alive', () => {
    // Group C, Haiti locked into 4th (lost the head-to-head to Scotland and to
    // Brazil); Brazil cruising at the top.
    const matches = withScores({ 6: [1, 1], 7: [0, 1], 30: [0, 1], 31: [3, 0] })
    const status = eliminationStatus(matches)
    expect(status['Haiti']).toBe('eliminated')
    expect(status['Brazil']).toBe('alive')
  })

  it('never over-claims while the field is too open to enumerate', () => {
    // Only matchday 1 in Group A → everything still alive.
    const matches = withScores({ 1: [1, 0], 2: [0, 0] })
    for (const t of TEAMS['A']) expect(isAlive(matches, t.name)).toBe(true)
  })
})

// Every game a 1–0 win for the better-ranked side → third on 3 points, GD −1.
const PLAIN = () => ({ margin: 1 })
// The bottom two are both beaten twice by two goals and their meeting is left to
// play: whoever wins finishes third on 3 points, a draw leaves the third on a
// single point with a −4 difference. That spread is what makes the "strongest
// reachable third-place profile" search do any work.
const SWING = (hi, lo) => (lo >= 2 && hi <= 1 ? { margin: 2 } : { margin: 1 })
const swingGroup = (g) => {
  const idx = Object.fromEntries(TEAMS[g].map((t, k) => [t.name, k]))
  const scores = groupScores(g, SWING)
  const decider = MATCHES.find(
    (m) =>
      m.stage === 'Group' &&
      m.group === g &&
      Math.min(idx[m.t1], idx[m.t2]) === 2 &&
      Math.max(idx[m.t1], idx[m.t2]) === 3,
  )
  delete scores[decider.num]
  return scores
}

describe('third-place R32 slots — teams the bracket has no room for', () => {
  // Groups A–H field a strong third (4 pts), I–L a battered one (3 pts, −9), so
  // the eight best thirds are exactly A–H and the group stage is complete.
  const completeStage = () => {
    const scores = {}
    for (const g of GROUPS) Object.assign(scores, groupScores(g, g <= 'H' ? STRONG : WEAK))
    return withScores(scores)
  }

  it('names no slots at all for a team that is in no group', () => {
    // A name the committed table has never carried — an upstream re-spelling,
    // say. Neither form may attribute somebody else's slots to it.
    const matches = completeStage()
    expect(thirdPlaceR32Slots(matches, 'Nowhere United')).toEqual([])
    expect(aliveR32Slots(matches, ['Nowhere United'])).toEqual({})
  })

  it('omits a third that no reachable combination carries into the bracket', () => {
    // Group L's third IS its group's third-placed team, but with the stage
    // complete only one eight-group combination remains reachable and L is not
    // in it — so there is no slot to name, and the batch form leaves it out
    // entirely rather than listing it with an empty array.
    const matches = completeStage()
    const lThird = TEAMS['L'][2].name
    expect(aliveR32Slots(matches, TEAMS['L'].map((t) => t.name))[lThird]).toBeUndefined()
    // Teeth: a third that DID make the cut is listed, so the omission is about
    // this team rather than the batch form returning nothing on this board.
    const aThird = TEAMS['A'][2].name
    expect(aliveR32Slots(matches, [aThird])[aThird].length).toBeGreaterThan(0)
  })
})

describe('the exact check across groups it cannot enumerate', () => {
  const board = (opts = {}) => {
    const scores = { ...swingGroup('L') }
    for (const g of GROUPS) if (g !== 'L') Object.assign(scores, groupScores(g, PLAIN))
    for (const num of opts.unplay || []) delete scores[num]
    return withScores(scores)
  }

  it('takes the strongest third-place profile a team can still reach', () => {
    // Group L's third can be on 3 points or on 1 — the check has to reason from
    // the 3, its easiest path, or it would eliminate the team on its worst case.
    const matches = board()
    expect(matches.filter((m) => m.stage === 'Group' && !m.score)).toHaveLength(1)
    expect(isAlive(matches, TEAMS['L'][2].name)).toBe(true)
  })

  it('refuses to count a rival group that is too open to enumerate', () => {
    // Group E loses three results, putting its remaining scoreline space over
    // the budget. It can no longer be shown to force anyone below it, so it
    // simply does not count towards the eight-thirds cut — never a false
    // elimination.
    const eNums = MATCHES.filter((m) => m.stage === 'Group' && m.group === 'E')
      .slice(0, 3)
      .map((m) => m.num)
    const status = eliminationStatus(board({ unplay: eNums }))
    for (const t of TEAMS['E']) expect(status[t.name]).toBe('alive')
    // ...and a team elsewhere that depends on the thirds race still gets a
    // verdict, computed with group E left out of the count.
    expect(status[TEAMS['A'][2].name]).toBe('alive')
  })

  it('declines to state requirements while the team’s own group cannot be enumerated', () => {
    const cNums = MATCHES.filter((m) => m.stage === 'Group' && m.group === 'C')
      .slice(0, 3)
      .map((m) => m.num)
    expect(advancementRequirements(board({ unplay: cNums }), TEAMS['C'][2].name)).toBeNull()
    // Teeth: with Group C intact the same team does get a requirements picture.
    expect(advancementRequirements(board(), TEAMS['C'][2].name)).toBeTruthy()
  })
})

describe('advancementRequirements — how the threshold reads', () => {
  const boardWith = (cTemplate) => {
    const scores = { ...groupScores('C', cTemplate), ...swingGroup('L') }
    for (const g of GROUPS) if (g !== 'C' && g !== 'L') Object.assign(scores, groupScores(g, PLAIN))
    return withScores(scores)
  }

  it('signs a positive goal difference', () => {
    // Group C's third thrashes the bottom side 3–0 and loses its other two 0–1:
    // three points and a PLUS-one difference, which the threshold must spell
    // with its sign or "worse than 1" reads as a bigger number than it is.
    const POSITIVE = (hi, lo) => (hi === 2 && lo === 3 ? { margin: 3 } : { margin: 1 })
    const req = advancementRequirements(boardWith(POSITIVE), TEAMS['C'][2].name)
    expect(req.profile).toMatchObject({ Pts: 3, GD: 1 })
    expect(req.variable.map((v) => v.group)).toEqual(['L'])
    expect(req.variable[0].condition).toMatch(/goal difference worse than \+1/)
  })

  it('counts a single point in the singular', () => {
    // Group C's third draws with the bottom side and loses its other two 0–1,
    // while the bottom side is beaten 0–3 twice: one point, and it must read
    // "fewer than 1 point", not "1 points".
    const ONE_POINT = (hi, lo) =>
      hi === 2 && lo === 3 ? { draw: true } : lo === 3 ? { margin: 3 } : { margin: 1 }
    const req = advancementRequirements(boardWith(ONE_POINT), TEAMS['C'][2].name)
    expect(req.profile).toMatchObject({ Pts: 1, GD: -2 })
    expect(req.variable.map((v) => v.group)).toEqual(['L'])
    expect(req.variable[0].condition).toMatch(/fewer than 1 point,/)
  })
})
