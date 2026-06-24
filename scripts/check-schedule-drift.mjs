// Schedule-drift check, anchored to FIFA's own data so nobody has to adjudicate
// and we don't rely on the secondary feeds being right.
//
// Sources (all free, keyless, fetched with plain fetch):
//   • FIFA  — api.fifa.com calendar (the AUTHORITY; its time is the answer)
//   • ESPN, TheSportsDB, OpenFootball — corroboration / backup if FIFA is down
//
// For every GROUP match (teams are known, so all four can be matched by team
// pair) we compare our stored kickoff to FIFA's. If FIFA differs → drift (the
// email says FIFA's time and which feeds agree, so you just update the data). If
// FIFA confirms us but a feed disagrees → a feed glitch, logged as a note. If
// FIFA is unreachable for a match → we fall back to needing two feeds to agree.
//
// Runs hourly via feed-freshness.yml (exit 1 → red build → email) and each
// morning via schedule-check.yml (SCHEDULE_REPORT_ONLY=1 → email + exit 0).
// Node built-ins + repo source only; email via Gmail SMTP through python3.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { MATCHES } from '../src/data/matches.js'
import { VENUES } from '../src/data/venues.js'
import { LIVE_SOURCE, normEspn } from '../src/services/espn.js'
import { normSdb, sdbDayUrl } from '../src/services/thesportsdb.js'
import { RESULTS_SOURCE, normalizeTeam, pairKey } from '../src/services/results.js'
import { compareSchedule, compareKnockoutSchedule } from './schedule-core.mjs'
import { etStrings, editMatches, editFixture } from './schedule-fix-core.mjs'

const MATCHES_FILE = 'src/data/matches.js'
const FIXTURE_FILE = 'test/fixtures/official-kickoffs.js'

// SCHEDULE_AUTOFIX=1: rewrite both files to FIFA's time for each drift, in place.
// The workflow then opens a PR from the changed files. Returns the applied list.
function applyAutofix(drifts) {
  let mSrc = readFileSync(MATCHES_FILE, 'utf8')
  let fSrc = readFileSync(FIXTURE_FILE, 'utf8')
  const applied = []
  for (const d of drifts) {
    const { ko, fixture } = etStrings(Date.parse(d.authISO))
    const a = editMatches(mSrc, d.num, ko)
    const b = editFixture(fSrc, d.num, fixture)
    if (a.changed && b.changed) {
      mSrc = a.text
      fSrc = b.text
      applied.push({ num: d.num, ko, fixture })
    } else {
      console.warn(`  ⚠ could not auto-fix M${d.num} (matches=${a.changed}, fixture=${b.changed})`)
    }
  }
  if (applied.length) {
    writeFileSync(MATCHES_FILE, mSrc)
    writeFileSync(FIXTURE_FILE, fSrc)
    console.log(`  ✏ auto-fix applied to ${applied.length} match(es); the workflow will open a PR.`)
  }
  return applied
}

// FIFA's official data API (keyless). idSeason 285023 = FIFA World Cup 26.
const FIFA_URL =
  'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200&language=en'
const FIFA_ALIASES = {
  'Korea Republic': 'South Korea',
  'Cabo Verde': 'Cape Verde',
  'Congo DR': 'DR Congo',
  "Côte d'Ivoire": 'Ivory Coast',
  'IR Iran': 'Iran',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
}
const normFifa = (n) => normalizeTeam(FIFA_ALIASES[n] || n)

// FIFA's stadium IdStadium → our VENUES key. FIFA names venues generically
// (sponsor-free, city-based: "Los Angeles Stadium" = SoFi), so the stable
// numeric IdStadium is the reliable join. Built by curling the calendar's 16
// unique Stadium objects and matching each city to our venue.
const FIFA_VENUE_ALIASES = {
  '400222084': 'azteca', // Mexico City Stadium
  '400252150': 'akron', // Guadalajara Stadium
  '400242032': 'bmo', // Toronto Stadium
  '400017978': 'sofi', // Los Angeles Stadium
  '400257521': 'levis', // San Francisco Bay Area Stadium
  '400257536': 'metlife', // New York/New Jersey Stadium
  '400248623': 'gillette', // Boston Stadium
  '400248370': 'bcplace', // BC Place Vancouver
  '400249385': 'nrg', // Houston Stadium
  '400257526': 'att', // Dallas Stadium
  '400248622': 'linc', // Philadelphia Stadium
  '400238450': 'bbva', // Monterrey Stadium
  '400098290': 'mercedes', // Atlanta Stadium
  '400216606': 'lumen', // Seattle Stadium
  '400257525': 'hardrock', // Miami Stadium
  '400254717': 'arrowhead', // Kansas City Stadium
}

