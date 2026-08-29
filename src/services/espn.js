// Live(-in-match) layer from ESPN's public scoreboard — free, no API key, and
// CORS-open (Access-Control-Allow-Origin: *), so it works straight from the
// browser like OpenFootball. ESPN gives the *running* score plus a real match
// status and clock ("67'", "HT"), which OpenFootball can't: OpenFootball commits
// results post-match, not minute-by-minute.
//
// Roles (see App.jsx merge order):
//   • OpenFootball (src/services/results.js) = SOURCE OF RECORD. Public-domain,
//     stable, canonical final scores/goals; also resolves knockout team names.
//   • ESPN (here) = LIVE OVERLAY. Fills the gap only while a match is underway,
//     or just finished and OpenFootball hasn't posted yet. The moment
//     OpenFootball has a score, that wins (applyLive defers to it).
//
// We deliberately do NOT use worldcupjson.net as a backup/validator: it has no
// 2026 data (queries return 2022) and serves no CORS header, so a frontend-only
// app can't call it. Scores are cross-checked against OpenFootball and
// TheSportsDB instead — see services/reconcile.js, which flags disagreements via
// each source's *FinalScore getter (espnFinalScore is exported below).

import { normalizeTeam, isRealTeam, pairKey } from './results.js'

export const LIVE_SOURCE = {
  name: 'ESPN',
  url: 'https://site.web.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
  homepage: 'https://www.espn.com/soccer/',
}

// ESPN spellings that differ from ours. (normalizeTeam already handles the
// OpenFootball-style aliases like "Turkey" -> "Türkiye" and
// "Czech Republic" -> "Czechia", so we only add ESPN's own divergences and let
// normalizeTeam finish the job.)
export const ESPN_ALIASES = {
  'United States': 'USA',
  'Korea Republic': 'South Korea',
  'IR Iran': 'Iran',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cabo Verde': 'Cape Verde',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'Congo DR': 'DR Congo',
  Curacao: 'Curaçao',
}

export const normEspn = (name) => normalizeTeam(ESPN_ALIASES[name] || name)
const toNum = (v) => (v == null || v === '' ? null : Number(v))

// Parse ESPN's competitor.score / shootout into our shapes.
// Human label for a one-off ESPN status.type.name (most severe first), or null.
function statusLabelOf(name) {
  if (/SUSPEND/i.test(name)) return 'Suspended'
  if (/DELAY/i.test(name)) return 'Delayed'
  if (/ABANDON/i.test(name)) return 'Abandoned'
  if (/POSTPON/i.test(name)) return 'Postponed'
  if (/CANCEL/i.test(name)) return 'Canceled'
  if (/FORFEIT|AWARD/i.test(name)) return 'Awarded'
  return null
}

function parseEspnScore(home, away, state) {
  if (state === 'pre') return null
  const h = toNum(home.score)
  const a = toNum(away.score)
  if (h == null || a == null) return null
  return [h, a]
}

