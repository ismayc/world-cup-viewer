// Tournament-wide aggregates computed from the merged match list: a team's
// record so far (the MatchDetail "tale of the tape"), the Golden Boot scorer
// race, and headline totals (the Stats view). All pure — components pass in the
// merged `matches` array and render what comes back.

import { FLAG_BY_TEAM } from '../data/teams.js'

// A result counts only once FINAL — a live score is provisional and a voided
// match has no result (same rule as the clinch engine / bracket resolution).
const isFinal = (m) => Boolean(m.score) && !m.live && !m.voided

// One team's tournament record across its finished matches. A knockout tie
// decided on penalties counts as a win/loss (tracked separately in pensWon /
// pensLost so the UI can note it); a group draw is a draw. Cards are best-effort
// — they come from ESPN's event feed, not OpenFootball — so `hasCardData` says
// whether any of the team's matches carried card events at all.
//
// `before` (a kickoff timestamp) limits the record to matches that KICKED OFF
// earlier — the record "going into" a given match, historically accurate when
// viewing a past game. Strictly earlier, so the match itself and simultaneous
// group finales stay out.
export function teamRecord(matches, team, { before } = {}) {
  const cutoff = before ? new Date(before).getTime() : null
  const rec = {
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    cleanSheets: 0,
    yellow: 0,
    red: 0,
    pensWon: 0,
    pensLost: 0,
    hasCardData: false,
  }
  for (const m of matches) {
    if (!isFinal(m)) continue
    if (cutoff != null && !(new Date(m.ko).getTime() < cutoff)) continue
    const side = m.t1 === team ? 't1' : m.t2 === team ? 't2' : null
    if (!side) continue
    const [gf, ga] = side === 't1' ? m.score : [m.score[1], m.score[0]]
    rec.played++
    rec.gf += gf
    rec.ga += ga
    if (ga === 0) rec.cleanSheets++
    if (gf > ga) rec.w++
    else if (gf < ga) rec.l++
    else if (m.pens && m.pens[0] !== m.pens[1]) {
      // Drawn after 90/120 but settled from the spot.
      const [pf, pa] = side === 't1' ? m.pens : [m.pens[1], m.pens[0]]
      if (pf > pa) {
        rec.w++
        rec.pensWon++
      } else {
        rec.l++
        rec.pensLost++
      }
    } else rec.d++
    const cards = m.cards?.[side]
    if (cards) {
      rec.hasCardData = true
      for (const c of cards) {
        if (c.color === 'red') rec.red++
        else rec.yellow++
      }
    }
  }
  rec.gd = rec.gf - rec.ga
  return rec
}

// Teams that can still add to a scorer's tally: any REAL team with a match
// left to play (or in play). Pass the resolved match list so knockout slots
// hold team names once known — placeholder labels ("Winner Match N") aren't
// real teams and don't count. Third-place losers stay active until the
// play-off is final; after the Final the set is empty (the race is over).
export function activeTeams(matches) {
  const out = new Set()
  for (const m of matches) {
    if (isFinal(m) || m.voided) continue
    for (const t of [m.t1, m.t2]) if (FLAG_BY_TEAM[t]) out.add(t)
  }
  return out
}

// Group scorer spellings across sources: ESPN and OpenFootball occasionally
// disagree on diacritics ("Julián" vs "Julian"), which would otherwise split
// one player's tally in two. Exported for anything joining players by name
// across feeds (Boot extras, per-match player lines).
export const nameKey = (name) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

// The Golden Boot race: every scorer across the tournament, own goals excluded
// (they don't count toward the award). Goals from a match still in progress ARE
// included — it's a live race — and flag the entry `live` so the UI can mark it
// provisional. Sorted by goals, then fewest penalties, then name; entries tied
// with the cut line are kept, so the list never splits a tie.
export function topScorers(matches, { limit = 10 } = {}) {
  const byKey = new Map()
  for (const m of matches) {
    if (!m.goals || m.voided) continue
    for (const side of ['t1', 't2']) {
      const team = m[side]
      for (const g of m.goals[side] || []) {
        if (g.og || !g.name) continue
        const key = `${team}|${nameKey(g.name)}`
        let e = byKey.get(key)
        if (!e) {
          e = { name: g.name, team, goals: 0, pens: 0, live: false }
          byKey.set(key, e)
        }
        e.goals++
        if (g.penalty) e.pens++
        if (m.live) e.live = true
      }
    }
  }
  const all = [...byKey.values()].sort(
    (a, b) => b.goals - a.goals || a.pens - b.pens || a.name.localeCompare(b.name),
  )
  if (all.length <= limit) return all
  // Keep everyone level on goals with the last entry inside the limit.
  const cut = all[limit - 1].goals
  let end = limit
  while (end < all.length && all[end].goals === cut) end++
  return all.slice(0, end)
}