// Every UTC day a match falls on, ±1 (ESPN files some games under an adjacent date).
function matchDates() {
  const days = new Set()
  for (const m of MATCHES) {
    const base = new Date(m.ko)
    for (const off of [-1, 0, 1]) {
      const d = new Date(base)
      d.setUTCDate(d.getUTCDate() + off)
      days.add(d.toISOString().slice(0, 10).replace(/-/g, ''))
    }
  }
  return [...days].sort()
}

// Returns { byKey: Map(pairKey -> kickoff ms), venueByKey: Map(pairKey ->
// {id,name,city}), byNum: Map(MatchNumber -> { ms, venue }) }. byNum covers every
// match (incl. knockouts whose teams are still placeholders) for the number-keyed
// knockout check; byKey/venueByKey stay team-pair-keyed for the group check.
async function fifaByKey() {
  const map = new Map()
  const venueByKey = new Map()
  const byNum = new Map()
  try {
    const r = await fetch(FIFA_URL, { cache: 'no-store' })
    if (!r.ok) return { byKey: map, venueByKey, byNum }
    for (const m of (await r.json()).Results || []) {
      const t = new Date(m.Date).getTime()
      const st = m.Stadium
      const venue = st?.Name?.[0]?.Description
        ? { id: st.IdStadium, name: st.Name[0].Description, city: st.CityName?.[0]?.Description }
        : null
      const num = Number(m.MatchNumber)
      if (num && !Number.isNaN(t)) byNum.set(num, { ms: t, venue })

      const home = m.Home?.TeamName?.[0]?.Description
      const away = m.Away?.TeamName?.[0]?.Description
      if (!home || !away) continue
      const key = pairKey(normFifa(home), normFifa(away))
      if (!Number.isNaN(t)) map.set(key, t)
      if (venue) venueByKey.set(key, venue)
    }
  } catch {
    /* best-effort */
  }
  return { byKey: map, venueByKey, byNum }
}

async function espnByKey() {
  const map = new Map()
  const seen = new Set()
  for (const d of matchDates()) {
    try {
      const r = await fetch(`${LIVE_SOURCE.url}?dates=${d}`, { cache: 'no-store' })
      if (!r.ok) continue
      for (const ev of (await r.json()).events || []) {
        const id = ev.id || ev.uid
        if (id && seen.has(id)) continue
        if (id) seen.add(id)
        const c = ev.competitions?.[0]
        const cs = c?.competitors || []
        const home = cs.find((x) => x.homeAway === 'home')?.team?.displayName
        const away = cs.find((x) => x.homeAway === 'away')?.team?.displayName
        const t = new Date(ev.date).getTime()
        if (home && away && !Number.isNaN(t)) map.set(pairKey(normEspn(home), normEspn(away)), t)
      }
    } catch {
      /* best-effort per day */
    }
  }
  return map
}

