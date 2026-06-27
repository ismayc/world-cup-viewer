// Renders the R32 Outlook goal-difference enumeration to a self-contained HTML
// file (no live data / no browser build needed) so the results can be reviewed
// offline. Uses the SAME production utils the app's worker uses.
//
//   node scripts/outlook-snapshot.mjs            -> writes outlook-snapshot.html
//
// Pulls the live OpenFootball source-of-record and overlays final group scores
// onto our fixtures, so the percentages reflect the real current standings.

import { writeFileSync } from 'node:fs'
import { MATCHES } from '../src/data/matches.js'
import { FLAG_BY_TEAM } from '../src/data/teams.js'
import { enumerateOutlook, R32_SLOT_LABELS } from '../src/utils/outlookEnum.js'
import { survivingTeams, allAdvancementRequirements } from '../src/utils/eliminationCheck.js'

// Pull the LIVE source-of-record (OpenFootball) and overlay final group scores
// onto our fixtures, so the snapshot reflects the real current standings.
const OF_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
const NAME = { Turkey: 'Türkiye', 'Czech Republic': 'Czechia' } // OpenFootball → our spelling
const norm = (n) => NAME[n] || n

const ofData = await (await fetch(OF_URL)).json()
const ofMap = new Map()
for (const m of ofData.matches) {
  if (!String(m.group || '').startsWith('Group') || !m.score?.ft) continue
  const g = m.group.replace('Group ', '').trim()
  ofMap.set(`${g}|${[norm(m.team1), norm(m.team2)].sort().join('~')}`, { t1: norm(m.team1), ft: m.score.ft })
}
let applied = 0
const matches = MATCHES.map((m) => {
  if (m.stage !== 'Group') return m
  const of = ofMap.get(`${m.group}|${[m.t1, m.t2].sort().join('~')}`)
  if (!of) return m // still to play
  applied++
  const score = of.t1 === m.t1 ? of.ft : [of.ft[1], of.ft[0]] // orient to our t1/t2
  return { ...m, score }
})
console.log(`OpenFootball: applied ${applied}/72 group results (${ofMap.size} finals in feed)`)

const result = enumerateOutlook(matches)
const survivors = survivingTeams(matches)
const requirements = allAdvancementRequirements(matches, survivors)

const nums = Object.keys(R32_SLOT_LABELS).map(Number).sort((a, b) => a - b)

// Teams the exact check says are alive but that don't appear in the enumeration
// (need a swing beyond ±cap).
const shownEverywhere = new Set()
for (const n of nums) for (const side of result.perMatch[n]) {
  if (side.locked) shownEverywhere.add(side.locked)
  for (const c of side.candidates) shownEverywhere.add(c.team)
}
const hiddenAlive = survivors.filter((t) => !shownEverywhere.has(t))

// --- render -----------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const flag = (t) => FLAG_BY_TEAM[t] || '•'
const fmt = (p) => (p >= 0.995 ? '>99' : p < 0.005 ? '<1' : Math.round(p * 100))
const fmtGD = (v) => (v > 0 ? `+${v}` : `${v}`)

function sideHtml(side, label) {
  if (side.locked) {
    return `<div class="side locked"><span class="flag">${flag(side.locked)}</span><span class="team">${esc(side.locked)}</span><span class="ok">✅</span></div>`
  }
  const cands = side.candidates
    .map((c) => `<li><span class="bar" style="width:${Math.max(3, c.pct * 100).toFixed(1)}%"></span><span class="flag">${flag(c.team)}</span><span class="cn">${esc(c.team)}</span><span class="pct">${fmt(c.pct)}%</span></li>`)
    .join('')
  if (!cands) return `<div class="side"><div class="sl">${esc(label)}</div><div class="tbd">To be determined</div></div>`
  return `<div class="side"><div class="sl">${esc(label)}</div><ul class="cands">${cands}</ul></div>`
}

const matchesHtml = nums
  .map((n) => {
    const [s1, s2] = result.perMatch[n]
    const labels = R32_SLOT_LABELS[n]
    return `<div class="match"><div class="mh">Match ${n}</div>${sideHtml(s1, labels[0])}<div class="vs">vs</div>${sideHtml(s2, labels[1])}</div>`
  })
  .join('')

function reqHtml(team) {
  const req = requirements[team]
  if (!req) return ''
  if (req.ownGroupComplete && req.variable?.length) {
    const p = req.profile
    const thr = `under ${p.Pts} pt${p.Pts === 1 ? '' : 's'}, or ${p.Pts} with GD below ${fmtGD(p.GD)}`
    const items = req.variable.map((v) => `<li>Group ${v.group} <span class="cont">(${esc(v.contenders.join(' / '))})</span></li>`).join('')
    return `<div class="req"><div class="rh">Needs <b>${req.needAtLeast} of ${req.variable.length}</b> rival third${req.variable.length === 1 ? '' : 's'} to finish below them <span class="thr">(${thr})</span>:</div><ul class="rl">${items}</ul></div>`
  }
  if (!req.ownGroupComplete) {
    const unresolved = req.unresolvedGroups.length ? ` Groups still unresolved that can shift the cut: <span class="cont">${req.unresolvedGroups.join(', ')}</span>.` : ''
    return `<div class="req"><div class="rh">Must finish <b>3rd in Group ${req.ownGroup}</b>, then — as a ${req.thirdPts}-point third — win the goal-difference race with the other ${req.thirdPts}-point thirds for the last spot(s); the bigger the win, the better.${unresolved}</div></div>`
  }
  return ''
}

