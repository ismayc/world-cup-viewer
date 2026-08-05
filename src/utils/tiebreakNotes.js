// Detects when a group placing came down to a "soft" tie-breaker — fair-play
// conduct (cards) or FIFA ranking — i.e. two teams were level through points,
// head-to-head, overall goal difference, AND goals scored, and only criteria
// 7 (conduct) or 8 (FIFA ranking) separated them.
//
// Mirrors the exact clustering in qualification.js's resolveLevelOnPoints: the
// only place conduct/FIFA decide order is the final branch, where a head-to-head
// cluster that couldn't be separated is sorted by overall GD, GF, then conduct,
// then FIFA ranking. Two teams equal on GD and GF in that branch were therefore
// split by conduct or FIFA.

import { byFifaRank } from '../data/fifaRanking.js'
import { rankGroup, headToHead } from './qualification.js'

// Within a head-to-head-irreducible cluster, record adjacent pairs that overall
// GD/GF couldn't separate (so conduct or FIFA ranking decided the order).
function markCluster(tied, group, matches, notes) {
  /* v8 ignore next -- unreachable: softTiebreaks only calls this for a cluster of 2 or more */
  if (tied.length < 2) return
  const sub = headToHead(tied.map((t) => t.name), group, matches)
  const sorted = [...tied].sort(
    (a, b) =>
      sub[b.name].Pts - sub[a.name].Pts ||
      sub[b.name].GD - sub[a.name].GD ||
      sub[b.name].GF - sub[a.name].GF,
  )
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (
      j < sorted.length &&
      sub[sorted[j].name].Pts === sub[sorted[i].name].Pts &&
      sub[sorted[j].name].GD === sub[sorted[i].name].GD &&
      sub[sorted[j].name].GF === sub[sorted[i].name].GF
    )
      j++
    const cluster = sorted.slice(i, j)
    if (cluster.length > 1 && cluster.length < tied.length) {
      markCluster(cluster, group, matches, notes) // head-to-head separated a subset; re-apply
    } else if (cluster.length > 1) {
      // Couldn't separate on head-to-head → overall GD, GF, then conduct, FIFA.
      const ord = [...cluster].sort(
        (a, b) => b.GD - a.GD || b.GF - a.GF || b.conduct - a.conduct || byFifaRank(a.name, b.name),
      )
      for (let k = 0; k + 1 < ord.length; k++) {
        const a = ord[k]
        const b = ord[k + 1]
        if (a.GD === b.GD && a.GF === b.GF) {
          const reason = a.conduct !== b.conduct ? 'conduct' : 'fifa'
          notes.set(a.name, { reason, vs: b.name })
          notes.set(b.name, { reason, vs: a.name })
        }
      }
    }
    i = j
  }
}

// Map of team name -> { reason: 'conduct' | 'fifa', vs: otherTeamName } for any
// team separated from an adjacent team only by conduct (cards) or FIFA ranking.
export function softTiebreaks(group, matches) {
  const rows = rankGroup(group, matches)
  const notes = new Map()
  let i = 0
  while (i < rows.length) {
    let j = i + 1
    while (j < rows.length && rows[j].Pts === rows[i].Pts) j++
    if (j - i > 1) markCluster(rows.slice(i, j), group, matches, notes)
    i = j
  }
  return notes
}

// The cross-group "best third-placed teams" race has no head-to-head (those
// teams never met), so it's ranked by points, GD, goals, then conduct, then FIFA
// ranking. Flag any third separated from an adjacent third only by conduct/FIFA.
// `thirds` is the already-ranked array (qual.thirds).
export function softThirdTiebreaks(thirds) {
  const notes = new Map()
  for (let k = 0; k + 1 < thirds.length; k++) {
    const a = thirds[k]
    const b = thirds[k + 1]
    if (a.Pts === b.Pts && a.GD === b.GD && a.GF === b.GF) {
      const reason = a.conduct !== b.conduct ? 'conduct' : 'fifa'
      notes.set(a.name, { reason, vs: b.name })
      notes.set(b.name, { reason, vs: a.name })
    }
  }
  return notes
}

export const TIEBREAK_LABEL = {
  conduct: 'fair-play points (cards)',
  fifa: 'FIFA ranking',
}
