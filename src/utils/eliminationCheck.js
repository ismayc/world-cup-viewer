// EXACT "is this team still mathematically alive?" check — the companion to the
// R32 Outlook's probability view, which deliberately can't answer this.
//
// The Outlook enumerates win/draw/loss combinations under a ONE-GOAL convention
// (every remaining game modelled 1–0 / 1–1 / 0–1) because goals are unbounded.
// That's fine for points-driven questions, but it understates a bubble third-
// place team whose only survival paths need real goal-difference swings — a
// rival third finishing well below them via a heavy defeat the one-goal model
// can't represent. Such a team tallies 0% and vanishes from the Outlook even
// though it is NOT eliminated (Scotland, 3 pts / −3, is the textbook case).
//
// This module answers the elimination question objectively instead of by
// proportion. It enumerates each group's remaining SCORELINES (not just W/D/L)
// up to a generous goal cap — the same exact engine clinch.js uses — and applies
// the FULL FIFA third-place comparator (points → GD → goals → conduct → FIFA
// ranking), so the verdict is exact, not a sound-but-loose bound.
//
// Independence is the key that keeps it cheap: results in one group never affect
// another group's table, so a team's best path is found by optimising each group
// on its own. With only a couple of games left per group the scoreline space is
// tiny; early in the stage a group may exceed the budget, in which case we stay
// silent for it (treat as "can't prove forced above") — conservative, never a
// false elimination.

import { TEAMS } from '../data/teams.js'
import { rankGroup } from './qualification.js'
import { byFifaRank } from '../data/fifaRanking.js'
import { goalCap, scorelinesUpTo } from './clinch.js'

const GROUPS = Object.keys(TEAMS)
const ADVANCING_THIRDS = 8 // 8 of the 12 third-placed teams advance
// Mirrors clinch.js: a group with a small remaining scoreline space is exact;
// anything larger falls back to a conservative "unknown" (claims no elimination).
const SCENARIO_BUDGET = 500000

const isDecided = (m) => m.score && !m.live && !m.voided

// True when third-place profile `a` ranks STRICTLY ABOVE `b` across groups, using
// the official 2026 order: points → goal difference → goals → conduct (cards) →
// FIFA ranking. (No cross-group head-to-head — those teams never met.) Built from
// the same descending comparator computeQualification sorts thirds with, so the
// two can never disagree: that comparator is < 0 exactly when `a` sorts first.
export function thirdRanksAbove(a, b) {
  return (
    b.Pts - a.Pts ||
    b.GD - a.GD ||
    b.GF - a.GF ||
    b.conduct - a.conduct ||
    byFifaRank(a.name, b.name)
  ) < 0
}

// Enumerate every completion of one group's remaining matches (exact scorelines,
// not just W/D/L) and collect: each team's set of reachable finishing ranks, and
// the set of DISTINCT third-place profiles the group can produce. `feasible` is
// false when the scoreline space exceeds the budget (early in the stage).
function groupReach(group, matches) {
  const all = matches.filter((m) => m.stage === 'Group' && m.group === group)
  const played = all.filter(isDecided)
  const remaining = all.filter((m) => !isDecided(m))
  const names = TEAMS[group].map((t) => t.name)

  const cap = goalCap(rankGroup(group, played))
  const scorelines = scorelinesUpTo(cap)
  const total = remaining.length === 0 ? 1 : scorelines.length ** remaining.length
  if (total > SCENARIO_BUDGET) return { group, names, feasible: false }

  const ranks = {}
  for (const n of names) ranks[n] = new Set()
  const thirds = []
  const seen = new Set()

  const assign = new Array(remaining.length)
  const visit = (i) => {
    if (i === remaining.length) {
      const synthetic = played.concat(remaining.map((m, ix) => ({ ...m, score: assign[ix] })))
      const ordered = rankGroup(group, synthetic)
      ordered.forEach((r, ix) => ranks[r.name].add(ix + 1))
      const t = ordered[2]
      const key = `${t.name}|${t.Pts}|${t.GD}|${t.GF}|${t.conduct}`
      if (!seen.has(key)) {
        seen.add(key)
        thirds.push({ name: t.name, group, Pts: t.Pts, GD: t.GD, GF: t.GF, conduct: t.conduct })
      }
      return
    }
    for (const s of scorelines) {
      assign[i] = s
      visit(i + 1)
    }
  }
  visit(0)

  return { group, names, feasible: true, ranks, thirds }
}

// Per-team verdict: 'eliminated' | 'alive'. 'alive' means there exists SOME
// completion of the remaining games in which the team reaches the Round of 32
// (as a top-two finisher or one of the 8 best thirds). Exact when every group is
// enumerable; otherwise conservative (an unenumerable rival group can't be used
// to force a team out, so we never wrongly eliminate).
export function eliminationStatus(matches) {
  const reach = {}
  for (const g of GROUPS) reach[g] = groupReach(g, matches)

  const status = {}
  for (const g of GROUPS) {
    const r = reach[g]
    for (const name of r.names) {
      if (!r.feasible) {
        status[name] = 'alive' // too open to enumerate → never over-claim
        continue
      }
      const myRanks = r.ranks[name]
      // A top-two finish advances outright, independent of the thirds race.
      if (myRanks.has(1) || myRanks.has(2)) {
        status[name] = 'alive'
        continue
      }
      // Can't even reach 3rd → locked into 4th → out.
      if (!myRanks.has(3)) {
        status[name] = 'eliminated'
        continue
      }
      // Only path is as a best third. Use the STRONGEST third profile the team
      // can finish with (a stronger profile is beaten by fewer rivals, so it's
      // optimal). Then count how many OTHER groups are FORCED to field a third
      // above it — i.e. every scoreline of that group yields a stronger third.
      // Groups being independent, all the non-forced groups can simultaneously be
      // arranged to sit at-or-below us, so this count is the true minimum number
      // of thirds above us. ≤7 above ⇒ we make the top 8.
      const mine = r.thirds.filter((t) => t.name === name)
      let best = mine[0]
      for (const t of mine) if (thirdRanksAbove(t, best)) best = t

      let forcedAbove = 0
      for (const og of GROUPS) {
        if (og === g) continue
        const o = reach[og]
        if (!o.feasible) continue // unprovable → don't count (stays conservative)
        if (o.thirds.length > 0 && o.thirds.every((t) => thirdRanksAbove(t, best))) forcedAbove++
      }
      status[name] = forcedAbove <= ADVANCING_THIRDS - 1 ? 'alive' : 'eliminated'
    }
  }
  return status
}

// Convenience: the set of teams that can still reach the Round of 32 (everyone
// not eliminated, which includes already-qualified teams).
export function survivingTeams(matches) {
  const status = eliminationStatus(matches)
  return Object.keys(status).filter((name) => status[name] !== 'eliminated')
}

// Single-team helper.
export function isAlive(matches, team) {
  return eliminationStatus(matches)[team] !== 'eliminated'
}
