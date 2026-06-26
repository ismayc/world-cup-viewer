// Deterministic "what-if" helpers for the Scenarios tab. No probabilities — the
// user picks the result of each remaining group game and we recompute the exact
// standings and projected Round-of-32 that those results would produce.

import { TEAMS } from '../data/teams.js'
import { rankGroup } from './qualification.js'

const GROUPS = Object.keys(TEAMS)

// Representative scorelines for the quick win/draw/win buttons; the per-team
// steppers then let the user set any exact score (so goal-difference ties resolve
// precisely rather than by assumption).
export const PICK_SCORES = {
  home: [1, 0],
  draw: [1, 1],
  away: [0, 1],
}

// The win/draw/loss category of a scoreline, for highlighting the quick buttons.
export function pickOutcome(score) {
  if (!Array.isArray(score)) return null
  return score[0] > score[1] ? 'home' : score[0] < score[1] ? 'away' : 'draw'
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

// A new matches array with each picked scoreline filled in. `picks` maps a match
// number to a [home, away] score. Unpicked matches are left "to be played".
export function applyScenarioPicks(matches, picks) {
  if (!picks || !Object.keys(picks).length) return matches
  return matches.map((m) => {
    const p = picks[m.num]
    return Array.isArray(p) ? { ...m, score: [p[0], p[1]] } : m
  })
}

// Groups that still have at least one unplayed game.
export function openGroups(matches) {
  const open = remainingGroupMatches(matches)
  return GROUPS.filter((g) => open[g] && open[g].length)
}

// True once the group stage is in the rear-view: every group game has a final
// score AND it's been at least a day since the last group kickoff. Used to retire
// the group-stage-only tools (Scenarios, R32 Outlook) from the nav.
export function groupStageArchived(matches, now = Date.now()) {
  const group = matches.filter((m) => m.stage === 'Group' && !m.voided)
  if (!group.length) return false
  if (!group.every((m) => Array.isArray(m.score) && !m.live)) return false
  const lastKo = Math.max(...group.map((m) => new Date(m.ko).getTime()))
  return now > lastKo + 24 * 60 * 60 * 1000
}

// How many of the remaining group games are still unpicked.
export function unpickedCount(matches, picks) {
  const open = remainingGroupMatches(matches)
  let n = 0
  for (const g of Object.keys(open)) for (const m of open[g]) if (!Array.isArray(picks?.[m.num])) n++
  return n
}

// Goal cap for enumerating a group's remaining results — large enough that any
// goal-difference tie-break swing in a 4-team group is covered (mirrors the
// clinch engine's cap).
function goalCap(group, played) {
  let maxAbsGD = 0
  for (const r of rankGroup(group, played)) maxAbsGD = Math.max(maxAbsGD, Math.abs(r.GD))
  return Math.max(8, maxAbsGD + 6)
}

const ORDER_BUDGET = 200000

// How many DISTINCT final standings (orderings of the four teams) are still
// reachable for a group, given the results already set. Returns
// { count, decided }; count is null if the remaining games are too many to
// enumerate exactly (never the case once a group is down to its last matchday).
export function possibleOrderings(group, matches) {
  const all = matches.filter((m) => m.stage === 'Group' && m.group === group)
  const decided = (m) => Array.isArray(m.score) && !m.voided
  const played = all.filter(decided)
  const remaining = all.filter((m) => !decided(m))
  if (!remaining.length) return { count: 1, decided: true }

  const cap = goalCap(group, played)
  const scorelines = []
  for (let a = 0; a <= cap; a++) for (let b = 0; b <= cap; b++) scorelines.push([a, b])
  if (Math.pow(scorelines.length, remaining.length) > ORDER_BUDGET) return { count: null, decided: false }

  const seen = new Set()
  const assign = new Array(remaining.length)
  const visit = (i) => {
    if (i === remaining.length) {
      const synthetic = played.concat(remaining.map((m, idx) => ({ ...m, score: assign[idx] })))
      seen.add(rankGroup(group, synthetic).map((r) => r.name).join('>'))
      return
    }
    for (const s of scorelines) {
      assign[i] = s
      visit(i + 1)
    }
  }
  visit(0)
  return { count: seen.size, decided: seen.size === 1 }
}
