// Validate our stored kickoff times against independent feeds, anchored to an
// AUTHORITATIVE source (FIFA's own data). The point: never need a human to
// adjudicate, and don't trust the secondary feeds on their own.
//
//   • If the authority (FIFA) disagrees with our stored time → that's the
//     answer: report it as a drift, with how many secondary feeds corroborate.
//   • If the authority agrees with us but a feed doesn't → that's a feed glitch,
//     surfaced as a low-priority note (our time is confirmed correct).
//   • If the authority has no time for a match → fall back to requiring TWO
//     secondary feeds to agree before calling it a drift.
//
// Group matches are keyed by team pair (the caller builds each source's map with
// that source's own spelling normalised to our canonical names).

import { normalizeTeam, pairKey } from '../src/services/results.js'

const keyOf = (t1, t2) => pairKey(normalizeTeam(t1), normalizeTeam(t2))

// Normalise a stadium name so "MetLife Stadium", "New York/New Jersey Stadium"
// and the like compare on their essential words: lowercase, drop the generic
// "stadium"/"field"/"place" tokens, and strip punctuation/whitespace.
export function normVenue(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(stadium|field|place|estadio|arena)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
}

// Decide which of our venue keys a FIFA stadium refers to. FIFA uses generic,
// sponsor-free names ("Los Angeles Stadium" for SoFi), so we lean on an explicit
// alias map keyed by FIFA's stable IdStadium first, then a name fallback.
//   fifaVenue: { id, name, city } from FIFA's Stadium object.
//   venues: our VENUES object (key -> { name, city }).
//   aliasById: { [IdStadium]: ourVenueKey }.
// Returns our venue key, or null if it can't be resolved.
export function resolveFifaVenue(fifaVenue, venues, aliasById = {}) {
  if (!fifaVenue) return null
  if (fifaVenue.id != null && aliasById[fifaVenue.id]) return aliasById[fifaVenue.id]
  const fn = normVenue(fifaVenue.name)
  const fc = normVenue(fifaVenue.city)
  for (const [key, v] of Object.entries(venues)) {
    if (fn && normVenue(v.name) === fn) return key
    if (fc && normVenue(v.city) === fc) return key
  }
  return null
}

function clusterByTime(items, thrMs) {
  const sorted = [...items].sort((a, b) => a.ms - b.ms)
  const clusters = []
  for (const it of sorted) {
    const last = clusters.at(-1)
    if (last && Math.abs(it.ms - last[0].ms) < thrMs) last.push(it)
    else clusters.push([it])
  }
  return clusters
}

