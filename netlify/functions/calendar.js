// Auto-updating iCalendar feed for calendar subscriptions (webcal://).
// Fetches the live OpenFootball schedule on each request and emits an .ics, so a
// subscribed calendar reflects resolved knockout teams and final scores as they
// land. Optional ?teams=Mexico,Brazil filters to specific teams (case-insensitive).
//
// This is an ES MODULE on purpose (the siblings converted first). The package sets
// "type": "module", so a CommonJS function (`exports.handler`) is rejected by
// Netlify's runtime with "module is not defined in ES module scope" whenever the
// site is built from Git rather than deployed through netlify-cli, which bundles
// the mismatch away.

const FEED = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
const MATCH_MS = 135 * 60 * 1000

const ALIASES = { 'Czech Republic': 'Czechia', Turkey: 'Türkiye' }
const norm = (n) => (n ? ALIASES[n] || n : n)

// OpenFootball's knockout slot codes (1A, 2B, 3A/B/C/D/F, W73, L101) are cryptic
// in a calendar. Map them to the same friendly wording the app's bracket uses; a
// resolved real team name just passes through (normalised).
function prettySlot(label) {
  if (!label) return label
  let m = /^1([A-L])$/.exec(label)
  if (m) return `Winner Group ${m[1]}`
  m = /^2([A-L])$/.exec(label)
  if (m) return `Runner-up Group ${m[1]}`
  if (/^3[A-L](\/[A-L])+$/.test(label)) return `3rd place (${label.slice(1)})`
  m = /^W(\d+)$/.exec(label)
  if (m) return `Winner Match ${m[1]}`
  m = /^L(\d+)$/.exec(label)
  if (m) return `Loser Match ${m[1]}`
  return norm(label)
}
export { prettySlot }

const STAGE = {
  'Round of 32': 'Round of 32',
  'Round of 16': 'Round of 16',
  'Quarter-final': 'Quarterfinal',
  'Semi-final': 'Semifinal',
  'Match for third place': 'Third-place Match',
  Final: 'Final',
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function toICSDate(d) {
  return (
    d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z'
  )
}

// "2026-06-11" + "13:00 UTC-6" -> absolute Date (instant).
function toInstant(date, time) {
  const [y, mo, d] = date.split('-').map(Number)
  const m = /(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})?/.exec(time || '')
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  const off = m[3] ? Number(m[3]) : 0
  return new Date(Date.UTC(y, mo - 1, d, hh - off, mm))
}

