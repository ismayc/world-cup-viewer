// EXACT Round-of-32 outlook by full enumeration. Unlike a Monte-Carlo estimate,
// this walks EVERY remaining win/draw/loss combination of the group games and
// tallies, for each open bracket slot, the share that put each team there.
//
// The discrete outcome space is 3^(remaining games) — at a full final matchday
// (14 games left) that's 3^14 = 4,782,969 combinations, which is heavy but
// enumerable (run it in a Web Worker). Goals can't be enumerated (unbounded), so
// a one-goal margin is used as the convention for goal-difference tie-breakers.
//
// Decomposition for speed: each group's contribution (its winner / runner-up /
// third-place profile for a given W/D/L pattern) is precomputed once, then we
// iterate the cartesian product of the groups' patterns — each step is just table
// lookups, a 12-way third-place sort, an Annexe C lookup, and 16 slot writes.

import { MATCHES } from '../data/matches.js'
import { TEAMS } from '../data/teams.js'
import { rankGroup } from './qualification.js'
import { cmpThird } from './clinch.js'
import { THIRD_PLACE_COMBINATIONS, THIRD_WINNER_ORDER } from '../data/thirdPlaceCombinations.js'

const GROUPS = Object.keys(TEAMS)
const SCORE = { W: [1, 0], D: [1, 1], L: [0, 1] } // one-goal convention
const PATTERNS = ['W', 'D', 'L']

function parseSlot(label) {
  let m = /^Winner Group ([A-L])$/.exec(label)
  if (m) return { type: 'winner', group: m[1] }
  m = /^Runner-up Group ([A-L])$/.exec(label)
  if (m) return { type: 'runner', group: m[1] }
  if (/^3rd /.test(label)) return { type: 'third' }
  return { type: 'other' }
}

// Static R32 slot structure (invariant; the live feed may resolve labels to real
// teams, so we always read from the static schedule).
const R32 = MATCHES.filter((m) => m.stage === 'R32').map((m) => ({
  num: m.num,
  sides: [parseSlot(m.t1), parseSlot(m.t2)],
}))

export const R32_SLOT_LABELS = Object.fromEntries(
  MATCHES.filter((m) => m.stage === 'R32').map((m) => [m.num, [m.t1, m.t2]]),
)

const isRemaining = (m) => m.stage === 'Group' && !m.voided && !(Array.isArray(m.score) && !m.live)

// Number of remaining group games and the size of the outcome space (3^that).
export function countRemaining(matches) {
  return matches.filter(isRemaining).length
}
export function totalOutcomes(matches) {
  return 3 ** countRemaining(matches)
}

// Precompute every group's possible (winner, runner-up, third profile) keyed by
// the W/D/L pattern of its remaining games (one-goal scorelines). A completed
// group yields a single fixed outcome.
function groupOutcomes(matches) {
  const out = {}
  for (const g of GROUPS) {
    const all = matches.filter((m) => m.stage === 'Group' && m.group === g)
    const played = all.filter((m) => !isRemaining(m) && Array.isArray(m.score))
    const remaining = all.filter(isRemaining)
    const outs = []
    const pat = new Array(remaining.length)
    const visit = (i) => {
      if (i === remaining.length) {
        const synthetic = played.concat(remaining.map((m, ix) => ({ ...m, score: SCORE[pat[ix]] })))
        const o = rankGroup(g, synthetic)
        outs.push({
          w: o[0].name,
          r: o[1].name,
          t: { team: o[2].name, Pts: o[2].Pts, GD: o[2].GD, GF: o[2].GF, group: g },
        })
        return
      }
      for (const p of PATTERNS) {
        pat[i] = p
        visit(i + 1)
      }
    }
    visit(0)
    out[g] = outs
  }
  return out
}

// Enumerate all remaining W/D/L combinations and tally each R32 slot. Calls
// onProgress(done, total) periodically. Returns { total, remaining, perMatch }
// where perMatch[num] = [sideDist, sideDist] and a sideDist is
// { locked: team|null, candidates: [{ team, count, pct }] (desc) }.
export function enumerateOutlook(matches, onProgress) {
  const remaining = countRemaining(matches)
  const total = 3 ** remaining
  const perGroup = groupOutcomes(matches)
  const order = GROUPS // iterate all 12; completed groups have length 1

  const counts = {}
  for (const m of R32) counts[m.num] = [new Map(), new Map()]

  const idx = new Array(order.length).fill(0)
  const W = {}
  const R = {}
  const T = {}
  const thirds = new Array(12)
  let done = 0
  const STEP = 50000

  // Odometer over the per-group pattern choices.
  for (;;) {
    // Assemble this combination.
    for (let gi = 0; gi < order.length; gi++) {
      const g = order[gi]
      const o = perGroup[g][idx[gi]]
      W[g] = o.w
      R[g] = o.r
      T[g] = o.t.team
      thirds[gi] = o.t
    }
    thirds.sort(cmpThird)
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
          const map = counts[m.num][side]
          map.set(team, (map.get(team) || 0) + 1)
        }
      }
    }

    done++
    if (onProgress && done % STEP === 0) onProgress(done, total)

    // Increment odometer.
    let k = order.length - 1
    while (k >= 0) {
      idx[k]++
      if (idx[k] < perGroup[order[k]].length) break
      idx[k] = 0
      k--
    }
    if (k < 0) break
  }
  if (onProgress) onProgress(total, total)

  const perMatch = {}
  for (const m of R32) {
    perMatch[m.num] = counts[m.num].map((map) => {
      const candidates = [...map.entries()]
        .map(([team, count]) => ({ team, count, pct: count / total }))
        .sort((a, b) => b.count - a.count)
      const locked = candidates.length === 1 && candidates[0].count === total ? candidates[0].team : null
      return { locked, candidates }
    })
  }
  return { total, remaining, perMatch }
}
