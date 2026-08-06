// "As it stands" — project the Round of 32 from the CURRENT group standings, so
// each group can show where its 1st / 2nd / (qualifying) 3rd would land right now.
//
// Winner and runner-up slots resolve directly from the live standings. The 3rd-
// place slots ("3rd C/E/F/H/I") are assigned per FIFA's official Annexe C table
// (data/thirdPlaceCombinations.js): given which eight of the twelve groups
// currently produce a qualifying third, the table says which third each of the
// eight "winner v third" hosts plays. If fewer than eight thirds have data yet
// (early in the group stage) the combination isn't in the table, so we fall back
// to constraint-matching the candidate-group lists — always a valid bracket.

import { MATCHES } from '../data/matches.js'
import { TEAMS } from '../data/teams.js'
import { computeQualification } from './qualification.js'
import { THIRD_PLACE_COMBINATIONS, THIRD_WINNER_ORDER } from '../data/thirdPlaceCombinations.js'

const GROUPS = Object.keys(TEAMS)
const ADVANCING_THIRDS = 8

// The R32 slot labels ("Winner Group A", "3rd C/E/F/H/I") are invariant, but the
// LIVE matches we're handed have clinched winners already resolved to real teams
// (e.g. "Winner Group E" → "Germany") — which would no longer parse as a slot.
// So read each R32 match's slot labels from the STATIC schedule, by match number.
const R32_SLOTS = new Map(MATCHES.filter((m) => m.stage === 'R32').map((m) => [m.num, [m.t1, m.t2]]))

function parseSlot(label) {
  let m = /^Winner Group ([A-L])$/.exec(label)
  if (m) return { type: 'winner', group: m[1] }
  m = /^Runner-up Group ([A-L])$/.exec(label)
  if (m) return { type: 'runner', group: m[1] }
  m = /^3rd ([A-L/]+)$/.exec(label)
  if (m) return { type: 'third', groups: m[1].split('/') }
  return { type: 'other', label }
}

// Fallback only: bipartite matching (Kuhn's) of qualifying third-place groups to
// 3rd-place slots over the candidate lists. Used when the current combination
// isn't a complete 8-group set the Annexe C table covers.
export function matchThirds(groups, slots) {
  const groupForSlot = new Map()
  const assign = (group, visited) => {
    for (const s of slots) {
      if (!s.slot.groups.includes(group) || visited.has(s)) continue
      visited.add(s)
      if (!groupForSlot.has(s) || assign(groupForSlot.get(s), visited)) {
        groupForSlot.set(s, group)
        return true
      }
    }
    return false
  }
  for (const g of groups) assign(g, new Set())
  return groupForSlot
}

