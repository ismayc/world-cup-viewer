// EXACT Round-of-32 outlook by full enumeration of remaining GOAL DIFFERENCES.
//
// Earlier this walked only win/draw/loss (a single one-goal scoreline per game),
// which collapses goal difference and so couldn't tell, say, whether a third-
// placed team finishes above or below a rival on GD. We now enumerate each
// remaining game's MARGIN over an adaptive range (±cap), so goal-difference tie-
// breakers resolve with real proportions — Scotland/Ecuador-type bubble cases get
// actual percentages instead of a 0%/"<1%" blind spot.
//
// Tractability: enumerating every margin combination directly is (2·cap+1)^games
// (e.g. 17^8 ≈ 7 billion). Instead we decompose per group — each group's two
// games are enumerated locally, and the many margin combinations that yield the
// SAME (winner, runner-up, third-place profile) are collapsed into one weighted
// outcome. The cross-group step then iterates the cartesian product of those
// DISTINCT per-group outcomes (a few million at most), accumulating the product
// of weights. The reported percentage for a slot is weighted-count / total, where
// total = Π (2·cap+1)^(remaining games in group) — i.e. every margin combination
// counts equally (a combinatorial proportion, NOT a forecast).
//
// Conventions:
//  • Goals are taken to equal the margin (win by k → k–0, draw → 0–0). Goal
//    DIFFERENCE is therefore exact; goals-SCORED (a lower tie-breaker) follows
//    this convention — a small residual approximation only when teams are level
//    on points AND goal difference.
//  • cap is adaptive: large enough to cover any tie-breaker-relevant margin
//    (≥8, like the clinch engine), but lowered automatically if the distinct-
//    outcome cartesian would be too large to walk.

import { MATCHES } from '../data/matches.js'
import { TEAMS } from '../data/teams.js'
import { rankGroup } from './qualification.js'
import { byFifaRank } from '../data/fifaRanking.js'
import { THIRD_PLACE_COMBINATIONS, THIRD_WINNER_ORDER } from '../data/thirdPlaceCombinations.js'

// Cross-group third-place ranking — IDENTICAL to computeQualification's: points,
// goal difference, goals, conduct (cards), then FIFA ranking. Descending (< 0
// when `a` outranks `b`).
const compareThirds = (a, b) =>
  b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || b.conduct - a.conduct || byFifaRank(a.team, b.team)

const GROUPS = Object.keys(TEAMS)

// Largest distinct-outcome cartesian we'll walk before lowering the cap.
const MAX_ITERS = 12_000_000

function parseSlot(label) {
  let m = /^Winner Group ([A-L])$/.exec(label)
  if (m) return { type: 'winner', group: m[1] }
  m = /^Runner-up Group ([A-L])$/.exec(label)
  if (m) return { type: 'runner', group: m[1] }
  if (/^3rd /.test(label)) return { type: 'third' }
  /* v8 ignore start -- defensive: every R32 slot label is a group-winner/runner-up/third */
  return { type: 'other' }
}
/* v8 ignore stop */

const R32 = MATCHES.filter((m) => m.stage === 'R32').map((m) => ({
  num: m.num,
  sides: [parseSlot(m.t1), parseSlot(m.t2)],
}))

export const R32_SLOT_LABELS = Object.fromEntries(
  MATCHES.filter((m) => m.stage === 'R32').map((m) => [m.num, [m.t1, m.t2]]),
)

const isRemaining = (m) => m.stage === 'Group' && !m.voided && !(Array.isArray(m.score) && !m.live)

export function countRemaining(matches) {
  return matches.filter(isRemaining).length
}

// A scoreline realising a given margin under the goals=margin convention.
const scoreForMargin = (d) => (d > 0 ? [d, 0] : d < 0 ? [0, -d] : [0, 0])

// Margin range to enumerate per game for the PERCENTAGES. A moderate ±8 keeps the
// proportions meaningful (a huge cap would dilute every share with unrealistic
// blow-outs) while still covering the goal-difference swings that decide almost
// every realistic third-place cut. The rare path that needs a bigger swing than
// this isn't lost: the exact "still alive" net (eliminationCheck, which uses a
// clinch-sized cap) catches it and flags it "<1%". chooseCaps lowers this only if
// the distinct-outcome cartesian would be too large to walk.
const BASE_CAP = 8
function baseCap() {
  return BASE_CAP
}

