// Group ranking + qualification using the official 2026 FIFA World Cup tie-
// breakers. FIFA CHANGED the order for 2026: head-to-head now comes BEFORE
// overall goal difference (matching the UEFA Euro), and drawing of lots was
// replaced by FIFA ranking. Criteria, applied to teams level on points:
//   1. Points in all group matches
//   Then, among teams still level, applied to matches BETWEEN THEM only:
//   2. Head-to-head points
//   3. Head-to-head goal difference
//   4. Head-to-head goals scored
//   — re-applied to any subset that's still tied after the above —
//   If still equal, back to all group matches:
//   5. Goal difference in all group matches
//   6. Goals scored in all group matches
//   7. Team conduct score (cards) — computed BEST-EFFORT from ESPN's card feed
//      (yellow -1, red -4; ESPN can't always distinguish a 2nd yellow from a
//      direct red, and a card-less match scores 0, so treat it as approximate) —
//      then 8. FIFA World Ranking as the final decider (see data/fifaRanking.js).
//      Alphabetical order is only the last-ditch fallback for an unlisted team.
//
// Top two of each group advance; the eight best third-placed teams also advance
// to the Round of 32. Third place is compared ACROSS groups, where head-to-head
// can't apply (those teams never met), so it uses criteria 1 then 5–6 then 8.

import { TEAMS } from '../data/teams.js'
import { byFifaRank } from '../data/fifaRanking.js'

const GROUPS = Object.keys(TEAMS)
const GROUP_MATCH_COUNT = 6 // 4 teams => 6 matches per group

function blank(team, group) {
  return { ...team, group, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0, conduct: 0 }
}

// Team conduct score (FIFA criterion: fewest disciplinary points). Best-effort
// from ESPN's card feed, which flags yellow/red only — so we can't always tell a
// second yellow (-3) from a direct red (-4); reds are scored -4. yellow = -1.
// The score is 0 (no deduction) when a match carries no card data, so it should
// be treated as an approximation, not gospel.
function conductDelta(cards) {
  if (!Array.isArray(cards)) return 0
  return cards.reduce((s, c) => s + (c.color === 'red' ? -4 : -1), 0)
}

function baseStats(group, matches) {
  const rows = {}
  for (const t of TEAMS[group]) rows[t.name] = blank(t, group)
  for (const m of matches) {
    if (m.stage !== 'Group' || m.group !== group || !m.score || m.voided) continue
    const [g1, g2] = m.score
    const a = rows[m.t1]
    const b = rows[m.t2]
    if (!a || !b) continue
    a.P++; b.P++
    a.GF += g1; a.GA += g2
    b.GF += g2; b.GA += g1
    a.conduct += conductDelta(m.cards?.t1)
    b.conduct += conductDelta(m.cards?.t2)
    if (g1 > g2) { a.W++; b.L++; a.Pts += 3 }
    else if (g1 < g2) { b.W++; a.L++; b.Pts += 3 }
    else { a.D++; b.D++; a.Pts++; b.Pts++ }
  }
  for (const k in rows) rows[k].GD = rows[k].GF - rows[k].GA
  return rows
}

// Head-to-head sub-table among exactly the given (tied) team names.
export function headToHead(names, group, matches) {
  const set = new Set(names)
  const sub = {}
  for (const n of names) sub[n] = { Pts: 0, GD: 0, GF: 0 }
  for (const m of matches) {
    if (m.stage !== 'Group' || m.group !== group || !m.score) continue
    if (!set.has(m.t1) || !set.has(m.t2)) continue
    const [g1, g2] = m.score
    sub[m.t1].GF += g1; sub[m.t2].GF += g2
    sub[m.t1].GD += g1 - g2; sub[m.t2].GD += g2 - g1
    if (g1 > g2) sub[m.t1].Pts += 3
    else if (g1 < g2) sub[m.t2].Pts += 3
    else { sub[m.t1].Pts++; sub[m.t2].Pts++ }
  }
  return sub
}