const hiddenHtml = hiddenAlive.length
  ? `<ul class="alist">${hiddenAlive
      .map((t) => `<li><div class="arow"><span class="flag">${flag(t)}</span><b>${esc(t)}</b></div>${reqHtml(t)}</li>`)
      .join('')}</ul>`
  : ''

const panel = hiddenHtml
  ? `<div class="panel"><div class="ph">Still mathematically alive — beyond the enumerated margins</div><p class="pn">The percentages enumerate goal differences up to <b>±${result.cap}</b> per game. These teams can still reach the Round of 32 only via a bigger swing than that — so they don't appear above — and are NOT eliminated.</p>${hiddenHtml}</div>`
  : ''

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>R32 Outlook — goal-difference enumeration (preview)</title>
<style>
:root{--bg:#0f1420;--card:#1c2435;--soft:#171e2e;--bd:#2a3548;--tx:#e8edf6;--dim:#97a3b8;--faint:#6b7689;--ac:#00c2a8;--delay:#f5a623}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 Inter,system-ui,Arial,sans-serif;padding:22px}
.wrap{max-width:1040px;margin:0 auto}
h1{font-size:1.5rem;margin:0 0 4px}
.caveat{background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.35);border-radius:10px;padding:10px 12px;font-size:.85rem;color:var(--dim);margin:10px 0 16px}
.intro{font-size:.88rem;color:var(--dim);margin:0 0 6px}
.count{font-size:.9rem;font-weight:600}.count b{color:var(--ac)}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));margin-top:14px}
.match{background:var(--soft);border:1px solid var(--bd);border-radius:14px;padding:12px 14px}
.mh{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ac);margin-bottom:8px}
.vs{text-align:center;font-size:.72rem;font-style:italic;color:var(--faint);margin:6px 0}
.side.locked{display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(0,194,168,.08);border-radius:8px}
.team{font-weight:700}.ok{margin-left:auto}
.sl{font-size:.66rem;color:var(--faint);font-weight:600;margin-bottom:4px}
.cands{list-style:none;margin:0;padding:0;display:grid;gap:3px}
.cands li{position:relative;display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:6px;overflow:hidden;font-size:.82rem}
.bar{position:absolute;left:0;top:0;bottom:0;background:rgba(0,194,168,.16);z-index:0}
.flag,.cn,.pct{position:relative;z-index:1}.cn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pct{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:700;color:var(--dim)}
.pct.alive{color:var(--delay);text-decoration:underline dotted}
.ext .cn{font-style:italic}.tbd{color:var(--faint);font-style:italic;padding:3px 6px}
.panel{margin-top:18px;padding:12px 14px;background:rgba(255,176,32,.07);border:1px solid rgba(255,176,32,.35);border-radius:14px}
.ph{font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#d99100;margin-bottom:6px}
.pn{font-size:.82rem;color:var(--dim);margin:0 0 8px}
.sub{font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#d99100;margin:12px 0 2px}
.subnote{font-size:.78rem;color:var(--dim);margin:0 0 8px}
.alist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.arow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.dest{color:var(--dim);font-size:.8rem}
.req{margin:4px 0 0 22px;font-size:.8rem}.rh{margin-bottom:3px}.rh b{color:var(--ac)}.thr{color:var(--dim)}
.rl{list-style:disc;margin:0;padding-left:18px;color:var(--dim);display:flex;flex-direction:column;gap:2px}
.cont{color:var(--faint)}
</style></head><body><div class="wrap">
<h1>🔮 R32 Outlook — goal-difference enumeration</h1>
<div class="caveat"><b>Live data</b> — group results overlaid from OpenFootball (source of record), the same feed the app reads. ${result.remaining} group games still to play. Every percentage is the exact goal-difference enumeration for the current standings.</div>
<p class="intro">For each open Round-of-32 spot, the share of remaining outcomes that put each team there — walking every still-possible group result and enumerating each remaining game's goal difference (each margin weighted equally). Not a forecast.</p>
<p class="count"><b>${result.remaining}</b> group games left · <b>${result.total.toLocaleString()}</b> scorelines enumerated · margins to ±${result.cap}</p>
<div class="grid">${matchesHtml}</div>
${panel}
</div></body></html>`

writeFileSync(new URL('../outlook-snapshot.html', import.meta.url), html)
console.log(`Wrote outlook-snapshot.html — ${result.remaining} games left, cap ±${result.cap}, ${result.total.toLocaleString()} scorelines`)
console.log(`hidden-alive: ${hiddenAlive.join(', ') || '(none)'}`)
