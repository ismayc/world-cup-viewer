// Sync-readiness drift check: validates our static schedule against the LIVE
// upstream cup.txt / cup_finals.txt, so a name/structure change there is caught
// BEFORE it silently breaks an autofill sync (the way "Türkiye" vs cup.txt
// "Turkey" did). The unit test (test/sync-coverage.test.js) guards against a
// frozen snapshot; this guards against upstream drift. Reuses the same cupName
// aliases the writer uses.
//
// Group matches (cup.txt): keyed by team pair — checked always.
// Knockout matches (cup_finals.txt, "(NN)" prefixed lines): the match NUMBERS are
// stable from the start, so we always verify every (NN) line exists (catches an
// upstream restructure of the finals file). Their TEAMS are placeholders until a
// tie resolves; once OpenFootball resolves a tie's teams we ALSO verify that
// pairing is locatable under cupName — the exact lookup the autofill will do.
//
// Exit 0 when coverage holds, 1 when a group match or a knockout (NN) line is
// missing, or a RESOLVED knockout pairing can't be located (a real alias/upstream
// problem). A resolved tie whose names upstream hasn't filled in yet is reported
// as info, not a failure (that's upstream's pending edit, not ours).
//
// Run:  node scripts/check-sync-readiness.mjs   (alias: npm run check:sync)

import { MATCHES } from '../src/data/matches.js'
import { cupName } from './cuptxt.mjs'
import { fetchResults, applyResults, isRealTeam } from '../src/services/results.js'

const BASE = 'https://raw.githubusercontent.com/openfootball/worldcup/master/2026--usa'
const CUP_URL = `${BASE}/cup.txt`
const FINALS_URL = `${BASE}/cup_finals.txt`

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const word = (n) => new RegExp(`(^|[ \\t])${esc(n)}([ \\t]|$)`)

// A match line: optional "(NN)" prefix, then "HH:MM UTC…". Works for both files.
const isMatchLine = (l) => /^[ \t]*(?:\(\d+\)[ \t]+)?\d{1,2}:\d{2}[ \t]+UTC/.test(l)

function locatable(lines, a, b) {
  return lines.some((l) => isMatchLine(l) && word(a).test(l) && word(b).test(l))
}

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// Knockout coverage against cup_finals.txt. Returns true if everything checks
// out, false if a structural ("(NN)" line missing) or resolved-pairing problem
// was found (so the caller exits non-zero). Best-effort on the network: an
// unreachable finals file / results feed is reported and treated as non-fatal.
async function checkKnockouts() {
  let finalsLines
  try {
    finalsLines = (await fetchText(FINALS_URL)).split(/\r?\n/)
  } catch (err) {
    console.log(`\nKnockouts — could not fetch cup_finals.txt (${err.message}); skipping.`)
    return true
  }
  const knockouts = MATCHES.filter((m) => m.stage !== 'Group')
  const numbered = new Set(
    finalsLines
      .filter((l) => /^[ \t]*\(\d+\)[ \t]+\d{1,2}:\d{2}[ \t]+UTC/.test(l))
      .map((l) => Number(l.match(/\((\d+)\)/)[1])),
  )
  const missingNums = knockouts.filter((m) => !numbered.has(m.num))

  // Resolve ties via OpenFootball so we can verify the real pairings the autofill
  // will look up. No results feed → resolved set is empty (only the number check
  // runs), which is fine pre-knockouts.
  let resolved = []
  try {
    const ofMap = await fetchResults()
    resolved = applyResults(MATCHES, ofMap).filter(
      (m) => m.stage !== 'Group' && isRealTeam(m.t1) && isRealTeam(m.t2),
    )
  } catch {
    /* best-effort — no resolved ties just means we only run the number check */
  }
  const locatableTies = []
  const pending = []
  for (const m of resolved) {
    if (locatable(finalsLines, cupName(m.t1), cupName(m.t2))) locatableTies.push(m)
    else pending.push(m)
  }

  console.log('\nSync readiness — cup_finals.txt knockout coverage')
  console.log(`  ${knockouts.length - missingNums.length}/${knockouts.length} knockout (NN) lines present`)
  console.log(`  ${locatableTies.length}/${resolved.length} resolved tie(s) locatable under our names`)

  if (missingNums.length) {
    console.log('\n⚠ DRIFT — these knockout match numbers have no "(NN)" line in cup_finals.txt:')
    console.log(`  ${missingNums.map((m) => `#${m.num}`).join(', ')}`)
  }
  // A resolved pairing that we can't find could be an alias problem (ours) — but
  // upstream often hasn't filled the bracket names yet, which is THEIR pending
  // edit. Distinguish: if BOTH teams appear individually somewhere in the file,
  // the pairing should be findable, so a miss is a real (alias/orientation)
  // problem; if a team is entirely absent, upstream simply hasn't resolved it.
  const fullText = finalsLines.join('\n')
  const aliasMisses = pending.filter(
    (m) => word(cupName(m.t1)).test(fullText) && word(cupName(m.t2)).test(fullText),
  )
  const upstreamPending = pending.filter((m) => !aliasMisses.includes(m))
  if (upstreamPending.length) {
    console.log('\n  (info) resolved ties not yet named in cup_finals.txt (upstream pending):')
    for (const m of upstreamPending) console.log(`    · #${m.num} ${m.t1} v ${m.t2}`)
  }
  if (aliasMisses.length) {
    console.log('\n⚠ DRIFT — these resolved ties have both teams in cup_finals.txt but the pairing')
    console.log('  is not locatable under our (aliased) names — check cupName / orientation:')
    for (const m of aliasMisses) {
      console.log(`  ✖ #${m.num} ${m.t1} v ${m.t2}   →   "${cupName(m.t1)}" / "${cupName(m.t2)}"`)
    }
  }

  const ok = !missingNums.length && !aliasMisses.length
  if (ok) console.log('  Knockout coverage holds. ✓')
  return ok
}

async function main() {
  let cup
  try {
    cup = await fetchText(CUP_URL)
  } catch (err) {
    console.error(`✖ Could not fetch upstream cup.txt: ${err.message}\n  ${CUP_URL}`)
    process.exit(2)
  }
  const lines = cup.split(/\r?\n/)
  const group = MATCHES.filter((m) => m.stage === 'Group')
  const missing = group.filter((m) => !locatable(lines, cupName(m.t1), cupName(m.t2)))

  console.log('Sync readiness — cup.txt name/line coverage')
  console.log(`  ${group.length - missing.length}/${group.length} group matches locatable in upstream cup.txt`)

  if (missing.length) {
    console.log('\n⚠ DRIFT — these group matches can NOT be located in cup.txt under our names,')
    console.log('  so the autofill would silently skip them. Add/adjust a cupName alias in')
    console.log('  scripts/cuptxt.mjs (our spelling → cup.txt spelling):\n')
    for (const m of missing) {
      console.log(`  ✖ ${m.t1} v ${m.t2}   →   looked for "${cupName(m.t1)}" / "${cupName(m.t2)}"`)
    }
    console.log()
  } else {
    console.log('  All group matches are locatable. ✓')
  }

  const knockoutsOk = await checkKnockouts()
  console.log()
  if (missing.length || !knockoutsOk) process.exit(1)
}

main()
