// Knockout-opponent clinch detection.
//
// "Has team X clinched a specific Round-of-32 opponent?" is more than "has X
// advanced" — it asks whether the opponent is the SAME team in every remaining
// completion of the group stage. Being conservative (only certain once all
// groups finish) under-claims: a matchup can be mathematically locked while
// other groups are still playing — e.g. a Runner-up A vs Runner-up B tie locks
// the moment Groups A & B finish, and a Winner-vs-3rd tie can lock earlier when
// the fixed profiles of already-completed groups pin the third-place assignment.
//
// Approach: a team is only handled here once its exact finishing slot is fixed
// (clinched group winner or runner-up). We then resolve the OTHER side of its
// R32 tie across every still-reachable outcome:
//   • Winner / Runner-up slot  -> locked iff that group's winner/runner-up is
//     itself clinched (a single team).
//   • Third-place slot          -> enumerate the still-reachable "8 best thirds"
//     combinations (FIFA Annexe C); if every one assigns this winner the SAME
//     group, and that group has finished (its third is a fixed team), the
//     opponent is locked.

import { TEAMS } from '../data/teams.js'
import { MATCHES } from '../data/matches.js'
import { rankGroup, groupComplete } from './qualification.js'
import { computeClinch, thirdProfileBounds, cmpThird } from './clinch.js'
import { THIRD_PLACE_COMBINATIONS, THIRD_WINNER_ORDER } from '../data/thirdPlaceCombinations.js'

const GROUPS = Object.keys(TEAMS)
// Static R32 slot labels by match number (the live feed resolves some to real
// team names, so always read the invariant labels from the static schedule).
const R32 = MATCHES.filter((m) => m.stage === 'R32').map((m) => ({ num: m.num, slots: [m.t1, m.t2] }))

function parseSlot(label) {
  let m = /^Winner Group ([A-L])$/.exec(label)
  if (m) return { type: 'winner', group: m[1] }
  m = /^Runner-up Group ([A-L])$/.exec(label)
  if (m) return { type: 'runner', group: m[1] }
  if (/^3rd /.test(label)) return { type: 'third' }
  return { type: 'other' }
}

// Which "8 best third-placed groups" combinations are STILL reachable. For each
// candidate (the keys of the Annexe C table), set in-combination groups to their
// best reachable third profile and out-of-combination groups to their worst; the
// combination is reachable iff none of the excluded groups can still out-rank the
// weakest included one (ties counted as reachable — a safe over-approximation, so
// we never wrongly declare a matchup locked).
export function reachableThirdSets(matches) {
  const bounds = thirdProfileBounds(matches)
  const out = []
  for (const key of Object.keys(THIRD_PLACE_COMBINATIONS)) {
    const inSet = new Set(key.split(''))
    let weakestIncluded = null
    for (const g of GROUPS) {
      if (!inSet.has(g)) continue
      const b = bounds[g].best
      if (weakestIncluded === null || cmpThird(b, weakestIncluded) < 0) weakestIncluded = b
    }
    if (!weakestIncluded) continue
    const blocked = GROUPS.some((g) => !inSet.has(g) && cmpThird(bounds[g].worst, weakestIncluded) > 0)
    if (!blocked) out.push(key)
  }
  return out
}

// The locked R32 opponent for `team`, or null if it isn't mathematically fixed
// yet. `clinch` may be passed in to avoid recomputing it.
export function lockedOpponent(matches, team, clinch = computeClinch(matches)) {
  const status = clinch[team]
  // Only a fixed finishing slot gives a determinate matchup to resolve.
  if (status !== 'won-group' && status !== 'runner-up') return null
  const group = GROUPS.find((g) => TEAMS[g].some((t) => t.name === team))
  if (!group) return null
  const mySlot = status === 'won-group' ? `Winner Group ${group}` : `Runner-up Group ${group}`

  const match = R32.find((m) => m.slots.includes(mySlot))
  if (!match) return null
  const oppLabel = match.slots[0] === mySlot ? match.slots[1] : match.slots[0]
  const slot = parseSlot(oppLabel)

  if (slot.type === 'winner' || slot.type === 'runner') {
    const want = slot.type === 'winner' ? 'won-group' : 'runner-up'
    const opp = TEAMS[slot.group].map((t) => t.name).find((n) => clinch[n] === want)
    return opp ? { opponent: opp, matchNum: match.num } : null
  }

  if (slot.type === 'third') {
    const wi = THIRD_WINNER_ORDER.indexOf(group)
    if (wi < 0) return null
    const sets = reachableThirdSets(matches)
    if (!sets.length) return null
    const assignedGroups = new Set(sets.map((key) => THIRD_PLACE_COMBINATIONS[key][wi]))
    if (assignedGroups.size !== 1) return null
    const g = [...assignedGroups][0]
    // The assigned group's third is only a single fixed team once it has finished.
    if (!groupComplete(g, matches)) return null
    const third = rankGroup(g, matches)[2]
    return third ? { opponent: third.name, matchNum: match.num } : null
  }

  return null
}