// Precompute every group's possible (winner, runner-up, third profile) at the
// given margin cap, COLLAPSING margin combinations that produce identical results
// into a single weighted outcome. Completed groups yield one outcome (weight 1).
function groupOutcomes(matches, cap) {
  const margins = []
  for (let d = -cap; d <= cap; d++) margins.push(d)
  const out = {}
  for (const g of GROUPS) {
    const all = matches.filter((m) => m.stage === 'Group' && m.group === g)
    const played = all.filter((m) => !isRemaining(m) && Array.isArray(m.score))
    const remaining = all.filter(isRemaining)
    const map = new Map()
    const pat = new Array(remaining.length)
    const visit = (i) => {
      if (i === remaining.length) {
        const synthetic = played.concat(remaining.map((m, ix) => ({ ...m, score: scoreForMargin(pat[ix]) })))
        const o = rankGroup(g, synthetic)
        const t = o[2]
        const key = `${o[0].name}|${o[1].name}|${t.name}|${t.Pts}|${t.GD}|${t.GF}|${t.conduct}`
        const e = map.get(key)
        if (e) e.weight++
        else
          map.set(key, {
            w: o[0].name,
            r: o[1].name,
            t: { team: t.name, Pts: t.Pts, GD: t.GD, GF: t.GF, conduct: t.conduct, group: g },
            weight: 1,
          })
        return
      }
      for (const d of margins) {
        pat[i] = d
        visit(i + 1)
      }
    }
    visit(0)
    out[g] = [...map.values()]
  }
  return out
}

// Tally the distinct-outcome cartesian size and the weighted total for a cap.
function atCap(matches, cap) {
  const go = groupOutcomes(matches, cap)
  let iters = 1
  let total = 1
  for (const g of GROUPS) {
    iters *= go[g].length
    total *= go[g].reduce((s, o) => s + o.weight, 0)
  }
  return { cap, go, iters, total }
}

// Use fixedCap verbatim (tests), else pick the largest adaptive cap whose
// distinct-outcome cartesian stays within MAX_ITERS (floor of 3).
function chooseCaps(matches, fixedCap) {
  if (fixedCap != null) return atCap(matches, fixedCap)
  let last = null
  for (let cap = baseCap(matches); cap >= 3; cap--) {
    last = atCap(matches, cap)
    if (last.iters <= MAX_ITERS) return last
  }
  return last
}

// Size of the distinct-outcome cartesian we actually walk, at the adaptive cap —
// for the progress display / "too big" gate.
export function countIterations(matches) {
  return chooseCaps(matches).iters
}

// Enumerate all distinct per-group outcome combinations and tally each R32 slot,
// weighted by how many margin combinations each represents. Returns
// { total, remaining, cap, perMatch } where perMatch[num] = [sideDist, sideDist],
// a sideDist = { locked: team|null, candidates: [{team, count, pct}] (desc) }.
// `fixedCap` forces a specific cap (used by the correctness tests).
export function enumerateOutlook(matches, onProgress, fixedCap) {
  const remaining = countRemaining(matches)
  const { cap, go, iters, total } = chooseCaps(matches, fixedCap)
  const order = GROUPS

  const counts = {}
  for (const m of R32) counts[m.num] = [new Map(), new Map()]

  const idx = new Array(order.length).fill(0)
  const W = {}
  const R = {}
  const T = {}
  const thirds = new Array(12)
  let done = 0
  const STEP = 50000

  for (;;) {
    let weight = 1
    for (let gi = 0; gi < order.length; gi++) {
      const o = go[order[gi]][idx[gi]]
      W[order[gi]] = o.w
      R[order[gi]] = o.r
      T[order[gi]] = o.t.team
      thirds[gi] = o.t
      weight *= o.weight
    }
    thirds.sort(compareThirds)
    const key = thirds.slice(0, 8).map((x) => x.group).sort().join('')
    const combo = THIRD_PLACE_COMBINATIONS[key]
    const w2t = {}
    if (combo) for (let i = 0; i < THIRD_WINNER_ORDER.length; i++) w2t[THIRD_WINNER_ORDER[i]] = combo[i]

    for (const m of R32) {
      for (let side = 0; side < 2; side++) {
        const s = m.sides[side]
        let team = null
        if (s.type === 'winner') team = W[s.group]
        else if (s.type === 'runner') team = R[s.group]
        else if (s.type === 'third') {
          const other = m.sides[1 - side]
          if (other.type === 'winner') {
            const g = w2t[other.group]
            if (g) team = T[g]
          }
        }
        if (team) {
          const mp = counts[m.num][side]
          mp.set(team, (mp.get(team) || 0) + weight)
        }
      }
    }

    done++
    if (onProgress && done % STEP === 0) onProgress(done, iters)

    let k = order.length - 1
    while (k >= 0) {
      idx[k]++
      if (idx[k] < go[order[k]].length) break
      idx[k] = 0
      k--
    }
    if (k < 0) break
  }
  if (onProgress) onProgress(iters, iters)

  const perMatch = {}
  for (const m of R32) {
    perMatch[m.num] = counts[m.num].map((mp) => {
      const candidates = [...mp.entries()]
        .map(([team, count]) => ({ team, count, pct: count / total }))
        .sort((a, b) => b.count - a.count)
      const locked = candidates.length === 1 && candidates[0].count === total ? candidates[0].team : null
      return { locked, candidates }
    })
  }
  return { total, remaining, cap, perMatch }
}
