// Deterministic "what-if" helpers for the Scenarios tab. No probabilities — the
// user picks the outcome of each remaining group game and we recompute the exact
// standings and projected Round-of-32 that those results would produce.

import { TEAMS } from '../data/teams.js'

const GROUPS = Object.keys(TEAMS)

// Representative scorelines for a picked outcome. The Scenarios tab works at
// win/draw/loss granularity; a one-goal margin is the neutral stand-in (exact
// placement in a goal-difference tie can depend on the actual scoreline, which
// the UI calls out separately).
export const PICK_SCORES = {
  home: [1, 0],
  draw: [1, 1],
  away: [0, 1],
}

// Group matches still to be played (no final score, not voided), grouped by
// group letter in kickoff order. Groups with nothing left are omitted.
export function remainingGroupMatches(matches) {
  const open = matches
    .filter((m) => m.stage === 'Group' && !Array.isArray(m.score) && !m.voided)
    .sort((a, b) => a.num - b.num)
  const byGroup = {}
  for (const m of open) (byGroup[m.group] = byGroup[m.group] || []).push(m)
  return byGroup
}

// A new matches array with each picked outcome filled in as a representative
// score. Unpicked matches are left untouched (still "to be played").
export function applyScenarioPicks(matches, picks) {
  if (!picks || !Object.keys(picks).length) return matches
  return matches.map((m) => {
    const pick = picks[m.num]
    return pick && PICK_SCORES[pick] ? { ...m, score: PICK_SCORES[pick] } : m
  })
}

// Groups that still have at least one unplayed game (under the given picks).
export function openGroups(matches) {
  const open = remainingGroupMatches(matches)
  return GROUPS.filter((g) => open[g] && open[g].length)
}

// How many of the remaining group games are still unpicked.
export function unpickedCount(matches, picks) {
  const open = remainingGroupMatches(matches)
  let n = 0
  for (const g of Object.keys(open)) for (const m of open[g]) if (!picks?.[m.num]) n++
  return n
}
