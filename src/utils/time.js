// Timezone-aware formatting helpers. Every match's kickoff is stored as an
// absolute instant (ISO string with offset), so the same instant can be
// rendered into whatever timezone the viewer selects.

import { TEAM_TIMEZONES } from '../data/teamTimezones.js'

// The viewer's own IANA timezone, e.g. "America/Chicago" or "Europe/London".
export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// A curated list of common timezones for the picker, plus the viewer's own
// detected zone (deduped) so they can always switch back to it.
export function timezoneOptions(detected) {
  const common = [
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'America/Toronto',
    'America/Vancouver',
    'UTC',
    'Europe/London',
    'Europe/Paris',
    'Europe/Madrid',
    'Europe/Berlin',
    'Africa/Lagos',
    'Africa/Johannesburg',
    'Asia/Riyadh',
    'Asia/Tehran',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
  ]
  const set = new Set([detected, ...common])
  return [...set]
}

// `new Date(null)` is not an Invalid Date, it is the Unix EPOCH, and it formats
// without complaint: "December 31, 1969" and a plausible wall-clock time that
// even shifts with the viewer's timezone. Nothing fails loudly, so a missing
// kickoff ships as a 1969 date. It did exactly that in the FIBA sibling, whose
// board carries games the organizer has not timed yet. Every formatter here
// refuses a missing instant, so a call site that forgets the case shows nothing.
function hasInstant(iso) {
  return iso != null && iso !== ''
}

export function formatTime(iso, tz) {
  if (!hasInstant(iso)) return ''
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Long date in a given timezone, e.g. "Thursday, June 11, 2026".
export function formatDateLong(iso, tz) {
  if (!hasInstant(iso)) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Long form of a calendar-day KEY ("2026-06-20" -> "Saturday, June 20, 2026"),
// with `year: false` for the shorter heading the day pop-up uses.
//
// A day heading names the DAY its section groups, so it formats the key rather
// than the first match's kickoff. Reading a kickoff there is only correct while
// every match on the day has one, which is an assumption about the DATA, not
// about the heading.
//
// The key is a plain calendar date with no instant behind it, so it is parsed at
// noon UTC and rendered in UTC: any timezone conversion here would shift the
// date the key already states.
export function formatDayKeyLong(key, { year = true } = {}) {
  if (!key) return ''
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(year ? { year: 'numeric' } : null),
  })
}

// Stable key for grouping matches by their calendar day *in the viewer's tz*.
// (A 10pm ET match can fall on a different calendar day in Tokyo — this keeps
// the date headers correct for the viewer.)
export function dayKey(iso, tz) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD
}

// Short timezone abbreviation for a given instant, e.g. "CDT", "GMT+1".
export function tzAbbrev(iso, tz) {
  if (!hasInstant(iso)) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(new Date(iso))
  const part = parts.find((p) => p.type === 'timeZoneName')
  return part ? part.value : ''
}

// Kickoff as "Jun 11, 1:00 PM" in a given timezone (date + wall-clock time).
function formatDateTimeShort(iso, tz) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}

// Distinct local kickoff strings for a team's home country, e.g.
// ["Jun 11, 1:00 PM CST", "Jun 11, 11:00 AM PST"]. Countries spanning several
// timezones yield one entry per distinct wall-clock; zones that read the same
// clock at this instant collapse to a single line. Returns [] for teams with no
// known home zone (e.g. knockout placeholders like "Winner Group A").
export function teamLocalKickoffs(iso, teamName) {
  const zones = TEAM_TIMEZONES[teamName]
  if (!zones || zones.length === 0) return []
  const seen = new Set()
  const out = []
  for (const tz of zones) {
    const clock = formatDateTimeShort(iso, tz)
    if (seen.has(clock)) continue
    seen.add(clock)
    out.push(`${clock} ${tzAbbrev(iso, tz)}`)
  }
  return out
}

// Multi-line tooltip text for hovering a team: when the match kicks off in that
// team's home timezone(s). Empty string when the team has no known home zone.
export function teamKickoffTooltip(iso, teamName) {
  const lines = teamLocalKickoffs(iso, teamName)
  if (lines.length === 0) return ''
  const head = lines.length > 1 ? `Kickoff in ${teamName} (local times):` : `Kickoff in ${teamName}:`
  return [head, ...lines].join('\n')
}

// Match status relative to "now". Group/knockout games run ~2 hours; we treat
// a match as live for 2h15m after kickoff to cover stoppage and halftime.
const MATCH_MINUTES = 135
export function matchStatus(iso, now = Date.now()) {
  const start = new Date(iso).getTime()
  const end = start + MATCH_MINUTES * 60 * 1000
  if (now < start) return 'upcoming'
  if (now <= end) return 'live'
  return 'finished'
}

// Authoritative status for a (possibly merged) match. Prefers real feed data
// over the clock: a match ESPN flags live (`m.live`) is live; one that has a
// final score is finished — even if it's still inside the time-based window
// (e.g. ended early). The clock is only a fallback when we have neither.
export function liveState(match, now = Date.now()) {
  if (match.voided) return 'voided' // abandoned/postponed/canceled — not live/finished/upcoming
  if (match.live) return 'live'
  if (Array.isArray(match.score)) return 'finished'
  return matchStatus(match.ko, now)
}

// One-off status for display, or null for a normal match. Drives the amber
// "paused" badge (delayed/suspended), a "voided" label (abandoned/postponed/
// canceled), or an "awarded" note — shared so every view renders them the same.
export function statusFlag(match) {
  if (match.voided) return { kind: 'voided', label: match.statusLabel || 'Off' }
  if (match.live?.delayed) return { kind: 'paused', label: match.live.label || 'Delayed' }
  if (match.awarded) return { kind: 'awarded', label: 'Awarded' }
  return null
}
