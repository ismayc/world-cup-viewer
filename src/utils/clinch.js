// Clinch / elimination detection. For each group we enumerate every possible
// outcome of its remaining matches and ask what is already GUARANTEED for each
// team — using the exact FIFA tie-breakers in qualification.js (points → goal
// difference → goals scored → head-to-head). The cross-group "8 best third-
// placed teams" race is resolved with sound per-group bounds.
//
// Design rule: NEVER over-claim. When a situation is too large to enumerate
// exactly (early in the group stage there are too many permutations), or a
// competing group can't be bounded, we report nothing rather than guess. The
// goal cap is sized well above any tie-breaker-relevant margin in a 4-team
// group, so within an enumerated group the answer is exact; the only failure
// mode is staying silent (conservative), never a false "clinched".

import { TEAMS } from '../data/teams.js'
import { rankGroup } from './qualification.js'

const GROUPS = Object.keys(TEAMS)
const ADVANCING_THIRDS = 8 // 8 of the 12 third-placed teams advance
// Upper bound on enumerated scorelines per group. Sized so the real clinch
// window (each team with one match left → 2 remaining) is always exact, while
// larger fan-outs fall back to "undetermined" (and thus claim nothing).
const SCENARIO_BUDGET = 500000

// Compare two third-place profiles by criteria 1–3 (no cross-group head-to-head
// exists). Positive => a ranks ahead of b.
export const cmpThird = (a, b) => a.Pts - b.Pts || a.GD - b.GD || a.GF - b.GF
const profile = (r) => ({ name: r.name, group: r.group, Pts: r.Pts, GD: r.GD, GF: r.GF })

// A goal cap comfortably larger than any margin that could flip a tie-breaker
// in a 4-team group: it must exceed the worst current GD gap a team might need
// to overturn, with headroom. Being generous keeps enumeration EXACT (an under-
// sized cap could miss a counterexample and falsely claim a clinch).
function goalCap(rows) {
  let maxAbsGD = 0
  for (const r of rows) maxAbsGD = Math.max(maxAbsGD, Math.abs(r.GD))
  return Math.max(8, maxAbsGD + 6)
}

function scorelinesUpTo(cap) {
  const out = []
  for (let a = 0; a <= cap; a++) for (let b = 0; b <= cap; b++) out.push([a, b])
  return out
}

// Enumerate every completion of one group's remaining matches and collect, per
// team, the set of final ranks it can reach; plus the strongest/weakest third-
// place profile the group can produce and (per team) its own best/worst profile
// when it finishes third.
function analyzeGroup(group, matches) {
  const all = matches.filter((m) => m.stage === 'Group' && m.group === group)
  // A match counts as decided only once it's FINAL. A live match carries a
  // running score (m.live set), but its outcome isn't settled — so it's treated
  // as remaining, exactly like an unplayed fixture. Counting a live score as
  // final would clinch teams a result early (e.g. while they're still winning).
  const decided = (m) => m.score && !m.live && !m.voided
  const played = all.filter(decided)
  const remaining = all.filter((m) => !decided(m))
  const names = TEAMS[group].map((t) => t.name)

  const cap = goalCap(rankGroup(group, played))
  const scorelines = scorelinesUpTo(cap)
  const total = remaining.length === 0 ? 1 : Math.pow(scorelines.length, remaining.length)
  if (total > SCENARIO_BUDGET) return { group, feasible: false }

  const ranks = {} // name -> Set<rank>
  const thirdBest = {} // name -> best profile when finishing 3rd
  const thirdWorst = {} // name -> worst profile when finishing 3rd
  for (const n of names) ranks[n] = new Set()
  let groupThirdBest = null
  let groupThirdWorst = null

  const assign = new Array(remaining.length)
  const visit = (i) => {
    if (i === remaining.length) {
      const synthetic = played.concat(
        remaining.map((m, idx) => ({ ...m, score: assign[idx] })),
      )
      const ordered = rankGroup(group, synthetic)
      for (const r of ordered) ranks[r.name].add(r.rank)
      const third = profile(ordered[2])
      if (!groupThirdBest || cmpThird(third, groupThirdBest) > 0) groupThirdBest = third
      if (!groupThirdWorst || cmpThird(third, groupThirdWorst) < 0) groupThirdWorst = third
      const tn = third.name
      if (!thirdBest[tn] || cmpThird(third, thirdBest[tn]) > 0) thirdBest[tn] = third
      if (!thirdWorst[tn] || cmpThird(third, thirdWorst[tn]) < 0) thirdWorst[tn] = third
      return
    }
    for (const s of scorelines) {
      assign[i] = s
      visit(i + 1)
    }
  }
  visit(0)

  return { group, feasible: true, names, ranks, thirdBest, thirdWorst, groupThirdBest, groupThirdWorst }
}

