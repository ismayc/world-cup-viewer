// Round-of-32 "outlook": for each open bracket spot, what share of the remaining
// outcomes put each team there. This is NOT a forecast — every remaining game
// result is weighted equally (a coin-flip among win/draw/loss). We estimate the
// proportions by replaying many equally-weighted completions of the group stage
// and tallying who lands in each R32 slot. A spot that resolves to the same team
// in 100% of completions is mathematically locked.

import { MATCHES } from '../data/matches.js'
import { TEAMS } from '../data/teams.js'
import { computeQualification } from './qualification.js'
import { THIRD_PLACE_COMBINATIONS, THIRD_WINNER_ORDER } from '../data/thirdPlaceCombinations.js'

const GROUPS = Object.keys(TEAMS)
const R32 = MATCHES.filter((m) => m.stage === 'R32').map((m) => ({ num: m.num, slots: [m.t1, m.t2] }))

function parseSlot(label) {
  let m = /^Winner Group ([A-L])$/.exec(label)
  if (m) return { type: 'winner', group: m[1] }
  m = /^Runner-up Group ([A-L])$/.exec(label)
  if (m) return { type: 'runner', group: m[1] }
  if (/^3rd /.test(label)) return { type: 'third' }
  return { type: 'other' }
}

// Resolve both teams of every R32 match from a COMPLETE qualification picture.
// Returns { [matchNum]: [team1|null, team2|null] }.
export function resolveR32Slots(qual) {
  const winners = {}
  const runners = {}
  const thirds = {}
  for (const g of GROUPS) {
    winners[g] = qual.groups[g]?.[0]?.name || null
    runners[g] = qual.groups[g]?.[1]?.name || null
    thirds[g] = qual.groups[g]?.[2]?.name || null
  }
  const qualifyingGroups = qual.thirds.slice(0, 8).map((t) => t.group)
  const key = qualifyingGroups.length === 8 ? [...qualifyingGroups].sort().join('') : null
  const combo = key ? THIRD_PLACE_COMBINATIONS[key] : null
  const winnerToThird = {}
  if (combo) THIRD_WINNER_ORDER.forEach((w, i) => (winnerToThird[w] = combo[i]))

  const teamFor = (label, otherLabel) => {
    const s = parseSlot(label)
    if (s.type === 'winner') return winners[s.group]
    if (s.type === 'runner') return runners[s.group]
    if (s.type === 'third') {
      const o = parseSlot(otherLabel)
      const g = o.type === 'winner' ? winnerToThird[o.group] : null
      return g ? thirds[g] : null
    }
    return null
  }

  const out = {}
  for (const m of R32) out[m.num] = [teamFor(m.slots[0], m.slots[1]), teamFor(m.slots[1], m.slots[0])]
  return out
}

// A random scoreline weighting every result equally: win / draw / loss each 1/3,
// with a small neutral goals model (only goal difference within an outcome, used
// to settle tie-breakers, varies).
function randomScore(rng) {
  const r = rng()
  if (r < 1 / 3) {
    const g = Math.floor(rng() * 3)
    return [g, g]
  }
  const w = 1 + Math.floor(rng() * 3)
  const l = Math.floor(rng() * w)
  return r < 2 / 3 ? [w, l] : [l, w]
}

// Static R32 slot labels (for the UI to show what each open spot represents).
export const R32_SLOT_LABELS = Object.fromEntries(R32.map((m) => [m.num, m.slots]))

// Simulate `runs` equally-weighted completions of the remaining group games and
// tally, per R32 match side, how often each team fills it. Returns
// { runs, perMatch: { [num]: [sideDist, sideDist] } } where a sideDist is
// { locked: team|null, candidates: [{ team, count, pct }] (desc) }.
export function simulateR32(matches, { runs = 10000, rng = Math.random } = {}) {
  // A group match is "remaining" unless it has a FINAL score (a live match still
  // in progress is replayed, matching the clinch engine's treatment).
  const remaining = matches
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.stage === 'Group' && !m.voided && !(Array.isArray(m.score) && !m.live))
  const counts = {}
  for (const m of R32) counts[m.num] = [new Map(), new Map()]

  const sim = matches.slice()
  for (let run = 0; run < runs; run++) {
    for (const { m, i } of remaining) sim[i] = { ...m, score: randomScore(rng) }
    const qual = computeQualification(sim)
    const slots = resolveR32Slots(qual)
    for (const m of R32) {
      const pair = slots[m.num]
      for (let side = 0; side < 2; side++) {
        const team = pair[side]
        if (team) counts[m.num][side].set(team, (counts[m.num][side].get(team) || 0) + 1)
      }
    }
  }
  // Restore (sim shares references with `matches` for unplayed entries only via
  // copies, so nothing to undo — `matches` was never mutated).

  const perMatch = {}
  for (const m of R32) {
    perMatch[m.num] = counts[m.num].map((map) => {
      const candidates = [...map.entries()]
        .map(([team, count]) => ({ team, count, pct: count / runs }))
        .sort((a, b) => b.count - a.count)
      const locked = candidates.length === 1 && candidates[0].count === runs ? candidates[0].team : null
      return { locked, candidates }
    })
  }
  return { runs, perMatch }
}
