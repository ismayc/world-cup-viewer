// Independent backup / score-validator from TheSportsDB — free, CORS-open
// (Access-Control-Allow-Origin: *), no personal signup (uses the public test
// key). It carries the 2026 schedule and final scores, so it's a third opinion
// on game scores alongside OpenFootball (record) and ESPN (live).
//
// Free-tier limits: the livescore endpoint is paywalled, so this is FINAL scores
// only — there is no in-match data here. That's fine for its role: a backup
// source of finished results and a cross-check that flags when the sources
// disagree (see services/reconcile.js, scripts/check-feed-freshness.mjs).
//
// Endpoint: eventsday for league 4429 ("FIFA World Cup"), fetched across a small
// date window around "now". (The eventsSEASON endpoint silently freezes after the
// opening days — it stalled at 5 events on 2026-06-13 — whereas the per-day
// endpoint stays current. So we mirror the ESPN adapter: a ±1-day window.)
// strTimestamp is UTC (e.g. "2026-06-11T19:00:00" == our 15:00 ET kickoff), so
// we append "Z" to get the right instant.

import { normalizeTeam, isRealTeam, pairKey } from './results.js'

export const BACKUP_SOURCE = {
  name: 'TheSportsDB',
  url: 'https://www.thesportsdb.com/league/4429-fifa-world-cup',
  homepage: 'https://www.thesportsdb.com/',
}

// Per-day results endpoint for one calendar date (YYYY-MM-DD).
export const sdbDayUrl = (d) => `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${d}&l=4429`

// Calendar dates (YYYY-MM-DD) from `spread` days before `base` to `spread` after
// — the small window we poll, matching ESPN's 3-day scoreboard window.
export function backupDates(base = new Date(), spread = 1) {
  const out = []
  for (let off = -spread; off <= spread; off++) {
    out.push(new Date(base.getTime() + off * 86_400_000).toISOString().slice(0, 10))
  }
  return out
}

// TheSportsDB spellings that differ from ours. (normalizeTeam already maps the
// OpenFootball-style aliases like "Turkey" -> "Türkiye".)
export const SDB_ALIASES = {
  'United States': 'USA',
  'Korea Republic': 'South Korea',
  'IR Iran': 'Iran',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cabo Verde': 'Cape Verde',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina', // TheSportsDB's actual spelling (was missing)
  'DR Congo': 'DR Congo',
  'Congo DR': 'DR Congo',
  Curacao: 'Curaçao',
}

// Statuses that mean the match is over (TheSportsDB uses a few spellings).
const FINISHED = new Set(['FT', 'AET', 'PEN', 'AP', 'Match Finished', 'After Pen.'])

export const normSdb = (name) => normalizeTeam(SDB_ALIASES[name] || name)
const toNum = (v) => (v == null || v === '' ? null : Number(v))

function instantOf(ev) {
  const ts = ev.strTimestamp
    ? ev.strTimestamp + (/[zZ]|[+-]\d\d:?\d\d$/.test(ev.strTimestamp) ? '' : 'Z')
    : ev.dateEvent && ev.strTime
      ? `${ev.dateEvent}T${ev.strTime}Z`
      : null
  const t = ts ? new Date(ts).getTime() : NaN
  return Number.isNaN(t) ? null : t
}

// Fold one day's events into the lookup, keyed by team pair AND kickoff instant
// (same scheme as the ESPN adapter), so it slots into the same matching logic.
function ingestEvents(map, events) {
  for (const ev of events || []) {
    const home = normSdb(ev.strHomeTeam)
    const away = normSdb(ev.strAwayTeam)
    if (!home || !away) continue
    const h = toNum(ev.intHomeScore)
    const a = toNum(ev.intAwayScore)
    const final = FINISHED.has(ev.strStatus) && h != null && a != null
    // Penalty-shootout tally, if TheSportsDB carries it (field availability is
    // inconsistent on the free tier) — used only to cross-check ESPN's shootout.
    const ph = toNum(ev.intHomeScorePenalties)
    const pa = toNum(ev.intAwayScorePenalties)
    const rec = {
      home,
      away,
      final,
      score: h != null && a != null ? [h, a] : null,
      pens: ph != null && pa != null ? [ph, pa] : null,
      instant: instantOf(ev),
    }
    map.set(pairKey(home, away), rec)
    if (rec.instant != null) map.set('inst:' + rec.instant, rec)
  }
  return map
}

// Build the FINAL-score lookup by polling the per-day endpoint across a date
// window. Resilient: a single day's failure is tolerated; we only throw if NO
// day returned data (so a transient blip doesn't wipe the backup source).
export async function fetchBackup(signal, dates = backupDates()) {
  const settled = await Promise.allSettled(
    dates.map((d) =>
      fetch(sdbDayUrl(d), { signal, cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    ),
  )
  const map = new Map()
  let any = false
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue
    any = true
    ingestEvents(map, s.value.events)
  }
  if (!any) throw new Error('Backup request failed (no day in the window returned data)')
  return map
}

// Final score for one of our matches, oriented by team name (home, away) so the
// reconciler can compare it against the other sources. Returns null unless this
// source reports the match as finished. Mirrors the getters in results.js / espn.js.
export function sdbFinalScore(match, backupMap) {
  const rec = sdbRecordFor(match, backupMap)
  if (!rec || !rec.final || !rec.score) return null
  return { home: rec.home, away: rec.away, ft: rec.score }
}

function sdbRecordFor(match, backupMap) {
  if (!backupMap) return null
  return (
    (isRealTeam(match.t1) && isRealTeam(match.t2)
      ? backupMap.get(pairKey(normalizeTeam(match.t1), normalizeTeam(match.t2)))
      : backupMap.get('inst:' + new Date(match.ko).getTime())) || null
  )
}

// Penalty-shootout tally as a report (ft = [homePens, awayPens]) so it orients
// the same way as the score getters. Null unless TheSportsDB carries it — the
// autofill uses it to cross-check ESPN's shootout, falling back to ESPN alone.
export function sdbFinalPens(match, backupMap) {
  const rec = sdbRecordFor(match, backupMap)
  if (!rec || !rec.final || !rec.pens) return null
  return { home: rec.home, away: rec.away, ft: rec.pens }
}