// Points-only analysis via W/D/L enumeration (always cheap — 3^remaining ≤ 729),
// independent of the goal-difference scoreline enumeration (which can be too
// large for a lopsided group with several games left). Gives SOUND rank bounds
// (ties counted pessimistically) and the group's third-place POINTS range.
function pointsAnalysis(group, matches) {
  const all = matches.filter((m) => m.stage === 'Group' && m.group === group)
  const decided = (m) => m.score && !m.live && !m.voided
  const remaining = all.filter((m) => !decided(m))
  const names = TEAMS[group].map((t) => t.name)
  const base = {}
  for (const n of names) base[n] = 0
  for (const m of all.filter(decided)) {
    const [a, b] = m.score
    if (a > b) base[m.t1] += 3
    else if (b > a) base[m.t2] += 3
    else { base[m.t1] += 1; base[m.t2] += 1 }
  }

  const pess = {} // worst (largest) finishing rank by points, ties AGAINST the team
  const opt = {} // best (smallest) finishing rank by points, ties FOR the team
  const minPts = {}
  const maxPts = {}
  for (const n of names) { pess[n] = 1; opt[n] = names.length; minPts[n] = Infinity; maxPts[n] = -Infinity }
  let maxThirdPts = -Infinity
  let minThirdPts = Infinity

  const k = remaining.length
  for (let mask = 0; mask < 3 ** k; mask++) {
    const pts = { ...base }
    let x = mask
    for (let i = 0; i < k; i++) {
      const o = x % 3
      x = Math.floor(x / 3)
      const m = remaining[i]
      if (o === 0) pts[m.t1] += 3
      else if (o === 1) pts[m.t2] += 3
      else { pts[m.t1] += 1; pts[m.t2] += 1 }
    }
    for (const n of names) {
      minPts[n] = Math.min(minPts[n], pts[n])
      maxPts[n] = Math.max(maxPts[n], pts[n])
      let above = 0
      let equal = 0
      for (const m of names) {
        if (m === n) continue
        if (pts[m] > pts[n]) above++
        else if (pts[m] === pts[n]) equal++
      }
      pess[n] = Math.max(pess[n], 1 + above + equal)
      opt[n] = Math.min(opt[n], 1 + above)
    }
    const third = names.map((n) => pts[n]).sort((a, b) => b - a)[2]
    maxThirdPts = Math.max(maxThirdPts, third)
    minThirdPts = Math.min(minThirdPts, third)
  }
  return { names, pess, opt, minPts, maxPts, maxThirdPts, minThirdPts }
}