// Override the season-aggregate tie-breakers (espnStats.fetchBootExtras) with
// the authoritative real-time totals from espnStats.fetchRecentPlayerStats for
// the scorers who played a recent match. The aggregate lags a match by minutes
// even past the final whistle — and omits scorers outside ESPN's top-25 leaders
// entirely — so each override is a full recomputed figure (per-match box scores
// summed) and REPLACES rather than adds: no double-count, correct on a cold
// load. Join is by diacritic-insensitive name; a scorer the aggregate never
// listed is added fresh. A null field leaves the existing value untouched.
// Returns `extras` untouched when there's nothing to override.
export function applyPlayerStatOverrides(extras, overrides) {
  if (!overrides?.length) return extras
  const byKey = new Map((extras || []).map((e) => [nameKey(e.name), { ...e }]))
  for (const { name, assists, minutes } of overrides) {
    const k = nameKey(name)
    const e = byKey.get(k)
    if (e) {
      if (assists != null) e.assists = assists
      if (minutes != null) e.minutes = minutes
    } else {
      byKey.set(k, { name, goals: null, assists: assists ?? undefined, minutes: minutes ?? undefined })
    }
  }
  return [...byKey.values()]
}

// Attach the official tie-breakers (assists, minutes played — via ESPN's
// leaders data) to a scorer list and re-sort by the award criteria: goals, then
// most assists, then FEWEST minutes. Entries ESPN didn't cover keep undefined
// assists/minutes and sort below covered entries on an otherwise-equal line
// (unknown can't outrank known). Join is by diacritic-insensitive name.
export function applyBootExtras(scorers, extras) {
  if (!extras?.length) return { scorers, enriched: false }
  const byName = new Map(extras.map((e) => [nameKey(e.name), e]))
  const out = scorers.map((s) => {
    const e = byName.get(nameKey(s.name))
    return e ? { ...s, assists: e.assists, minutes: e.minutes } : { ...s }
  })
  out.sort(
    (a, b) =>
      b.goals - a.goals ||
      (b.assists ?? -1) - (a.assists ?? -1) ||
      (a.minutes ?? Infinity) - (b.minutes ?? Infinity) ||
      a.name.localeCompare(b.name),
  )
  return { scorers: out, enriched: true }
}

// Standard competition ranking for the scorer table: level entries share a
// rank, and the next distinct one skips past the tied block ("1, 2, 2, 4").
// `keyOf` decides what "level" means — bare goals by default; the enriched
// table passes the full award key (goals + assists + minutes).
export function scorerRanks(scorers, keyOf = (s) => s.goals) {
  return scorers.map((s, i) => (i > 0 && keyOf(s) === keyOf(scorers[i - 1]) ? null : i + 1))
}

// The finished matches behind the Stats-view tiles, kickoff order. Shootouts
// are a subset of the extra-time list in a World Cup knockout, so both lists
// can show the same tie — that's informative, not a bug.
export const extraTimeMatches = (matches) =>
  matches.filter((m) => isFinal(m) && m.aet).sort((a, b) => new Date(a.ko) - new Date(b.ko))
export const shootoutMatches = (matches) =>
  matches.filter((m) => isFinal(m) && m.pens).sort((a, b) => new Date(a.ko) - new Date(b.ko))

// Headline tournament numbers for the Stats view. Goals/averages count FINISHED
// matches only (a live score is provisional); `live` is how many are in play.
export function tournamentTotals(matches) {
  let played = 0
  let goals = 0
  let et = 0
  let shootouts = 0
  let live = 0
  for (const m of matches) {
    if (m.live) live++
    if (!isFinal(m)) continue
    played++
    goals += m.score[0] + m.score[1]
    if (m.aet) et++
    if (m.pens) shootouts++
  }
  return {
    played,
    goals,
    perMatch: played ? goals / played : 0,
    et,
    shootouts,
    live,
  }
}
