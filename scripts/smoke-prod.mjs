#!/usr/bin/env node
// Check a viewer's DEPLOYED site, not its build.
//
// WHY THIS EXISTS. Nothing else in this family ever fetches an absolute
// production URL. The build does not, the tests do not, and CI does not, so an
// entire class of fault is invisible to the whole gate:
//
//   * a host that was never created (the FIBA viewer shipped with og:image,
//     og:url and canonical all pointing at a Netlify site that did not exist,
//     so every link preview was blank and nothing failed)
//   * a URL pointing at a SIBLING's host, which answers 200 with another
//     tournament's data, and is worse than a 404 because it looks healthy
//   * a serverless function that 502s in production while its unit tests pass
//   * a calendar feed that disagrees with the schedule the app shows
//
// Run it after a deploy, from the repo it belongs to:
//
//   node scripts/smoke-prod.mjs              # every check
//   node scripts/smoke-prod.mjs --quiet      # only failures
//
// Node built-ins only, so it runs with no `npm ci` (the same constraint the
// refresh workflows have). Canonical copy lives in sports-viewer-meta; each repo
// vendors it. Re-run `node sports-viewer-meta/scripts/check-smoke-sync.mjs`
// after editing the canonical one.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const QUIET = process.argv.includes('--quiet')
const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8') } catch { return '' } }

const results = []
const record = (ok, name, detail) => { results.push({ ok, name, detail }) }

// ---------------------------------------------------------------------------
// Discover what this repo claims about itself
// ---------------------------------------------------------------------------

// The absolute URLs a link preview and a search engine will follow. These come
// from index.html rather than a config file, because index.html is what actually
// ships, and it is where a stale sibling host hides.
// Keyed by TAG, not by URL. Several tags legitimately share a URL (og:url and
// canonical almost always do), and keying the other way round silently collapsed
// them, which hid both the label and whether the tag was present at all.
const TAGS = [
  ['canonical', /<link\s+rel="canonical"\s+href="([^"]+)"/],
  ['og:image', /property="og:image"\s+content="([^"]+)"/],
  ['og:url', /property="og:url"\s+content="([^"]+)"/],
  ['twitter:image', /name="twitter:image"\s+content="([^"]+)"/],
]

function declaredUrls() {
  const html = read('index.html')
  const urls = new Map()
  for (const [label, re] of TAGS) {
    const m = html.match(re)
    if (m) urls.set(label, m[1])
  }
  // A missing card tag is itself the finding: it is why a link preview renders
  // as a bare URL. Report it rather than passing a shorter list of checks.
  for (const [label] of TAGS) {
    if (!urls.has(label)) record(false, `${label} declared in index.html`, 'tag missing')
  }
  return urls
}

// The calendar subscription feed. It is served by a Netlify function, so it
// lives on the .netlify.app host even in the repos whose og tags point at GitHub
// Pages: Pages runs no functions and can only 404 there. `PROD` in
// CalendarModal.jsx is the app's own answer for where it tells users to
// subscribe, so it is the right thing to test.
function feedUrl() {
  if (!existsSync(join(ROOT, 'netlify/functions'))) return null
  const m = read('src/components/CalendarModal.jsx').match(/const PROD = '([^']+)'/)
  return m ? `${m[1].replace(/\/$/, '')}/calendar.ics` : null
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function head(url) {
  // Some hosts answer HEAD differently from GET, and a link-preview crawler
  // issues a GET, so this does too and simply discards the body.
  const res = await fetch(url, { redirect: 'follow' })
  return { status: res.status, type: res.headers.get('content-type') || '', res }
}

async function checkUrl(url, label) {
  try {
    const { status, type } = await head(url)
    const ok = status === 200
    record(ok, `${label} ${url}`, ok ? `200 ${type.split(';')[0]}` : `HTTP ${status}`)
    return ok
  } catch (err) {
    record(false, `${label} ${url}`, err.message)
    return false
  }
}

// An image that answers 200 with an HTML body is a single-page-app catch-all
// pretending the file exists. That is exactly what a wrong path looks like on
// Netlify, and a link preview renders it as nothing.
async function checkImage(url, label) {
  try {
    const { status, type } = await head(url)
    const ok = status === 200 && type.startsWith('image/')
    record(ok, `${label} ${url}`, ok ? `200 ${type}` : `HTTP ${status} ${type || 'no content-type'}`)
    return ok
  } catch (err) {
    record(false, `${label} ${url}`, err.message)
    return false
  }
}

// The feed must be real iCalendar with at least one event. An empty but
// well-formed calendar is the shape a silently-failing upstream produces, and a
// subscriber sees nothing rather than an error.
async function checkFeed(url) {
  try {
    const { status, res } = await head(url)
    if (status !== 200) return record(false, `calendar feed ${url}`, `HTTP ${status}`)
    const body = await res.text()
    if (!body.startsWith('BEGIN:VCALENDAR')) {
      return record(false, `calendar feed ${url}`, 'not iCalendar')
    }
    const events = (body.match(/BEGIN:VEVENT/g) || []).length
    record(events > 0, `calendar feed ${url}`, `${events} events`)
    return body
  } catch (err) {
    record(false, `calendar feed ${url}`, err.message)
  }
  return null
}

