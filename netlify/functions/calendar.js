// Auto-updating iCalendar feed for calendar subscriptions (webcal://).
// Fetches the live OpenFootball schedule on each request and emits an .ics, so a
// subscribed calendar reflects resolved knockout teams and final scores as they
// land. Optional ?teams=Mexico,Brazil filters to specific teams (case-insensitive).

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
exports.prettySlot = prettySlot

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

function uid(m) {
  if (m.num != null) return `wc2026-match-${m.num}@worldcupviewer`
  return `wc2026-${m.round}-${norm(m.team1)}-${norm(m.team2)}-${m.date}@worldcupviewer`.replace(/\s+/g, '_')
}

function vevent(m) {
  const start = toInstant(m.date, m.time)
  if (!start) return null
  const end = new Date(start.getTime() + MATCH_MS)
  const stage = m.round && m.round.startsWith('Matchday') ? (m.group || 'Group stage') : STAGE[m.round] || m.round
  const ft = m.score && Array.isArray(m.score.ft) ? ` (${m.score.ft[0]}–${m.score.ft[1]})` : ''
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

exports.handler = async (event) => {
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