// Returns { perGroup, complete, official } where perGroup[g] = {
//   first / second / third: { team, opponent, matchNum } | null,
//   thirdTeam, thirdQualifies,
// }. `official` is true when the third-place slots came from the Annexe C table.
export function projectKnockout(matches) {
  const qual = computeQualification(matches)
  const first = {}
  const second = {}
  const third = {}
  for (const g of GROUPS) {
    /* v8 ignore start -- unreachable: rankGroup seeds its rows from the committed group, so every group always has a 1st, 2nd and 3rd */
    first[g] = qual.groups[g]?.[0] || null
    second[g] = qual.groups[g]?.[1] || null
    third[g] = qual.groups[g]?.[2] || null
    /* v8 ignore stop */
  }

  const qualifyingThirdGroups = qual.thirds.slice(0, ADVANCING_THIRDS).map((t) => t.group)
  const qualifyingSet = new Set(qualifyingThirdGroups)

  // Every R32 side, with its parsed slot, indexed by match.
  const sides = []
  for (const m of matches) {
    if (m.stage !== 'R32') continue
    const [t1, t2] = R32_SLOTS.get(m.num) || [m.t1, m.t2]
    sides.push({ matchNum: m.num, sideIdx: 0, slot: parseSlot(t1) })
    sides.push({ matchNum: m.num, sideIdx: 1, slot: parseSlot(t2) })
  }
  const byMatch = new Map()
  for (const s of sides) {
    if (!byMatch.has(s.matchNum)) byMatch.set(s.matchNum, [])
    byMatch.get(s.matchNum).push(s)
  }
  const thirdSides = sides.filter((s) => s.slot.type === 'third')

  // Resolve each third-slot to a group: prefer the official Annexe C table.
  const thirdSlotGroup = new Map()
  let official = false
  /* v8 ignore start -- unreachable: there are always exactly twelve thirds (one per committed group), so the qualifying set always has ADVANCING_THIRDS of them and the Annexe C table always answers */
  const key = qualifyingThirdGroups.length === ADVANCING_THIRDS ? [...qualifyingThirdGroups].sort().join('') : null
  const combo = key ? THIRD_PLACE_COMBINATIONS[key] : null
  /* v8 ignore stop */
  if (combo) {
    official = true
    const winnerToThird = {}
    THIRD_WINNER_ORDER.forEach((w, i) => (winnerToThird[w] = combo[i]))
    for (const s of thirdSides) {
      /* v8 ignore next -- unreachable: every R32 match pushed both of its sides into byMatch above, so the lookup always hits */
      const winnerSide = (byMatch.get(s.matchNum) || []).find((o) => o.slot.type === 'winner')
      const w = winnerSide?.slot.group
      if (w && winnerToThird[w]) thirdSlotGroup.set(s, winnerToThird[w])
    }
  } /* v8 ignore start */ else {
    // Unreachable via the public API: the Annexe C table holds all C(12,8)=495
    // eight-group combos, and there are always exactly 12 thirds (one per real
    // group), so a combo is always found. matchThirds is unit-tested directly.
    for (const [s, g] of matchThirds(qualifyingThirdGroups, thirdSides)) thirdSlotGroup.set(s, g)
  } /* v8 ignore stop */

  const teamForSide = (s) => {
    /* v8 ignore next -- unreachable: every entry match pushes exactly two sides, so opponentOf's find() always returns the sibling */
    if (!s) return null
    if (s.slot.type === 'winner') return first[s.slot.group]
    if (s.slot.type === 'runner') return second[s.slot.group]
    if (s.slot.type === 'third') {
      const g = thirdSlotGroup.get(s)
      return g ? third[g] : null
    }
    return null
  }
  /* v8 ignore next -- unreachable: every R32 match pushed both of its sides into byMatch above, so the lookup always hits */
  const opponentOf = (s) => teamForSide((byMatch.get(s.matchNum) || []).find((o) => o !== s))

  const perGroup = {}
  for (const g of GROUPS) {
    perGroup[g] = {
      first: null,
      second: null,
      /* v8 ignore next -- unreachable: `third` is filled for every group above, so each group always names a third-placed team */
      thirdTeam: third[g]?.name || null,
      thirdQualifies: qualifyingSet.has(g),
      third: null,
    }
  }
  let complete = true
  for (const s of sides) {
    const opp = opponentOf(s)
    if (s.slot.type === 'winner') {
      perGroup[s.slot.group].first = {
        /* v8 ignore next -- unreachable: `first` is filled for every group above, so the side always names a team */
        team: first[s.slot.group]?.name || null,
        opponent: opp?.name || null,
        matchNum: s.matchNum,
      }
      if (!teamForSide(s) || !opp) complete = false
    } else if (s.slot.type === 'runner') {
      perGroup[s.slot.group].second = {
        /* v8 ignore next -- unreachable: `second` is filled for every group above, so the side always names a team */
        team: second[s.slot.group]?.name || null,
        opponent: opp?.name || null,
        matchNum: s.matchNum,
      }
      if (!teamForSide(s) || !opp) complete = false
    } else if (s.slot.type === 'third') {
      const g = thirdSlotGroup.get(s)
      if (g)
        perGroup[g].third = {
          /* v8 ignore next -- unreachable: `third` is filled for every group above, so the side always names a team */
          team: third[g]?.name || null,
          /* v8 ignore next -- unreachable: a third slot is only ever assigned a group via its tie's WINNER side, and that side always names a team */
          opponent: opp?.name || null,
          matchNum: s.matchNum,
        }
    }
  }
  return { perGroup, complete, official }
}