// Parse an ESPN event clock like "9'" or "45'+3'" -> { minute, extra }. `extra`
// is the stoppage component (the "+3"), preserved so the timeline can show
// "45+3'". NOTE: ESPN exposes elapsed stoppage only, not the announced ("+4")
// added time — there is no such field in the scoreboard feed.
function parseClock(displayValue) {
  const [base, extra] = String(displayValue || '').replace(/'/g, '').split('+')
  const minute = parseInt(base, 10)
  const ex = extra != null ? parseInt(extra, 10) : NaN
  return { minute: Number.isNaN(minute) ? null : minute, extra: Number.isNaN(ex) ? undefined : ex }
}

// Match events from ESPN's competition.details, split by team id into
// { home: [], away: [] } lists for goals, cards, and subs. Skips shootout kicks.
// Goal: { name, minute, extra, penalty, og } (own goals are credited to the
// benefiting team, flagged og). Card: { name, minute, extra, color }.
// Sub: { minute, extra, names } (ESPN's scoreboard feed doesn't reliably mark
// in/out, so we just list the players involved).
function parseEspnEvents(comp, homeId, awayId) {
  const goals = { home: [], away: [] }
  const cards = { home: [], away: [] }
  const subs = { home: [], away: [] }
  for (const ev of comp.details || []) {
    if (ev.shootout) continue
    const tid = String(ev.team?.id)
    const side = tid === String(homeId) ? 'home' : tid === String(awayId) ? 'away' : null
    if (!side) continue
    const { minute, extra } = parseClock(ev.clock?.displayValue)
    const athletes = ev.athletesInvolved || []
    // Full name first: OpenFootball records scorers by full name ("Mikel
    // Oyarzabal"), so ESPN's live goals must use the same spelling or the
    // Golden Boot table splits one player in two ("M. Oyarzabal" got his live
    // penalty, "Mikel Oyarzabal" his earlier goals) and the player popup's
    // name join misses live goals entirely.
    const name = athletes[0]?.displayName || athletes[0]?.shortName || ''
    if (ev.scoringPlay) {
      goals[side].push({ name, minute, extra, penalty: Boolean(ev.penaltyKick), og: Boolean(ev.ownGoal) })
    } else if (ev.redCard || ev.yellowCard) {
      cards[side].push({ name, minute, extra, color: ev.redCard ? 'red' : 'yellow' })
    } else if (/substitution/i.test(ev.type?.text || '')) {
      subs[side].push({ minute, extra, names: athletes.map((a) => a.displayName || a.shortName).filter(Boolean) })
    }
  }
  return { goals, cards, subs }
}

// YYYYMMDD for the day before/of/after `base` (UTC) — a small window that
// absorbs ESPN filing a match under an adjacent date. Used by fetchLive (around
// "now") and by the autofill's espnGoals (around a match's kickoff).
export function scoreboardDates(base = new Date()) {
  const now = base
  const ymd = (off) =>
    new Date(now.getTime() + off * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')
  return [ymd(-1), ymd(0), ymd(1)]
}

// Distinct UTC dates (YYYYMMDD) of matches that have already kicked off but fall
// OUTSIDE the live window (i.e. older than yesterday). ESPN drops finished games
// from the rolling scoreboard after a couple of days, so without this their
// cards/subs would never reach the detail view. The data is static once a match
// ends, so App fetches these once and merges them as a backfill overlay. The live
// window (scoreboardDates) covers everything recent; we exclude it here so the
// poll and the backfill never fight over the same dates.
// ESPN buckets a `dates=YYYYMMDD` query by the US-EASTERN day, not UTC (verified:
// dates=20260728 returns instants up to 07-29T02:00Z). A 9pm-ET kickoff is already
// "tomorrow" in UTC — 33 of the 104 kickoffs cross midnight — so filing by the UTC
// day asked for a slate that didn't contain the match and the backfill missed its
// cards/subs. The live window survives this only because it spans ±1 day.
const EASTERN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const espnDay = (instant) => EASTERN_DAY.format(instant).replace(/-/g, '')

export function historyDates(matches, base = new Date()) {
  const inWindow = new Set(scoreboardDates(base))
  const now = base.getTime()
  const out = new Set()
  for (const m of matches) {
    if (!m.ko) continue
    if (new Date(m.ko).getTime() > now) continue // not yet kicked off
    const d = espnDay(new Date(m.ko))
    if (!inWindow.has(d)) out.add(d)
  }
  return [...out]
}

// ESPN's default scoreboard returns only a single date's slate and can lag a day,
// so a late-night match (filed under a different ESPN date) is missing from it —
// which left such games showing "Live" with no score or clock in the app. Fetch
// the given dates explicitly and merge their events (deduped).
async function scoreboardEvents(signal, dates = scoreboardDates()) {
  if (!dates.length) return []
  const results = await Promise.allSettled(
    dates.map((d) =>
      fetch(`${LIVE_SOURCE.url}?dates=${d}`, { signal, cache: 'no-store' }).then((r) =>
        r.ok ? r.json() : null,
      ),
    ),
  )
  let reached = false
  const seen = new Set()
  const events = []
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue
    reached = true
    for (const ev of r.value.events || []) {
      // Dedup the same match across adjacent date queries by its unique id —
      // NOT by date, which would wrongly merge two simultaneous matches (final
      // group matchday). Without an id we keep the event (worst case a harmless
      // duplicate that resolves to the same team-pair key).
      const id = ev.id ?? ev.uid
      if (id && seen.has(id)) continue
      if (id) seen.add(id)
      events.push(ev)
    }
  }
  if (!reached) throw new Error('Live request failed (all scoreboard dates unreachable)')
  return events
}

// Build a lookup of live records from ESPN's scoreboard. Every record is stored
// twice: by team pair (unique per tournament for played matches; survives
// simultaneous group kickoffs) and by kickoff instant (lets us match knockout
// games whose teams our static schedule still shows as placeholders).
export async function fetchLive(signal, dates) {
  const map = new Map()
  for (const ev of await scoreboardEvents(signal, dates)) {
    const comp = ev.competitions?.[0]
    if (!comp || !Array.isArray(comp.competitors)) continue
    const home = comp.competitors.find((c) => c.homeAway === 'home')
    const away = comp.competitors.find((c) => c.homeAway === 'away')
    if (!home?.team || !away?.team) continue

    const st = ev.status || comp.status || {}
    const state = st.type?.state || 'pre' // 'pre' | 'in' | 'post'
    const events = parseEspnEvents(comp, home.team.id, away.team.id)
    const rec = {
      // ESPN's event id — the handle for the per-match summary endpoint
      // (player stats popups). Carried onto the merged match as `espnId`.
      id: ev.id ?? ev.uid ?? null,
      home: normEspn(home.team.displayName),
      away: normEspn(away.team.displayName),
      state,
      // shortDetail is the running clock during play ("23'", "45'+3'") and the
      // break label at stoppages ("HT", "FT") — exactly what the badge shows.
      clock: st.type?.shortDetail || st.displayClock || '',
      detail: st.type?.description || st.type?.shortDetail || '',
      // One-off statuses from ESPN's status.type.name:
      //   paused  = stopped but resuming (DELAYED/weather, SUSPENDED) — state "in"
      //   voided  = not a real result (ABANDONED/POSTPONED/CANCELED)
      //   awarded = result awarded without a normal finish (FORFEIT/AWARD)
      paused: /DELAY|SUSPEND/i.test(st.type?.name || ''),
      voided: /ABANDON|POSTPON|CANCEL/i.test(st.type?.name || ''),
      awarded: /FORFEIT|AWARD/i.test(st.type?.name || ''),
      statusLabel: statusLabelOf(st.type?.name || ''),
      score: parseEspnScore(home, away, state),
      goals: events.goals,
      cards: events.cards,
      subs: events.subs,
      instant: ev.date ? new Date(ev.date).getTime() : null,
    }
    // Penalty shootout, if ESPN exposes it (knockouts).
    const hp = toNum(home.shootoutScore)
    const ap = toNum(away.shootoutScore)
    if (hp != null && ap != null) rec.pens = [hp, ap]

    map.set(pairKey(rec.home, rec.away), rec)
    if (rec.instant != null) map.set('inst:' + rec.instant, rec)
  }
  return map
}

// Look up the ESPN record for one of our (possibly OpenFootball-merged) matches:
// by team pair when both teams are real, else by kickoff instant.
function liveRecordFor(match, liveMap) {
  if (isRealTeam(match.t1) && isRealTeam(match.t2)) {
    return liveMap.get(pairKey(normalizeTeam(match.t1), normalizeTeam(match.t2))) || null
  }
  const inst = new Date(match.ko).getTime()
  return liveMap.get('inst:' + inst) || null
}

// ESPN flips a match to STATUS_DELAYED at the scheduled hour, but kickoff is
// normally only a few minutes after it. Within this grace window an ESPN
// "Delayed" is treated as pre-match (countdown, no amber badge); a real delay
// outlives the window and shows normally.
const DELAY_GRACE_MS = 5 * 60 * 1000

// Overlay ESPN live / just-finished data onto an already-OpenFootball-merged
// matches array. OpenFootball stays the source of record: if a match already has
// a score (from OpenFootball), it is left untouched. The static input is never
// mutated.
export function applyLive(matches, liveMap, now = Date.now()) {
  if (!liveMap || liveMap.size === 0) return matches
  return matches.map((m) => {
    const rec = liveRecordFor(m, liveMap)
    if (!rec) return m

    // OpenFootball already recorded this match -> its score & goals win (it's the
    // source of record). But OpenFootball's feed carries no cards or subs, so we
    // still overlay ESPN's event timelines (oriented to t1/t2) — otherwise a
    // finished match loses its yellow/red cards in the detail view.
    if (Array.isArray(m.score)) {
      const alignedOf = normalizeTeam(m.t1) === rec.home
      const orientOf = (o) => (alignedOf ? { t1: o.home, t2: o.away } : { t1: o.away, t2: o.home })
      const out = { ...m }
      if (rec.id) out.espnId = rec.id
      for (const key of ['cards', 'subs']) {
        const o = rec[key]
        if (o && (o.home.length || o.away.length)) out[key] = orientOf(o)
      }
      return out
    }

    // One-off statuses that aren't a normal result: mark the match voided so the
    // standings/clinch ignore it and the UI shows a label instead of a fake final
    // or a dead countdown. Abandoned keeps its partial score (for display only).
    if (rec.voided) {
      return { ...m, voided: true, statusLabel: rec.statusLabel, score: rec.score || undefined }
    }

    const bothReal = isRealTeam(m.t1) && isRealTeam(m.t2)

    // An ESPN "Delayed" inside the grace window is premature — the match just
    // hasn't kicked off yet. Fall through to the pre-match branch (suspensions
    // are a real stoppage and are never suppressed).
    const earlyDelay =
      rec.paused && rec.statusLabel === 'Delayed' && now - new Date(m.ko).getTime() < DELAY_GRACE_MS

    // Nothing to show yet (pre-match or no numeric score): only resolve knockout
    // team names if ESPN knows them and we still hold placeholders.
    if (rec.state === 'pre' || earlyDelay || !rec.score) {
      if (!bothReal && isRealTeam(rec.home) && isRealTeam(rec.away)) {
        return { ...m, t1: rec.home, t2: rec.away }
      }
      return m
    }

    const out = { ...m }
    if (rec.id) out.espnId = rec.id
    // Whether ESPN's (home, away) order already matches our (t1, t2). For a
    // knockout placeholder we adopt ESPN's order outright, so it's aligned.
    const aligned = !bothReal || normalizeTeam(m.t1) === rec.home
    if (bothReal) {
      out.score = aligned ? [...rec.score] : [rec.score[1], rec.score[0]]
    } else {
      // Knockout placeholder: adopt ESPN's teams + their (home, away) order.
      if (isRealTeam(rec.home)) out.t1 = rec.home
      if (isRealTeam(rec.away)) out.t2 = rec.away
      out.score = [...rec.score]
    }
    // Orient the event timelines (goals, cards, subs) the same way as the score.
    const orient = (o) => (aligned ? { t1: o.home, t2: o.away } : { t1: o.away, t2: o.home })
    for (const key of ['goals', 'cards', 'subs']) {
      const o = rec[key]
      if (o && (o.home.length || o.away.length)) out[key] = orient(o)
    }
    if (rec.pens) out.pens = [...rec.pens]
    if (rec.state === 'in') out.live = { clock: rec.clock, detail: rec.detail, delayed: rec.paused, label: rec.statusLabel }
    if (rec.awarded) out.awarded = true
    out.liveSource = true
    return out
  })
}

// Final score for one of our matches, oriented by team name, for the score
// reconciler (services/reconcile.js). ESPN only counts once the match is over
// ('post'). Mirrors the getters in results.js / thesportsdb.js.
export function espnFinalScore(match, liveMap) {
  const rec = liveRecordFor(match, liveMap)
  if (!rec || rec.state !== 'post' || !rec.score) return null
  return { home: rec.home, away: rec.away, ft: rec.score }
}
