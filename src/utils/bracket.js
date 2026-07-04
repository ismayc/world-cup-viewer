// Knockout bracket layout. The "Winner Match N" feed labels don't line up by
// adjacent match number, so we hard-order each round so that the boxes that
// feed a later box sit next to each other vertically — producing a readable
// two-sided bracket that meets at the Final.

import { FLAG_BY_TEAM } from '../data/teams.js'
import { MATCHES } from '../data/matches.js'

// A still-unresolved feed slot ("Winner Match 73" / "Loser Match 73") expands to
// the two teams of the tie it feeds from, ONCE that tie has both real teams — the
// "potential matchup" (e.g. "🇲🇽 Mexico / 🇨🇦 Canada"). Returns { a, b, kind, num }
// or null for a real team, a non-feed label, or a source tie not yet resolved.
// `byNum` maps match number → (resolved) match. Used by the bracket + the
// Schedule/Week cards so an upcoming knockout reads as its candidate pairing.
const FEED_LABEL = /^(Winner|Loser) Match (\d+)$/
export function feederTeams(label, byNum) {
  const hit = FEED_LABEL.exec(label)
  if (!hit || !byNum) return null
  const fm = byNum[Number(hit[2])]
  if (!fm || !FLAG_BY_TEAM[fm.t1] || !FLAG_BY_TEAM[fm.t2]) return null
  return { a: fm.t1, b: fm.t2, kind: hit[1], num: fm.num }
}

export const BRACKET = {
  left: {
    R32: [74, 77, 73, 75, 83, 84, 81, 82],
    R16: [89, 90, 93, 94],
    QF: [97, 98],
    SF: [101],
  },
  final: [104],
  right: {
    SF: [102],
    QF: [99, 100],
    R16: [91, 92, 95, 96],
    R32: [76, 78, 79, 80, 86, 88, 85, 87],
  },
  third: [103],
}

export function matchesByNum(matches) {
  return matches.reduce((acc, m) => {
    acc[m.num] = m
    return acc
  }, {})
}

// Map each group letter to the Round-of-32 match its winner / runner-up feed
// into, parsed from the R32 placeholder labels ("Winner Group A" etc.). Third-
// place routes are intentionally omitted: a group's 3rd-placed team can land in
// one of several ties depending on which third-placed teams advance.
const WINNER_LABEL = /^Winner Group ([A-L])$/
const RUNNERUP_LABEL = /^Runner-up Group ([A-L])$/

export function groupSlotMap(matches) {
  const map = {}
  const slot = (g) => (map[g] ||= { win: null, runnerUp: null })
  for (const m of matches) {
    if (m.stage !== 'R32') continue
    for (const side of [m.t1, m.t2]) {
      let hit = WINNER_LABEL.exec(side)
      if (hit) { slot(hit[1]).win = m.num; continue }
      hit = RUNNERUP_LABEL.exec(side)
      if (hit) slot(hit[1]).runnerUp = m.num
    }
  }
  return map
}

// Static winner-advancement edges: child match number → the match its WINNER
// feeds into. Parsed once from the original "Winner Match N" labels (resolved
// matches drop those labels, so we read the invariant fixture data). The Final
// (104) has no parent; "Loser Match N" edges (the third-place play-off) are
// intentionally excluded — a path to the Final follows winners only.
const WINNER_MATCH_LABEL = /^Winner Match (\d+)$/
const KO_WINNER_PARENT = (() => {
  const parent = {}
  for (const m of MATCHES) {
    for (const side of [m.t1, m.t2]) {
      const hit = WINNER_MATCH_LABEL.exec(side)
      if (hit) parent[Number(hit[1])] = m.num
    }
  }
  return parent
})()

// Winner of a FINAL knockout tie (penalties break a draw); null while the match
// is live, voided, or otherwise unsettled. A local mirror of decideMatch's
// winner rule, kept here to avoid dragging the whole resolver into this widely
// imported module.
function koWinner(m) {
  if (!m || !Array.isArray(m.score) || m.live || m.voided) return null
  const [a, b] = m.score
  if (a > b) return m.t1
  if (b > a) return m.t2
  const p = m.pens
  if (p && p[0] != null && p[1] != null && p[0] !== p[1]) return p[0] > p[1] ? m.t1 : m.t2
  return null
}

// Real teams that have reached the Round of 32 (a knockout slot filled with an
// actual team), sorted — the candidates for a "path to the Final" trace.
export function knockoutTeams(byNum) {
  const set = new Set()
  for (const m of Object.values(byNum)) {
    if (m.stage !== 'R32') continue
    for (const t of [m.t1, m.t2]) if (FLAG_BY_TEAM[t]) set.add(t)
  }
  return [...set].sort()
}

// Trace one team's route through the knockout bracket, from its Round-of-32 tie
// inward to the Final. The route is structural (fixed by the bracket topology),
// so it exists whether the team is still alive or already out. Returns:
//   nums    — the full route, R32 → Final (match numbers, outer to inner)
//   here    — the route matches the team is actually a participant in
//   exitNum — the match where the team was knocked out, or null (alive/champion)
//   active  — the stretch of the route to highlight: the whole route while the
//             team is alive, or only through its exit once eliminated
// Returns null when the team isn't (yet) in the Round of 32.
export function pathToFinal(team, byNum) {
  if (!team) return null
  const r32 = Object.values(byNum).find(
    (m) => m.stage === 'R32' && (m.t1 === team || m.t2 === team),
  )
  if (!r32) return null
  const nums = []
  for (let cur = r32.num; cur != null; cur = KO_WINNER_PARENT[cur]) nums.push(cur)
  const here = nums.filter((n) => {
    const m = byNum[n]
    return m && (m.t1 === team || m.t2 === team)
  })
  let exitNum = null
  for (const n of here) {
    const w = koWinner(byNum[n])
    if (w && w !== team) { exitNum = n; break }
  }
  const active = exitNum == null ? nums : nums.slice(0, nums.indexOf(exitNum) + 1)
  return { team, nums, here, exitNum, active }
}