// matches: rows to validate. sources: [{ name, byKey: Map(pairKey -> kickoff ms) }].
// authority: the name of the source treated as the source of truth (e.g. 'FIFA').
// Venue cross-check (report only — never auto-fixed, unlike time):
//   venueByKey — Map(pairKey -> FIFA's { id, name, city }) for the match.
//   venues     — our VENUES object (key -> { name, city }).
//   venueAliasById — { [FIFA IdStadium]: ourVenueKey }.
// Returns { drifts, notes, unmatched, venueMismatches }:
//   drifts  — our stored time is wrong: { num, t1, t2, storedISO, authISO, diffMin,
//             via ('authority'|'consensus'), corroborators:[names] }
//   notes   — non-actionable observations: a feed disagreeing while the authority
//             confirms us, or the authority missing for a match.
//   unmatched — no source had the match at all.
//   venueMismatches — FIFA's stadium clearly differs from ours:
//             { num, t1, t2, ourVenue (key), ourName, ourCity, fifaName, fifaCity }.
export function compareSchedule(
  matches,
  sources,
  { thresholdMin = 5, fromMs = -Infinity, authority = 'FIFA', venueByKey = null, venues = null, venueAliasById = {} } = {},
) {
  const thr = thresholdMin * 60000
  const drifts = []
  const notes = []
  const unmatched = []
  const venueMismatches = []

  for (const m of matches) {
    const stored = new Date(m.ko).getTime()
    if (stored < fromMs) continue
    const key = keyOf(m.t1, m.t2)

    // Venue cross-check (report only). Compare FIFA's stadium for this pair to
    // our stored venue; flag only when they resolve to different venues.
    if (venueByKey && venues) {
      const fifaVenue = venueByKey.get(key)
      const ours = venues[m.venue]
      if (fifaVenue && ours) {
        const fifaKey = resolveFifaVenue(fifaVenue, venues, venueAliasById)
        // Mismatch when FIFA resolves to a different venue, or can't be matched
        // to ours at all while clearly naming a different stadium.
        const differs = fifaKey ? fifaKey !== m.venue : normVenue(fifaVenue.name) !== normVenue(ours.name)
        if (differs) {
          venueMismatches.push({
            num: m.num,
            t1: m.t1,
            t2: m.t2,
            ourVenue: m.venue,
            ourName: ours.name,
            ourCity: ours.city,
            fifaName: fifaVenue.name,
            fifaCity: fifaVenue.city,
          })
        }
      }
    }

    const reported = sources
      .map((s) => ({ name: s.name, ms: s.byKey.get(key) }))
      .filter((r) => r.ms != null)
    if (!reported.length) {
      unmatched.push({ num: m.num, t1: m.t1, t2: m.t2 })
      continue
    }
    const base = { num: m.num, t1: m.t1, t2: m.t2, storedISO: new Date(stored).toISOString() }
    const auth = reported.find((r) => r.name === authority)
    const others = reported.filter((r) => r.name !== authority)

    if (auth) {
      if (Math.abs(auth.ms - stored) >= thr) {
        // Authoritative change — this is the answer; note which feeds back it up.
        drifts.push({
          ...base,
          authISO: new Date(auth.ms).toISOString(),
          diffMin: Math.round((auth.ms - stored) / 60000),
          via: 'authority',
          corroborators: others.filter((r) => Math.abs(r.ms - auth.ms) < thr).map((r) => r.name),
        })
      } else {
        // Authority confirms our time; any feed that disagrees is a feed glitch.
        for (const r of others.filter((r) => Math.abs(r.ms - stored) >= thr)) {
          notes.push({
            ...base,
            kind: 'feed-discrepancy',
            source: r.name,
            theirISO: new Date(r.ms).toISOString(),
            diffMin: Math.round((r.ms - stored) / 60000),
          })
        }
      }
      continue
    }

    // Authority absent for this match → require two feeds to agree to call it.
    notes.push({ ...base, kind: 'authority-missing' })
    const dissent = reported.filter((r) => Math.abs(r.ms - stored) >= thr)
    for (const cluster of clusterByTime(dissent, thr)) {
      if (cluster.length >= 2) {
        drifts.push({
          ...base,
          authISO: new Date(cluster[0].ms).toISOString(),
          diffMin: Math.round((cluster[0].ms - stored) / 60000),
          via: 'consensus',
          corroborators: cluster.map((c) => c.name),
        })
      } else {
        notes.push({
          ...base,
          kind: 'single-source',
          source: cluster[0].name,
          theirISO: new Date(cluster[0].ms).toISOString(),
          diffMin: Math.round((cluster[0].ms - stored) / 60000),
        })
      }
    }
  }
  return { drifts, notes, unmatched, venueMismatches }
}