// Order teams that are level on points per the 2026 criteria: head-to-head
// (points, GD, goals) among the tied teams first, re-applied to any subset that
// stays tied, and only then overall GD / goals / alphabetical fallback.
function resolveLevelOnPoints(tied, group, matches) {
  /* v8 ignore next -- unreachable: the sole caller below only calls this when tied.length > 1 */
  if (tied.length === 1) return tied
  // Criteria 2–4: head-to-head sub-table among exactly these teams.
  const sub = headToHead(tied.map((t) => t.name), group, matches)
  const sorted = [...tied].sort(
    (a, b) =>
      sub[b.name].Pts - sub[a.name].Pts ||
      sub[b.name].GD - sub[a.name].GD ||
      sub[b.name].GF - sub[a.name].GF,
  )
  const out = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (
      j < sorted.length &&
      sub[sorted[j].name].Pts === sub[sorted[i].name].Pts &&
      sub[sorted[j].name].GD === sub[sorted[i].name].GD &&
      sub[sorted[j].name].GF === sub[sorted[i].name].GF
    ) j++
    const cluster = sorted.slice(i, j)
    if (cluster.length > 1 && cluster.length < tied.length) {
      // Head-to-head separated some teams; re-apply it to this still-tied subset
      // (a fresh sub-table among only these teams), per the regulations.
      out.push(...resolveLevelOnPoints(cluster, group, matches))
    } else {
      // Still fully tied on head-to-head (no separation possible) — fall through
      // to overall GD, overall goals, conduct score (cards, best-effort), then
      // FIFA World Ranking.
      out.push(
        ...[...cluster].sort(
          (a, b) => b.GD - a.GD || b.GF - a.GF || b.conduct - a.conduct || byFifaRank(a.name, b.name),
        ),
      )
    }
    i = j
  }
  return out
}

export function rankGroup(group, matches) {
  const rows = Object.values(baseStats(group, matches))
  // Criterion 1: points. Then break ties among teams level on points with the
  // 2026 order (head-to-head BEFORE overall goal difference).
  rows.sort((a, b) => b.Pts - a.Pts)

  const ordered = []
  let i = 0
  while (i < rows.length) {
    let j = i + 1
    while (j < rows.length && rows[j].Pts === rows[i].Pts) j++
    const tied = rows.slice(i, j)
    ordered.push(...(tied.length > 1 ? resolveLevelOnPoints(tied, group, matches) : tied))
    i = j
  }
  return ordered.map((r, idx) => ({ ...r, rank: idx + 1 }))
}

export function groupComplete(group, matches) {
  return (
    matches.filter((m) => m.stage === 'Group' && m.group === group && m.score).length >=
    GROUP_MATCH_COUNT
  )
}

// Full tournament qualification picture.
export function computeQualification(matches) {
  const groups = {}
  const completion = {}
  for (const g of GROUPS) {
    groups[g] = rankGroup(g, matches)
    completion[g] = groupComplete(g, matches)
  }

  // Third-placed teams ranked across groups by criteria 1–3, then conduct score
  // (cards), then FIFA ranking (no head-to-head across groups — those teams
  // never met).
  const thirds = GROUPS.map((g) => groups[g][2]).filter(Boolean)
  thirds.sort(
    (a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || b.conduct - a.conduct || byFifaRank(a.name, b.name),
  )

  const allComplete = GROUPS.every((g) => completion[g])
  const best8 = new Set(thirds.slice(0, 8).map((t) => t.name))

  return { groups, completion, thirds, best8, allComplete }
}

// Per-row qualification status for the standings UI.
// 'in'  = advances (1st/2nd, or a confirmed best-3rd once all groups are done)
// 'best3' = currently inside the 8 best third-placed (still provisional)
// 'out' / null otherwise.
export function rowStatus(row, group, qual) {
  if (!qual.completion[group]) return null // group still in progress
  if (row.rank <= 2) return 'in'
  if (row.rank === 3) {
    if (!qual.allComplete) return qual.best8.has(row.name) ? 'best3' : 'out3'
    return qual.best8.has(row.name) ? 'in' : 'out'
  }
  return 'out'
}
