// Resolve knockout-bracket placeholders into real teams as the tournament
// progresses — completing what clinch.js starts for the group slots:
//   • third-place qualifiers fill the "3rd X/Y/Z" R32 slots once the group
//     stage is fully FINAL (which of the 12 thirds advance, and the FIFA Annexe
//     C tie they each land in, is only settled then), reusing the projection
//     engine in asItStands.js;
//   • "Winner Match N" / "Loser Match N" slots fill from each knockout result
//     (penalties break a draw), propagating up the bracket round by round.
//
// All resolution is conservative: a slot stays a placeholder until its outcome
// is genuinely settled, so the bracket never shows a team that could still
// change. The Standings "as it stands" panel is where provisional projections
// live.

import { TEAMS } from '../data/teams.js'
import { resolveClinchedSlots, resolveRunnerUpSlots } from './clinch.js'
import { projectKnockout } from './asItStands.js'

const ALL_TEAMS = new Set(Object.values(TEAMS).flat().map((t) => t.name))
const THIRD_SLOT = /^3rd [A-L/]+$/
const WINNER_MATCH = /^Winner Match (\d+)$/
const LOSER_MATCH = /^Loser Match (\d+)$/

// A result counts only once FINAL — a live score is provisional, a voided match
// has no result. (Same rule the clinch engine uses for group matches.)
const isFinal = (m) => m.score && !m.live && !m.voided

// Winner / loser of a finished knockout tie. Penalties break a draw (after extra
// time the 90+ET score already sits in `score`). Returns null while the tie is
// still live/void, or drawn with no shootout recorded yet — so the feed slot
// stays a placeholder rather than guessing.
export function decideMatch(m) {
  if (!isFinal(m)) return null
  const [a, b] = m.score
  if (a > b) return { winner: m.t1, loser: m.t2 }
  if (b > a) return { winner: m.t2, loser: m.t1 }
  const p = m.pens
  if (p && p[0] != null && p[1] != null && p[0] !== p[1]) {
    return p[0] > p[1] ? { winner: m.t1, loser: m.t2 } : { winner: m.t2, loser: m.t1 }
  }
  return null
}

// Every group match played to a final result (no live/provisional scores).
const groupStageComplete = (matches) => {
  const g = matches.filter((m) => m.stage === 'Group')
  return g.length > 0 && g.every(isFinal)
}

// Fill the "3rd X/Y/Z" R32 slots with the actual third-placed teams. Gated on a
// fully-final group stage: which third lands where depends on which eight of the
// twelve thirds advance (FIFA Annexe C), and that's only settled once every
// group is done. Until then the Standings "as it stands" panel shows the
// provisional projection.
export function resolveThirdPlaceSlots(matches) {
  if (!groupStageComplete(matches)) return matches
  const { perGroup } = projectKnockout(matches)
  const fill = {} // R32 match number -> third-placed team
  for (const p of Object.values(perGroup)) {
    if (p.thirdQualifies && p.third?.matchNum && p.thirdTeam) fill[p.third.matchNum] = p.thirdTeam
  }
  if (!Object.keys(fill).length) return matches
  return matches.map((m) => {
    const team = fill[m.num]
    if (!team) return m
    const t1 = THIRD_SLOT.test(m.t1) ? team : m.t1
    const t2 = THIRD_SLOT.test(m.t2) ? team : m.t2
    return t1 === m.t1 && t2 === m.t2 ? m : { ...m, t1, t2 }
  })
}

// Fill "Winner Match N" / "Loser Match N" feed labels from finished ties,
// propagating up the bracket (a round's winners feed the next). Bounded passes =
// bracket depth. A slot resolves only when BOTH of the tie's teams are already
// real — otherwise the loser's name isn't known, so we wait.
export function resolveKnockoutSlots(matches) {
  const winner = {}
  const loser = {}
  const sub = (label) => {
    let h = WINNER_MATCH.exec(label)
    if (h && winner[h[1]]) return winner[h[1]]
    h = LOSER_MATCH.exec(label)
    if (h && loser[h[1]]) return loser[h[1]]
    return label
  }
  for (let pass = 0; pass < 8; pass++) {
    let changed = false
    for (const m of matches) {
      if (m.stage === 'Group' || winner[m.num] != null) continue
      const t1 = sub(m.t1)
      const t2 = sub(m.t2)
      if (!ALL_TEAMS.has(t1) || !ALL_TEAMS.has(t2)) continue
      const out = decideMatch({ ...m, t1, t2 })
      if (out) {
        winner[m.num] = out.winner
        loser[m.num] = out.loser
        changed = true
      }
    }
    if (!changed) break
  }
  if (!Object.keys(winner).length) return matches
  return matches.map((m) => {
    const t1 = sub(m.t1)
    const t2 = sub(m.t2)
    return t1 === m.t1 && t2 === m.t2 ? m : { ...m, t1, t2 }
  })
}

// Full bracket resolution, in dependency order: group winners (clinch) → settled
// runners-up → third-place qualifiers (group stage done) → knockout-match
// winners/losers propagated up the rounds.
export function resolveBracket(matches, clinch) {
  return resolveKnockoutSlots(
    resolveThirdPlaceSlots(resolveRunnerUpSlots(resolveClinchedSlots(matches, clinch))),
  )
}