async function sdbByKey() {
  const map = new Map()
  // The season endpoint freezes after the opening days; poll the per-day endpoint
  // across every match date instead (YYYYMMDD → YYYY-MM-DD), sequentially to stay
  // gentle on the free key.
  const dates = matchDates().map((d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`)
  for (const d of dates) {
    try {
      const r = await fetch(sdbDayUrl(d), { cache: 'no-store' })
      if (!r.ok) continue
      for (const ev of (await r.json()).events || []) {
        const home = ev.strHomeTeam
        const away = ev.strAwayTeam
        const raw = ev.strTimestamp
          ? ev.strTimestamp + (/[zZ]|[+-]\d\d:?\d\d$/.test(ev.strTimestamp) ? '' : 'Z')
          : ev.dateEvent && ev.strTime
            ? `${ev.dateEvent}T${ev.strTime}Z`
            : null
        const t = raw ? new Date(raw).getTime() : NaN
        if (home && away && !Number.isNaN(t)) map.set(pairKey(normSdb(home), normSdb(away)), t)
      }
    } catch {
      /* best-effort per day */
    }
  }
  return map
}

// OpenFootball time like "18:00 UTC-7" with a separate local date.
function ofMs(date, time) {
  const m = /^(\d{1,2}):(\d{2})\s*UTC\s*([+-])(\d{1,2})(?::?(\d{2}))?/.exec(time || '')
  if (!m) return null
  const [, hh, mm, sign, oh, om = '0'] = m
  const offset = `${sign}${String(Number(oh)).padStart(2, '0')}:${String(Number(om)).padStart(2, '0')}`
  const t = new Date(`${date}T${hh.padStart(2, '0')}:${mm}:00${offset}`).getTime()
  return Number.isNaN(t) ? null : t
}

async function openFootballByKey() {
  const map = new Map()
  try {
    const r = await fetch(RESULTS_SOURCE.url, { cache: 'no-store' })
    if (!r.ok) return map
    for (const m of (await r.json()).matches || []) {
      if (!(m.round || '').startsWith('Matchday')) continue
      const t = ofMs(m.date, m.time)
      if (m.team1 && m.team2 && t != null) map.set(pairKey(normalizeTeam(m.team1), normalizeTeam(m.team2)), t)
    }
  } catch {
    /* best-effort */
  }
  return map
}

async function main() {
  const reportOnly = process.env.SCHEDULE_REPORT_ONLY === '1'
  const thresholdMin = Number(process.env.THRESHOLD_MIN) || 5

  const [fifaRes, espn, sdb, of] = await Promise.all([fifaByKey(), espnByKey(), sdbByKey(), openFootballByKey()])
  const { byKey: fifa, venueByKey: fifaVenues, byNum: fifaByNum } = fifaRes
  const sources = [
    { name: 'FIFA', byKey: fifa },
    { name: 'ESPN', byKey: espn },
    { name: 'TheSportsDB', byKey: sdb },
    { name: 'OpenFootball', byKey: of },
  ].filter((s) => s.byKey.size)

  if (!sources.length) {
    console.error('No source reachable — skipping schedule check (no false alarm).')
    return
  }
  if (!fifa.size) console.warn('⚠ FIFA (authority) unreachable — falling back to feed consensus this run.')

  const groupMatches = MATCHES.filter((m) => m.stage === 'Group')
  const { drifts, notes, unmatched, venueMismatches } = compareSchedule(groupMatches, sources, {
    thresholdMin,
    authority: 'FIFA',
    venueByKey: fifaVenues,
    venues: VENUES,
    venueAliasById: FIFA_VENUE_ALIASES,
  })

  // Knockout matches: FIFA-anchored by MatchNumber (their teams are placeholders,
  // so they can't be keyed by pair). Merge into the same buckets so reporting,
  // auto-fix, and the email treat group and knockout drifts identically.
  const koMatches = MATCHES.filter((m) => m.stage !== 'Group')
  const koResult = compareKnockoutSchedule(koMatches, fifaByNum, {
    thresholdMin,
    venues: VENUES,
    venueAliasById: FIFA_VENUE_ALIASES,
  })
  drifts.push(...koResult.drifts)
  notes.push(...koResult.notes)
  unmatched.push(...koResult.unmatched)
  venueMismatches.push(...koResult.venueMismatches)

  console.log(
    `Schedule check (FIFA-anchored): ${groupMatches.length} group + ${koMatches.length} knockout matches | ` +
      `${drifts.length} drift(s) | ${notes.length} note(s) | ${unmatched.length} unmatched | ` +
      `${venueMismatches.length} venue mismatch(es) | ` +
      `sources: ${sources.map((s) => s.name).join(', ')}`,
  )
  for (const d of drifts) {
    const via = d.via === 'authority' ? 'FIFA' : 'feed consensus'
    const corr = d.corroborators.length ? ` (also: ${d.corroborators.join(', ')})` : ' (no feed corroboration yet)'
    console.log(`  DRIFT M${d.num} ${d.t1} v ${d.t2}: ours ${d.storedISO} → ${via} ${d.authISO} | ${d.diffMin > 0 ? '+' : ''}${d.diffMin}min${corr}`)
  }
  for (const n of notes.filter((n) => n.kind !== 'authority-missing')) {
    console.log(`  note: M${n.num} ${n.t1} v ${n.t2} — ${n.kind}${n.source ? ` (${n.source} ${n.theirISO})` : ''}`)
  }
  for (const v of venueMismatches) {
    console.log(`  VENUE? M${v.num} ${v.t1} v ${v.t2}: ours ${v.ourName} (${v.ourCity}) → FIFA ${v.fifaName} (${v.fifaCity})`)
  }

  // Auto-fix: when enabled, rewrite both files to FIFA's time so the workflow
  // can open a ready-to-merge PR (the email then points to it rather than asking
  // for a manual edit).
  const applied = process.env.SCHEDULE_AUTOFIX === '1' && drifts.length ? applyAutofix(drifts) : []

  // "Venue changed?" — report only, never auto-fixed (unlike time). Reused for
  // both the standalone email and as an extra section in the kickoff email.
  const venueSection = venueMismatches.length
    ? `FIFA's calendar lists a different stadium than we have stored. This is NOT auto-fixed — ` +
      `verify against FIFA, then update src/data/matches.js (the m.venue key) if it really moved:\n\n` +
      venueMismatches
        .map((v) => `- M${v.num} ${v.t1} v ${v.t2}: ours ${v.ourName} (${v.ourCity}) → FIFA ${v.fifaName} (${v.fifaCity})`)
        .join('\n') +
      '\n'
    : ''

  if (drifts.length) {
    const lines = drifts.map((d) => {
      const src = d.via === 'authority' ? 'FIFA' : 'feed consensus'
      const corr = d.corroborators.length ? `; corroborated by ${d.corroborators.join(', ')}` : '; NOT yet corroborated by feeds'
      return `- M${d.num} ${d.t1} v ${d.t2}: ours ${d.storedISO} → ${src} says ${d.authISO} (${d.diffMin > 0 ? '+' : ''}${d.diffMin} min${corr})`
    })
    const feedNotes = notes.filter((n) => n.kind === 'feed-discrepancy')
    const fixInstruction = applied.length
      ? `An auto-fix PR with these corrections has been prepared — review & merge it. The change:\n\n`
      : `Update src/data/matches.js AND test/fixtures/official-kickoffs.js to FIFA's time ` +
        `(data.test.js asserts they agree):\n\n`
    sendEmail(
      `⏰ Kickoff change: ${drifts.length} group match${drifts.length === 1 ? '' : 'es'} differ from FIFA`,
      `FIFA's official data disagrees with our stored kickoff time(s). ${fixInstruction}` +
        `${lines.join('\n')}\n` +
        (feedNotes.length
          ? `\nFYI — a feed also disagreed with us on a match FIFA confirmed (likely a feed glitch, no action):\n` +
            feedNotes.map((n) => `- M${n.num} ${n.t1} v ${n.t2}: ${n.source} ${n.theirISO}`).join('\n') +
            '\n'
          : '') +
        (venueSection ? `\n--- Venue changed? ---\n${venueSection}` : ''),
    )
  } else if (venueSection) {
    sendEmail(
      `🏟 Venue change?: ${venueMismatches.length} group match${venueMismatches.length === 1 ? '' : 'es'} differ from FIFA`,
      venueSection,
    )
  }

  if (drifts.length && !reportOnly) process.exit(1)
}

// Gmail SMTP via Python's smtplib (preinstalled on the runner). No-op without
// mail secrets; best-effort, never throws. Mirrors scripts/openfootball-autofill.mjs.
function sendEmail(subject, body) {
  const user = process.env.MAIL_USERNAME
  const pass = process.env.MAIL_PASSWORD
  if (!user || !pass) {
    console.log('  (no mail secrets — skipping email)')
    return
  }
  const py = `import smtplib, os, ssl
from email.message import EmailMessage
m = EmailMessage()
m['From'] = os.environ['SMTP_FROM']; m['To'] = os.environ['SMTP_TO']
m['Subject'] = os.environ['SMTP_SUBJECT']; m.set_content(os.environ['SMTP_BODY'])
with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ssl.create_default_context()) as s:
    s.login(os.environ['SMTP_USER'], os.environ['SMTP_PASS'])
    s.send_message(m)
`
  try {
    execSync('python3 -', {
      input: py,
      env: {
        ...process.env,
        SMTP_FROM: `World Cup Schedule Check <${user}>`,
        SMTP_TO: process.env.MAIL_TO || 'chester.ismay@gmail.com',
        SMTP_SUBJECT: subject,
        SMTP_BODY: body,
        SMTP_USER: user,
        SMTP_PASS: pass,
      },
    })
    console.log(`  ✉ emailed ${process.env.MAIL_TO || 'chester.ismay@gmail.com'}`)
  } catch (err) {
    console.log(`  ✖ email failed: ${(err.stderr || err.message || '').toString().trim()}`)
  }
}

main()
