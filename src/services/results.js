// Live(-ish) results from OpenFootball — free, public-domain JSON on GitHub,
// no API key and CORS-friendly, so it works straight from the browser.
// Updated by commits during the tournament (typically same-day / post-match)
// rather than minute-by-minute, which suits a frontend-only app.
//
// Matching strategy (OpenFootball match -> our static schedule):
//   • Round of 32..Semifinal carry the official FIFA `num` (73–102) -> key by num.
//   • Third-place & Final have no num -> key by round name.
//   • Group matches have no num -> key by the (order-independent) team pair.
// As knockout teams resolve, OpenFootball replaces "2A"/"W73" placeholders with
// real team names, so we also use the feed to fill in the bracket.

import { FLAG_BY_TEAM } from '../data/teams.js'

export const RESULTS_SOURCE = {
  name: 'OpenFootball',
  url: 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
  homepage: 'https://github.com/openfootball/worldcup.json',
}

// OpenFootball spellings that differ from ours, mapped to our canonical names.
const ALIASES = {
  'Czech Republic': 'Czechia',
  Turkey: 'Türkiye',
}

export function normalizeTeam(name) {
  if (!name) return name
  return ALIASES[name] || name
}

// A "real" team is one of the 48 qualified sides (not a placeholder like "2A").
export function isRealTeam(name) {
  return Boolean(FLAG_BY_TEAM[normalizeTeam(name)])
}

export function pairKey(a, b) {
  return 'pair:' + [a, b].sort().join('|')
}

// Key for an OpenFootball match record.
function apiKey(m) {
  const round = m.round || ''
  if (round.startsWith('Matchday')) return pairKey(normalizeTeam(m.team1), normalizeTeam(m.team2))
  if (round === 'Match for third place') return 'stage:3rd'
  if (round === 'Final') return 'stage:Final'
  if (m.num != null) return 'num:' + m.num
  return null
}

// Matching key for one of our schedule matches.
export function matchKey(match) {
  if (match.stage === 'Group') return pairKey(normalizeTeam(match.t1), normalizeTeam(match.t2))
  if (match.stage === '3rd') return 'stage:3rd'
  if (match.stage === 'Final') return 'stage:Final'
  return 'num:' + match.num
}

// Final score for one of our matches, oriented by team name, for the score
// reconciler. OpenFootball only ever holds recorded (final) scores, so a present
// score is authoritative. Mirrors the getters in espn.js / thesportsdb.js.
export function openFootballFinalScore(match, ofMap) {
  if (!ofMap) return null
  const rec = ofMap.get(matchKey(match))
  if (!rec?.score?.ft) return null
  // The decisive score (extra time when a knockout went to ET), matching what
  // the live sources report — so cross-source comparison doesn't false-flag.
  return { home: rec.home, away: rec.away, ft: rec.score.et || rec.score.ft }
}

// OpenFootball score shape: { ft: [home, away], ht: [...], et: [...], p: [...] }.
function parseScore(score) {
  if (!score) return null
  const ft = Array.isArray(score.ft) ? score.ft : Array.isArray(score) ? score : null
  if (!ft || ft.length < 2 || ft[0] == null || ft[1] == null) return null
  const out = { ft: [Number(ft[0]), Number(ft[1])] }
  if (Array.isArray(score.p) && score.p[0] != null) out.pens = [Number(score.p[0]), Number(score.p[1])]
  // Extra time: `et` is the score AFTER extra time (cumulative). It's the decisive
  // result for a knockout won in ET, so keep it — `ft` alone would be level and
  // leave the winner unresolved.
  if (Array.isArray(score.et) && score.et[0] != null) {
    out.et = [Number(score.et[0]), Number(score.et[1])]
    out.aet = true
  }
  return out
}

// OpenFootball goal shape: { name, minute, score, penalty, owngoal }.
function parseGoals(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map((g) => ({
    name: g.name || g.player || '',
    minute: g.minute ?? g.offset ?? null,
    penalty: Boolean(g.penalty),
    og: Boolean(g.owngoal),
  }))
}

export async function fetchResults(signal) {
  const res = await fetch(RESULTS_SOURCE.url, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`Results request failed (HTTP ${res.status})`)
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('Results response was not valid JSON')
  }
  // Guard against a 200 that isn't the feed we expect (e.g. an HTML error page
  // that happens to parse) — better to surface an error than silently show none.
  if (!Array.isArray(data.matches)) throw new Error('Results feed is missing a matches[] array')
  const map = new Map()
  for (const m of data.matches) {
    const key = apiKey(m)
    if (!key) continue
    map.set(key, {
      home: normalizeTeam(m.team1),
      away: normalizeTeam(m.team2),
      score: parseScore(m.score),
      g1: parseGoals(m.goals1),
      g2: parseGoals(m.goals2),
    })
  }
  return map
}

// Return a new matches array with API scores merged in and knockout placeholders
// resolved to real teams where known. The static schedule is never mutated.
export function applyResults(matches, map) {
  if (!map || map.size === 0) return matches
  return matches.map((m) => {
    const rec = map.get(matchKey(m))
    if (!rec) return m

    if (m.stage === 'Group') {
      if (!rec.score) return m
      // Orient the score (and goals) to our (t1, t2) ordering. Guard: if the
      // record's home matches NEITHER of our teams (a normalization gap), don't
      // assume it's the away team and write a REVERSED score — skip it.
      const nt1 = normalizeTeam(m.t1)
      const nt2 = normalizeTeam(m.t2)
      if (rec.home !== nt1 && rec.home !== nt2) return m
      const aligned = rec.home === nt1
      const ft = aligned ? rec.score.ft : [rec.score.ft[1], rec.score.ft[0]]
      const out = { ...m, score: ft, goals: aligned ? { t1: rec.g1, t2: rec.g2 } : { t1: rec.g2, t2: rec.g1 } }
      return out
    }

    // Knockout: adopt real team names in the API's (home, away) order so the
    // bracket fills in; the score, pens, and goals follow the same orientation.
    const out = { ...m }
    if (isRealTeam(rec.home)) out.t1 = rec.home
    if (isRealTeam(rec.away)) out.t2 = rec.away
    if (rec.score) {
      // Prefer the extra-time score when present — for a knockout decided in ET
      // (no shootout) the 90-minute `ft` is level and would leave the tie (and the
      // whole downstream bracket) unresolved.
      out.score = rec.score.et || rec.score.ft
      if (rec.score.pens) out.pens = rec.score.pens
      if (rec.score.aet) out.aet = true
      out.goals = { t1: rec.g1, t2: rec.g2 }
    }
    return out
  })
}