// Feed-consensus fallback for a single knockout match FIFA can't time. Returns
// true if it produced a drift/note (caller should NOT mark it unmatched), false
// if no resolved teams / no feed had it (fall through to unmatched). Mirrors the
// authority-missing branch of compareSchedule: ≥2 agreeing feeds → consensus
// drift; a single dissenter → single-source note.
function resolveByConsensus(m, thr, fallback, out) {
  if (!fallback?.resolvedByNum || !fallback.sources?.length) return false
  const teams = fallback.resolvedByNum.get(m.num)
  if (!teams || !teams.t1 || !teams.t2) return false
  const key = keyOf(teams.t1, teams.t2)
  const reported = fallback.sources
    .map((s) => ({ name: s.name, ms: s.byKey.get(key) }))
    .filter((r) => r.ms != null)
  if (!reported.length) return false

  const stored = new Date(m.ko).getTime()
  const base = {
    num: m.num,
    t1: teams.t1,
    t2: teams.t2,
    storedISO: new Date(stored).toISOString(),
  }
  const dissent = reported.filter((r) => Math.abs(r.ms - stored) >= thr)
  let produced = false
  for (const cluster of clusterByTime(dissent, thr)) {
    if (cluster.length >= 2) {
      out.drifts.push({
        ...base,
        authISO: new Date(cluster[0].ms).toISOString(),
        diffMin: Math.round((cluster[0].ms - stored) / 60000),
        via: 'consensus',
        corroborators: cluster.map((c) => c.name),
      })
      produced = true
    } else {
      out.notes.push({
        ...base,
        kind: 'single-source',
        source: cluster[0].name,
        theirISO: new Date(cluster[0].ms).toISOString(),
        diffMin: Math.round((cluster[0].ms - stored) / 60000),
      })
      produced = true
    }
  }
  // Feeds had the match and all agreed with us → confirmed, nothing to report,
  // but it's no longer "unmatched".
  return produced || true
}

// Knockout matches can't be keyed by team pair — the teams are placeholders
// ("Winner Group A", "Winner Match 73") until the bracket resolves. FIFA is the
// only source that publishes a stable MatchNumber for an as-yet-undecided tie,
// and our knockout match numbers (73–104) ARE those FIFA numbers, so we validate
// kickoff time + venue against FIFA by number. FIFA-only (no feed corroboration)
// — consistent with the "authority decides" model; drift objects use the same
// shape as compareSchedule so reporting / autofix / email handle them uniformly.
//   fifaByNum: Map(num -> { ms, venue: { id, name, city } | null }).
//
// Fallback (used only for a match FIFA has no time for, e.g. FIFA unreachable):
// once a tie's teams have RESOLVED, the secondary feeds DO carry it by team pair,
// so we can fall back to the same two-feed consensus the group path uses rather
// than going dark on knockouts. Pass:
//   fallback.resolvedByNum: Map(num -> { t1, t2 })   resolved real team names
//   fallback.sources:       [{ name, byKey: Map(pairKey -> ms) }]   secondary feeds
// A drift is only raised when ≥2 feeds agree on a time that differs from ours
// (via: 'consensus'); a lone dissenter is a single-source note, never a drift.
export function compareKnockoutSchedule(
  matches,
  fifaByNum,
  { thresholdMin = 5, venues = null, venueAliasById = {}, fallback = null } = {},
) {
  const thr = thresholdMin * 60000
  const drifts = []
  const notes = []
  const unmatched = []
  const venueMismatches = []

  for (const m of matches) {
    const fifa = fifaByNum?.get(m.num)
    if (!fifa || fifa.ms == null) {
      // No authority time. Try the resolved-team feed consensus before giving up.
      if (resolveByConsensus(m, thr, fallback, { drifts, notes })) continue
      unmatched.push({ num: m.num, t1: m.t1, t2: m.t2 })
      continue
    }
    const stored = new Date(m.ko).getTime()
    const base = { num: m.num, t1: m.t1, t2: m.t2, storedISO: new Date(stored).toISOString() }

    // Venue cross-check (report only, like the group path).
    if (venues && fifa.venue) {
      const ours = venues[m.venue]
      if (ours) {
        const fifaKey = resolveFifaVenue(fifa.venue, venues, venueAliasById)
        const differs = fifaKey ? fifaKey !== m.venue : normVenue(fifa.venue.name) !== normVenue(ours.name)
        if (differs) {
          venueMismatches.push({
            num: m.num,
            t1: m.t1,
            t2: m.t2,
            ourVenue: m.venue,
            ourName: ours.name,
            ourCity: ours.city,
            fifaName: fifa.venue.name,
            fifaCity: fifa.venue.city,
          })
        }
      }
    }

    if (Math.abs(fifa.ms - stored) >= thr) {
      drifts.push({
        ...base,
        authISO: new Date(fifa.ms).toISOString(),
        diffMin: Math.round((fifa.ms - stored) / 60000),
        via: 'authority',
        corroborators: [],
      })
    }
  }
  return { drifts, notes, unmatched, venueMismatches }
}