// Public: map of team name -> clinch status string (or null).
//   'won-group' — guaranteed to finish 1st in the group
//   'runner-up' — guaranteed to finish EXACTLY 2nd (the settled group runner-up)
//   'top2'      — guaranteed top two, but 1st-vs-2nd still open
//   'third'     — guaranteed to advance as one of the 8 best third-placed teams
//   'eliminated'— cannot advance under any remaining results
//   null        — still undecided (or not yet computable)
//
// Two engines run per group: the exact scoreline enumeration (precise, includes
// goal difference — but skipped when too large) and the points-only enumeration
// (always available, sound). Statuses take the precise answer when present and
// fall back to the sound points bound otherwise, so a verdict still appears for
// lopsided groups the scoreline pass can't enumerate.
export function computeClinch(matches) {
  const sa = {} // scoreline analysis (may be infeasible)
  const pa = {} // points analysis (always available)
  for (const g of GROUPS) {
    sa[g] = analyzeGroup(g, matches)
    pa[g] = pointsAnalysis(g, matches)
  }

  // Third-place profiles for the cross-group race: precise when the group was
  // enumerable, else a sound points-only bound (best = points + unbeatable
  // GD/GF; worst = points + worst GD/GF) so comparisons never over-claim.
  const PLUS = (Pts) => ({ Pts, GD: Infinity, GF: Infinity })
  const MINUS = (Pts) => ({ Pts, GD: -Infinity, GF: -Infinity })
  const bestThirdOf = (g) => (sa[g].feasible ? sa[g].groupThirdBest : PLUS(pa[g].maxThirdPts))
  const worstThirdOf = (g) => (sa[g].feasible ? sa[g].groupThirdWorst : MINUS(pa[g].minThirdPts))

  const status = {}
  for (const g of GROUPS) {
    const others = GROUPS.filter((x) => x !== g)
    for (const name of pa[g].names) {
      const feasible = sa[g].feasible
      const rset = feasible ? sa[g].ranks[name] : null
      const saMax = feasible ? Math.max(...rset) : Infinity
      const saMin = feasible ? Math.min(...rset) : Infinity
      const { pess, opt } = { pess: pa[g].pess[name], opt: pa[g].opt[name] }

      // 1st place — needs goal-difference precision, OR a strict points lead.
      if ((feasible && rset.size === 1 && rset.has(1)) || pess === 1) {
        status[name] = 'won-group'
        continue
      }
      // Exactly 2nd locked → the settled group runner-up. Mirrors won-group for
      // 1st: precise when the group is enumerable (only rank 2 is reachable),
      // else a strict points lock (always exactly 2nd, no tie could push it off).
      if ((feasible && rset.size === 1 && rset.has(2)) || (pess === 2 && opt === 2)) {
        status[name] = 'runner-up'
        continue
      }
      // Top two but order open — precise, or guaranteed on points alone.
      if ((feasible && saMax <= 2) || pess <= 2) {
        status[name] = 'top2'
        continue
      }

      const guaranteedTop3 = (feasible && saMax <= 3) || pess <= 3
      // "Can still reach" must trust the EXACT ranks when the group is enumerable
      // (they account for head-to-head / goal difference); the optimistic points
      // bound is only a fallback for groups too large to enumerate. Using the
      // points bound when exact data exists would over-state reachability and
      // miss eliminations (e.g. a team the head-to-head locks out of 3rd).
      const canReachTop2 = feasible ? saMin <= 2 : opt <= 2
      const canReach3rd = feasible ? saMin <= 3 : opt <= 3

      // Through as a best third? Never finishes below 3rd, and even its WORST
      // third out-ranks all but ≤7 of the other groups' BEST possible thirds.
      if (guaranteedTop3) {
        const myWorst =
          feasible && sa[g].thirdWorst[name] ? sa[g].thirdWorst[name] : MINUS(pa[g].minPts[name])
        const aheadAtBest = others.filter((x) => cmpThird(bestThirdOf(x), myWorst) >= 0).length
        if (aheadAtBest <= ADVANCING_THIRDS - 1) {
          status[name] = 'third'
          continue
        }
      }

      // Eliminated? Can't reach the top two, and even its BEST third is beaten by
      // ≥8 of the other groups' WEAKEST possible thirds (or it can't reach 3rd).
      let canAdvance = canReachTop2
      if (!canAdvance && canReach3rd) {
        const myBest =
          feasible && sa[g].thirdBest[name] ? sa[g].thirdBest[name] : PLUS(pa[g].maxPts[name])
        const forcedAhead = others.filter((x) => cmpThird(worstThirdOf(x), myBest) > 0).length
        canAdvance = forcedAhead <= ADVANCING_THIRDS - 1
      }
      status[name] = canAdvance ? null : 'eliminated'
    }
  }
  return status
}

// Per-group best/worst reachable third-place profile, using the same exact
// scoreline enumeration (when feasible) or sound points-only bounds as the
// clinch engine. Exposed so the knockout-opponent logic can decide which
// cross-group "8 best thirds" combinations are still reachable. Returns
// { [group]: { best, worst, complete } } where best/worst are {Pts,GD,GF}.
export function thirdProfileBounds(matches) {
  const PLUS = (Pts) => ({ Pts, GD: Infinity, GF: Infinity })
  const MINUS = (Pts) => ({ Pts, GD: -Infinity, GF: -Infinity })
  const out = {}
  for (const g of GROUPS) {
    const sa = analyzeGroup(g, matches)
    const pa = pointsAnalysis(g, matches)
    out[g] = {
      best: sa.feasible ? sa.groupThirdBest : PLUS(pa.maxThirdPts),
      worst: sa.feasible ? sa.groupThirdWorst : MINUS(pa.minThirdPts),
    }
  }
  return out
}

// group letter -> the team that has clinched winning it (if any).
export function groupWinners(clinch) {
  const winners = {}
  for (const g of GROUPS) {
    const w = TEAMS[g].find((t) => clinch?.[t.name] === 'won-group')
    if (w) winners[g] = w.name
  }
  return winners
}