// Does the deployed feed agree with the schedule this repo committed?
//
// Only meaningful where the function fetches its own upstream instead of
// importing committed data: those feeds bypass every correction the build
// applies, which is how one FIBA game reached subscribers two hours early while
// the app showed the right time.
//
// The comparison is deliberately one-directional. Every DTSTART the feed emits
// must be an instant the committed schedule also holds. The reverse is NOT
// required: a feed legitimately omits fixtures whose teams are not decided yet.
// Instants the schedule does not have are REPORTED, not failed, because a
// knockout fixture the organizer has just announced is exactly that case and is
// not a fault.
function checkFeedAgainstSchedule(ics) {
  const fn = ['netlify/functions/calendar.js', 'netlify/functions/calendar.mjs'].find((p) =>
    existsSync(join(ROOT, p)),
  )
  if (!fn || !/fetch\(/.test(read(fn))) return // committed-data feed cannot drift
  const data = ['src/data/games.js', 'src/data/matches.js', 'src/data/schedule.js', 'src/data/fixtures.js']
    .map(read)
    .find(Boolean)
  if (!data) return
  const committed = new Set()
  for (const m of data.matchAll(/["']?\b(?:ko|tip)["']?\s*:\s*'([^']+)'/g)) {
    const t = Date.parse(m[1])
    if (!Number.isNaN(t)) committed.add(t)
  }
  if (committed.size === 0) return
  const unmatched = []
  for (const m of ics.matchAll(/DTSTART:(\d{8}T\d{6}Z)/g)) {
    const s = m[1]
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`
    if (!committed.has(Date.parse(iso))) unmatched.push(iso)
  }
  // A shifted time is the failure we care about: the feed and the schedule
  // disagree about a game they both hold. It shows up as an unmatched instant
  // on a DAY the schedule does have games for.
  const days = new Set([...committed].map((t) => new Date(t).toISOString().slice(0, 10)))
  let shifted = unmatched.filter((iso) => days.has(iso.slice(0, 10)))
  const announced = unmatched.length - shifted.length

  // Known, explained divergences do not fail the run.
  //
  // The one that keeps recurring: when a game is DELAYED, the committed schedule
  // records the time it actually started and ESPN's scoreboard keeps the time it
  // was scheduled for. The app is right to show the real start, so this is not a
  // bug to fix in the data, but it is also not something to leave permanently
  // red, because a check that is always failing is a check nobody reads.
  //
  // Each entry must say WHY. An unexplained instant does not belong here; a real
  // upstream error belongs in the repo's own correction table instead, the way
  // FIBA's KNOWN_ESPN_TIME_BUGS handles a genuinely wrong ESPN record.
  let knownCount = 0
  try {
    const known = JSON.parse(read('scripts/smoke-known.json') || '{}')
    const allowed = new Set((known.feedStartMismatch || []).filter((e) => e.why).map((e) => e.iso))
    const before = shifted.length
    shifted = shifted.filter((iso) => !allowed.has(iso))
    knownCount = before - shifted.length
  } catch {
    record(false, 'scripts/smoke-known.json', 'present but not valid JSON')
  }

  const notes = []
  if (knownCount) notes.push(`${knownCount} known and explained`)
  if (announced) notes.push(`${announced} on days the schedule has no games for, treated as newly announced`)
  record(
    shifted.length === 0,
    'feed agrees with the committed schedule',
    shifted.length
      ? `${shifted.length} start(s) the schedule does not have on a day it does cover: ${shifted.join(', ')}`
      : `all starts match${notes.length ? ` (${notes.join('; ')})` : ''}`,
  )
}

// ---------------------------------------------------------------------------

const urls = declaredUrls()
if (urls.size === 0) {
  console.error('smoke-prod: no absolute URLs found in index.html')
  process.exit(1)
}

// Two tags sharing a URL should cost one request, not two.
const seen = new Set()
for (const [label, url] of urls) {
  if (seen.has(url)) {
    record(true, `${label} ${url}`, 'same URL as an earlier tag, already checked')
    continue
  }
  seen.add(url)
  if (label.includes('image')) await checkImage(url, label)
  else await checkUrl(url, label)
}

// The coverage badge reads this from the deployed site, so a 404 breaks the
// README badge without breaking anything a test can see.
const canonical = urls.get('canonical')
if (canonical) await checkUrl(`${canonical.replace(/\/$/, '')}/coverage.json`, 'coverage.json')

const feed = feedUrl()
if (feed) {
  const ics = await checkFeed(feed)
  if (typeof ics === 'string') checkFeedAgainstSchedule(ics)
}

const failed = results.filter((r) => !r.ok)
for (const r of results) {
  if (QUIET && r.ok) continue
  console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}\n        ${r.detail}`)
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