function esc(t) {
  return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

// Group-stage match numbers, keyed by the team pair. The download stamps a UID
// of `wc2026-match-<num>@worldcupviewer` (src/utils/ics.js, from LEAGUE.ics).
// This feed already emitted that for a knockout tie, because OpenFootball
// numbers its knockout fixtures. But it numbers ONLY those 32. The other 72
// fell through to a descriptive body built from the round, teams and date, so
// subscribing AND downloading put two events in the calendar for every group
// match. The bodies now agree for all 104, and test/calendar-feed.test.js
// asserts that against the download path rather than against a second copy of
// the literal.
//
// Group fixtures only. A knockout tie takes its number from the feed, which is
// the authority there: the committed record carries bracket slots ("Winner Group
// A") rather than the teams who filled them, so there is no pair to key on.
//
// The table restates src/data/matches.js. A test rebuilds it from the app's own
// data so a regenerated fixture list cannot drift away from it silently.
const GROUP_MATCH_NUMS = {
  "Mexico|South Africa"              : 1,
  "Czechia|South Korea"              : 2,
  "Bosnia & Herzegovina|Canada"      : 3,
  "Paraguay|USA"                     : 4,
  "Qatar|Switzerland"                : 5,
  "Brazil|Morocco"                   : 6,
  "Haiti|Scotland"                   : 7,
  "Australia|Türkiye"                : 8,
  "Curaçao|Germany"                  : 9,
  "Japan|Netherlands"                : 10,
  "Ecuador|Ivory Coast"              : 11,
  "Sweden|Tunisia"                   : 12,
  "Cape Verde|Spain"                 : 13,
  "Belgium|Egypt"                    : 14,
  "Saudi Arabia|Uruguay"             : 15,
  "Iran|New Zealand"                 : 16,
  "France|Senegal"                   : 17,
  "Iraq|Norway"                      : 18,
  "Algeria|Argentina"                : 19,
  "Austria|Jordan"                   : 20,
  "DR Congo|Portugal"                : 21,
  "Croatia|England"                  : 22,
  "Ghana|Panama"                     : 23,
  "Colombia|Uzbekistan"              : 24,
  "Czechia|South Africa"             : 25,
  "Bosnia & Herzegovina|Switzerland" : 26,
  "Canada|Qatar"                     : 27,
  "Mexico|South Korea"               : 28,
  "Australia|USA"                    : 29,
  "Morocco|Scotland"                 : 30,
  "Brazil|Haiti"                     : 31,
  "Paraguay|Türkiye"                 : 32,
  "Netherlands|Sweden"               : 33,
  "Germany|Ivory Coast"              : 34,
  "Curaçao|Ecuador"                  : 35,
  "Japan|Tunisia"                    : 36,
  "Saudi Arabia|Spain"               : 37,
  "Belgium|Iran"                     : 38,
  "Cape Verde|Uruguay"               : 39,
  "Egypt|New Zealand"                : 40,
  "Argentina|Austria"                : 41,
  "France|Iraq"                      : 42,
  "Norway|Senegal"                   : 43,
  "Algeria|Jordan"                   : 44,
  "Portugal|Uzbekistan"              : 45,
  "England|Ghana"                    : 46,
  "Croatia|Panama"                   : 47,
  "Colombia|DR Congo"                : 48,
  "Canada|Switzerland"               : 49,
  "Bosnia & Herzegovina|Qatar"       : 50,
  "Brazil|Scotland"                  : 51,
  "Haiti|Morocco"                    : 52,
  "Czechia|Mexico"                   : 53,
  "South Africa|South Korea"         : 54,
  "Curaçao|Ivory Coast"              : 55,
  "Ecuador|Germany"                  : 56,
  "Japan|Sweden"                     : 57,
  "Netherlands|Tunisia"              : 58,
  "Türkiye|USA"                      : 59,
  "Australia|Paraguay"               : 60,
  "France|Norway"                    : 61,
  "Iraq|Senegal"                     : 62,
  "Cape Verde|Saudi Arabia"          : 63,
  "Spain|Uruguay"                    : 64,
  "Egypt|Iran"                       : 65,
  "Belgium|New Zealand"              : 66,
  "England|Panama"                   : 67,
  "Croatia|Ghana"                    : 68,
  "Colombia|Portugal"                : 69,
  "DR Congo|Uzbekistan"              : 70,
  "Algeria|Austria"                  : 71,
  "Argentina|Jordan"                 : 72,
}

const pairId = (a, b) => [a, b].sort().join('|')

// The feed numbers its knockout ties and nothing else, so a group fixture's
// number is recovered from its teams. A pairing the committed data has never
// seen falls back to the descriptive body rather than risk colliding with a real
// match's UID.
function matchNum(m) {
  return m.num != null ? m.num : GROUP_MATCH_NUMS[pairId(norm(m.team1), norm(m.team2))]
}

function uid(m) {
  const num = matchNum(m)
  if (num != null) return `wc2026-match-${num}@worldcupviewer`
  return `wc2026-${m.round}-${norm(m.team1)}-${norm(m.team2)}-${m.date}@worldcupviewer`.replace(/\s+/g, '_')
}

function vevent(m) {
  const start = toInstant(m.date, m.time)
  if (!start) return null
  const end = new Date(start.getTime() + MATCH_MS)
  const stage = m.round && m.round.startsWith('Matchday') ? (m.group || 'Group stage') : STAGE[m.round] || m.round
  // Final score: prefer the extra-time score (a knockout won in ET has a level
  // `ft`); note AET / penalty shootouts so the calendar shows the real result.
  const fin = m.score && (Array.isArray(m.score.et) ? m.score.et : Array.isArray(m.score.ft) ? m.score.ft : null)
  const pens = m.score && Array.isArray(m.score.p) ? ` p${m.score.p[0]}–${m.score.p[1]}` : ''
  const aet = m.score && Array.isArray(m.score.et) ? ' AET' : ''
  const ft = fin ? ` (${fin[0]}–${fin[1]}${aet}${pens})` : ''
  const summary = `World Cup: ${prettySlot(m.team1)} vs ${prettySlot(m.team2)}${ft}`
  return [
    'BEGIN:VEVENT',
    `UID:${uid(m)}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${esc(summary)}`,
    `LOCATION:${esc(m.ground || '')}`,
    `DESCRIPTION:${esc(stage)}`,
    'END:VEVENT',
  ].join('\r\n')
}

export const handler = async (event) => {
  try {
    const res = await fetch(FEED)
    if (!res.ok) return { statusCode: 502, body: `Upstream ${res.status}` }
    const data = await res.json()
    let matches = data.matches || []

    const teamsParam = (event.queryStringParameters && event.queryStringParameters.teams) || ''
    let calName = 'World Cup 2026'
    if (teamsParam) {
      const want = new Set(teamsParam.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))
      matches = matches.filter(
        (m) => want.has(norm(m.team1)?.toLowerCase()) || want.has(norm(m.team2)?.toLowerCase()),
      )
      calName = 'World Cup 2026 — My Teams'
    }

    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//World Cup 2026 Viewer//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(calName)}`,
      'X-PUBLISHED-TTL:PT2H',
      'REFRESH-INTERVAL;VALUE=DURATION:PT2H',
      ...matches.map(vevent).filter(Boolean),
      'END:VCALENDAR',
    ].join('\r\n')

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="worldcup-2026.ics"',
        'Cache-Control': 'public, max-age=900',
        'Access-Control-Allow-Origin': '*',
      },
      body,
    }
  } catch (err) {
    return { statusCode: 500, body: `Error: ${err.message}` }
  }
}
