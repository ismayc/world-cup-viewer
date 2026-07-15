// Per-match player lines from ESPN's summary endpoint (free, keyless,
// CORS-open — same host as the scoreboard). Powers the Golden Boot player
// popup: for one match, each player's assists and (best-effort) minutes.
//
// The rosters carry exact per-match `goalAssists` but NO minutes stat, so
// minutes are derived: starters begin at 0', subs enter at their substitution
// event's minute, players subbed off end there, everyone else runs to the
// match length (120' when the key events show extra time). Red-card early
// exits aren't modelled — the popup labels minutes as approximate.
//
// A finished match's summary never changes, so parsed lines cache in
// localStorage keyed by event id; live matches are always fetched fresh.

import { nameKey } from '../utils/tournamentStats.js'

export const SUMMARY_SOURCE = {
  name: 'ESPN',
  url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary',
}

const CACHE_PREFIX = 'wc2026:matchLines:'

async function getJson(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`ESPN summary request failed (HTTP ${res.status})`)
  return res.json()
}

// Minute of a key event: prefer the running-clock seconds, fall back to the
// display label ("62'", "90'+3'" → 62 / 90).
function eventMinute(ev) {
  const secs = ev.clock?.value
  if (typeof secs === 'number' && secs > 0) return Math.ceil(secs / 60)
  const n = parseInt(ev.clock?.displayValue, 10)
  return Number.isFinite(n) ? n : null
}

function statValue(stats, name) {
  const s = (stats || []).find((x) => x.name === name)
  return s ? s.value : null
}

// Parse one summary document into { length, byName } where byName maps a
// diacritic-insensitive player key to their line for this match.
export function parseSummary(doc) {
  const keyEvents = doc.keyEvents || []
  const extraTime = keyEvents.some((e) => /Extra Time/i.test(e.type?.text || ''))
  const length = extraTime ? 120 : 90

  // Substitution minutes per player (a player can appear in two: on then off).
  const subMinutes = new Map() // nameKey -> [minutes ascending]
  for (const ev of keyEvents) {
    if (!/^Substitution$/i.test(ev.type?.text || '')) continue
    const min = eventMinute(ev)
    if (min == null) continue
    for (const p of ev.participants || []) {
      const name = p.athlete?.displayName
      if (!name) continue
      const k = nameKey(name)
      if (!subMinutes.has(k)) subMinutes.set(k, [])
      subMinutes.get(k).push(min)
    }
  }
  for (const mins of subMinutes.values()) mins.sort((a, b) => a - b)

  const byName = {}
  for (const side of doc.rosters || []) {
    for (const entry of side.roster || []) {
      const name = entry.athlete?.displayName
      if (!name) continue
      const k = nameKey(name)
      const subs = subMinutes.get(k) || []
      const played = Boolean(entry.starter || entry.subbedIn)
      let minutes = 0
      if (played) {
        const start = entry.starter ? 0 : (subs[0] ?? 0)
        const end = entry.subbedOut ? (subs[subs.length - 1] ?? length) : length
        minutes = Math.max(0, end - start)
      }
      byName[k] = {
        name,
        played,
        started: Boolean(entry.starter),
        minutes,
        assists: statValue(entry.stats, 'goalAssists') ?? 0,
      }
    }
  }
  return { length, byName }
}

function readCache(espnId) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_PREFIX + espnId) || 'null')
    if (c && c.byName) return c
  } catch {
    /* ignore */
  }
  return null
}

// Player lines for one match. `final: true` (the match is over) lets the
// parsed result cache forever; a live match always fetches fresh.
export async function fetchMatchLines(espnId, { final = false, signal } = {}) {
  if (!espnId) throw new Error('No ESPN event id for this match')
  if (final) {
    const cached = readCache(espnId)
    if (cached) return cached
  }
  const doc = await getJson(`${SUMMARY_SOURCE.url}?event=${espnId}`, signal)
  const lines = parseSummary(doc)
  if (final && Object.keys(lines.byName).length) {
    try {
      localStorage.setItem(CACHE_PREFIX + espnId, JSON.stringify(lines))
    } catch {
      /* ignore quota */
    }
  }
  return lines
}

// Real-time assist tallies from the matches in play. ESPN credits the assister
// in each roster's per-match `goalAssists` the moment a goal is posted — well
// ahead of the season aggregate (espnStats.fetchBootExtras), which ignores
// in-progress matches entirely until they go final. Summing the two therefore
// never double-counts. Returns [{ name, assists }] across the given live
// matches; best-effort, so one match failing doesn't sink the rest.
export async function fetchLiveAssists(liveMatches, signal) {
  const ids = (liveMatches || []).map((m) => m.espnId).filter(Boolean)
  if (!ids.length) return []
  const counts = new Map() // nameKey -> { name, assists }
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { byName } = await fetchMatchLines(id, { final: false, signal })
        for (const line of Object.values(byName)) {
          if (!line.assists) continue
          const k = nameKey(line.name)
          const e = counts.get(k)
          if (e) e.assists += line.assists
          else counts.set(k, { name: line.name, assists: line.assists })
        }
      } catch {
        /* one match failing shouldn't sink the rest */
      }
    }),
  )
  return [...counts.values()]
}
