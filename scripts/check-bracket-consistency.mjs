// Bracket-consistency guard: once OpenFootball resolves a knockout fixture's real
// teams (it fills "Winner Group A" / "3rd …" placeholders from the official FIFA
// draw and results, INDEPENDENT of our Annexe C + tie-breaker code), assert OUR
// resolveBracket produces the same matchup. So if our third-place ranking, Annexe
// C combination, or knockout propagation ever disagrees with the real draw, this
// fails (→ the feed-freshness workflow emails the maintainer).
//
// Self-gating by design: it compares only the knockout sides OpenFootball has
// already resolved to real teams, so it does nothing before the draw and lights
// up exactly as matches finish — the natural "end of match" trigger.
//
// Run:  node scripts/check-bracket-consistency.mjs   (alias: npm run check:bracket)

import { MATCHES } from '../src/data/matches.js'
import { fetchResults, applyResults, isRealTeam } from '../src/services/results.js'
import { computeClinch } from '../src/utils/clinch.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'

const pair = (a, b) => [a, b].sort().join(' v ')

const map = await fetchResults().catch((e) => {
  // A transient feed outage shouldn't fail the guard (check:feed owns freshness).
  console.log(`⚠ OpenFootball unreachable (${e.message}); skipping bracket check this run.`)
  return null
})
if (!map) process.exit(0)

// OpenFootball's own resolution: applyResults adopts the feed's real knockout team
// names where it has them.
const feed = applyResults(MATCHES, map)

// Our resolution from the SAME group results but starting from the static knockout
// placeholders (so it's our Annexe C / propagation doing the work, not the feed's).
const staticByNum = new Map(MATCHES.map((m) => [m.num, m]))
const groupOnly = feed.map((m) => {
  if (m.stage === 'Group') return m
  const s = staticByNum.get(m.num)
  return { ...m, t1: s.t1, t2: s.t2 } // reset to "Winner Group X" / "3rd …" labels, keep any KO score
})
const ours = resolveBracket(groupOnly, computeClinch(groupOnly))
const oursByNum = new Map(ours.map((m) => [m.num, m]))

let compared = 0
const divergences = []
for (const fm of feed) {
  if (fm.stage === 'Group') continue
  // Only check sides OpenFootball has resolved to real teams.
  if (!isRealTeam(fm.t1) || !isRealTeam(fm.t2)) continue
  const om = oursByNum.get(fm.num)
  if (!om) continue
  // If we haven't resolved it yet (still a placeholder), that's a "behind", not a
  // divergence — skip (we resolve conservatively; the feed may know more).
  if (!isRealTeam(om.t1) || !isRealTeam(om.t2)) continue
  compared++
  if (pair(fm.t1, fm.t2) !== pair(om.t1, om.t2)) {
    divergences.push(
      `Match ${fm.num} (${fm.stage}): feed = ${fm.t1} v ${fm.t2}; ours = ${om.t1} v ${om.t2}`,
    )
  }
}

if (divergences.length) {
  console.error(`✗ Bracket consistency: ${divergences.length} divergence(s) vs OpenFootball:`)
  for (const d of divergences) console.error('  ' + d)
  console.error('Our resolveBracket disagrees with the official resolved draw — investigate.')
  process.exit(1)
}

console.log(
  `Bracket consistency: ${compared} resolved knockout matchup(s) checked vs OpenFootball | 0 divergence(s)`,
)
process.exit(0)