// Fill in knockout "Winner Group X" placeholders with the team that has clinched
// that group, so the resolved team flows through to EVERY consumer (bracket,
// match-detail modal, schedule cards, calendar) — not just one view. Only the
// group-winner slot is determinable from clinch status; runner-up / third-place
// slots stay as placeholders until results settle them.
const WINNER_SLOT = /^Winner Group ([A-L])$/
export function resolveClinchedSlots(matches, clinch) {
  const winners = groupWinners(clinch)
  if (!Object.keys(winners).length) return matches
  const sub = (name) => {
    const hit = WINNER_SLOT.exec(name)
    return hit && winners[hit[1]] ? winners[hit[1]] : name
  }
  return matches.map((m) => {
    const t1 = sub(m.t1)
    const t2 = sub(m.t2)
    return t1 === m.t1 && t2 === m.t2 ? m : { ...m, t1, t2 }
  })
}

// Once a group's matches are ALL final, its runner-up is settled, so fill the
// "Runner-up Group X" knockout placeholders with the real team — mirroring how
// resolveClinchedSlots fills the winner. (The winner can clinch earlier, on
// points alone; a runner-up is only pinned down once results settle, which for
// a 4-team group means every group match is final.) Third-place slots stay as
// placeholders: which third lands in which tie depends on the cross-group race.
const RUNNERUP_SLOT = /^Runner-up Group ([A-L])$/
const GROUP_MATCH_COUNT = 6 // 4 teams => 6 matches per group
const isFinal = (m) => m.score && !m.live && !m.voided
export function groupRunnersUp(matches) {
  const out = {}
  for (const g of GROUPS) {
    const groupMatches = matches.filter((m) => m.stage === 'Group' && m.group === g)
    if (groupMatches.length < GROUP_MATCH_COUNT || !groupMatches.every(isFinal)) continue
    const second = rankGroup(g, groupMatches)[1]
    if (second) out[g] = second.name
  }
  return out
}

export function resolveRunnerUpSlots(matches) {
  const runners = groupRunnersUp(matches)
  if (!Object.keys(runners).length) return matches
  const sub = (name) => {
    const hit = RUNNERUP_SLOT.exec(name)
    return hit && runners[hit[1]] ? runners[hit[1]] : name
  }
  return matches.map((m) => {
    const t1 = sub(m.t1)
    const t2 = sub(m.t2)
    return t1 === m.t1 && t2 === m.t2 ? m : { ...m, t1, t2 }
  })
}

// Teams whose clinch status newly changed between two sets of results — a new
// clinch, an upgrade (e.g. top2 → won-group), or a new elimination. Used by the
// autofill email to announce only what THIS batch of final scores settled
// (compare the picture with the new results vs without them).
export function newlyClinched(beforeMatches, afterMatches) {
  const before = computeClinch(beforeMatches)
  const after = computeClinch(afterMatches)
  const changes = []
  for (const g of GROUPS) {
    for (const t of TEAMS[g]) {
      const now = after[t.name]
      if (now && now !== before[t.name]) changes.push({ team: t.name, group: g, status: now })
    }
  }
  return changes
}

// One-line announcement for a clinch change, for the notification email.
export function clinchHeadline({ team, group, status }) {
  switch (status) {
    case 'won-group':
      return `🥇 ${team} have WON Group ${group}`
    case 'runner-up':
      return `🥈 ${team} are THROUGH as Group ${group} RUNNERS-UP`
    case 'top2':
      return `✅ ${team} are THROUGH to the Round of 32 (top two of Group ${group})`
    case 'third':
      return `✅ ${team} are THROUGH to the Round of 32 (Group ${group})`
    case 'eliminated':
      return `❌ ${team} are ELIMINATED from Group ${group}`
    default:
      return `${team} (Group ${group}): ${status}`
  }
}

// Short label + tooltip for a status, for the UI. Returns null for null status.
export function clinchBadge(status) {
  switch (status) {
    case 'won-group':
      return { cls: 'c-won', label: '🥇', text: 'Won group', title: 'Has clinched first place in the group' }
    case 'runner-up':
      return { cls: 'c-silver', label: '🥈', text: 'Group runner-up', title: 'Has clinched second place — through to the Round of 32 as the group runner-up' }
    case 'top2':
      return { cls: 'c-in', label: '✅', text: 'Through', title: 'Has clinched a top-two finish — through to the Round of 32 (1st vs 2nd still open)' }
    case 'third':
      return { cls: 'c-in', label: '✅', text: 'Through (3rd)', title: 'Has clinched advancement to the Round of 32 as one of the 8 best third-placed teams' }
    case 'eliminated':
      return { cls: 'c-out', label: '❌', text: 'Eliminated', title: 'Cannot advance under any remaining results' }
    default:
      return null
  }
}
