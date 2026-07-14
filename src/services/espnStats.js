// Tournament-level player stats from ESPN's core API — free, keyless, and
// CORS-open (verified: access-control-allow-origin: *). Used to enrich the
// Golden Boot table with the OFFICIAL award tie-breakers, which the score feeds
// don't carry: assists, then fewest minutes played.
//
// Shape: /leaders lists the top goal- and assist-getters as $ref links; each
// athlete's name and season totals (totalGoals, goalAssists, minutes) then come
// from two small per-athlete documents. Results are cached in localStorage for
// CACHE_TTL_MS; passing { force } skips that cache so callers can refresh the
// moment a goal lands. Athlete NAMES are cached permanently (they never
// change), so a forced refresh only re-reads the leaders list and the small
// per-athlete statistics documents. All of it is best-effort: on any failure
// the Boot table just renders without the assists/minutes columns.

const CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/seasons/2026'
export const LEADERS_SOURCE = {
  name: 'ESPN',
  url: `${CORE}/types/1/leaders?lang=en&region=us`,
}

const CACHE_KEY = 'wc2026:bootExtras'
const NAMES_KEY = 'wc2026:athleteNames'
export const CACHE_TTL_MS = 15 * 60 * 1000

// $ref links in the feed are http:// — rewrite to https:// or the browser
// blocks them as mixed content on the deployed (https) site.
const toHttps = (u) => u.replace(/^http:\/\//, 'https://')

async function getJson(url, signal) {
  const res = await fetch(toHttps(url), { signal })
  if (!res.ok) throw new Error(`ESPN stats request failed (HTTP ${res.status})`)
  return res.json()
}

const ATHLETE_ID = /\/athletes\/(\d+)\b/

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (c && Array.isArray(c.extras) && Date.now() - c.at < CACHE_TTL_MS) return c.extras
  } catch {
    /* ignore */
  }
  return null
}

function writeCache(extras) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), extras }))
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

function readNames() {
  try {
    const n = JSON.parse(localStorage.getItem(NAMES_KEY) || 'null')
    if (n && typeof n === 'object') return n
  } catch {
    /* ignore */
  }
  return {}
}

function writeNames(names) {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names))
  } catch {
    /* ignore */
  }
}

// Flatten an athlete-statistics document to { statName: value }.
function flattenStats(doc) {
  const out = {}
  for (const cat of doc.splits?.categories || []) {
    for (const s of cat.stats || []) out[s.name] = s.value
  }
  return out
}

// [{ name, goals, assists, minutes }] for every athlete in ESPN's goals or
// assists leader lists — enough to order any tie the Boot table can show.
// { force: true } bypasses the freshness cache (names stay cached forever).
export async function fetchBootExtras(signal, { force = false } = {}) {
  if (!force) {
    const cached = readCache()
    if (cached) return cached
  }

  const leaders = await getJson(LEADERS_SOURCE.url, signal)
  const cats = new Map((leaders.categories || []).map((c) => [c.name, c.leaders || []]))
  const ids = new Set()
  for (const name of ['goalsLeaders', 'assistsLeaders']) {
    for (const l of cats.get(name) || []) {
      const hit = ATHLETE_ID.exec(l.athlete?.$ref || '')
      if (hit) ids.add(hit[1])
    }
  }

  const names = readNames()
  let namesDirty = false
  const entries = await Promise.all(
    [...ids].map(async (id) => {
      try {
        const [name, stats] = await Promise.all([
          names[id] ||
            getJson(`${CORE}/athletes/${id}?lang=en&region=us`, signal).then((a) => {
              if (a.displayName) {
                names[id] = a.displayName
                namesDirty = true
              }
              return a.displayName
            }),
          getJson(`${CORE}/types/1/athletes/${id}/statistics/0?lang=en&region=us`, signal),
        ])
        if (!name) return null
        const s = flattenStats(stats)
        return {
          name,
          goals: s.totalGoals ?? null,
          assists: s.goalAssists ?? 0,
          minutes: s.minutes ?? null,
        }
      } catch {
        return null // one athlete failing shouldn't sink the rest
      }
    }),
  )
  if (namesDirty) writeNames(names)
  const extras = entries.filter(Boolean)
  if (extras.length) writeCache(extras)
  return extras
}
