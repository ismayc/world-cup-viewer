# NEWS

A dated changelog for the World Cup 2026 Schedule Viewer. Each heading is a
calendar day; bullet points capture every change made that day (features, fixes,
data/source updates, deployment). Newest day on top.

## 2026-06-11
- **Distinct nav icons:** Schedule, Week, and the Calendar subscribe/export button
  all shared a calendar glyph. Schedule is now `📋`, Week stays `📆`, and the
  Calendar button is `📤` (it's an export/subscribe action), so each is visually
  distinct.
- **Installable (PWA manifest):** added `public/manifest.webmanifest` + app icons
  (192/512/maskable, apple-touch-icon) and linked them in index.html, so the app
  can be added to a phone/desktop home screen and launches standalone (no browser
  chrome) with a branded splash. Relative paths so it works on both Netlify (root)
  and GitHub Pages (sub-path). No service worker / offline yet — install + chrome
  only.
- **OG preview image:** added a branded 1200×630 `public/og-image.png` (+ source
  SVG) and wired `og:image`/`twitter:image` (summary_large_image) so shared links
  unfurl with a picture.
- **Fixed finished match showing as live:** new `liveState()` helper — a match
  ESPN flags is live, a match with a final score is finished even inside the
  time-based window; the clock is only a fallback. Used by MatchCard, MatchDetail,
  NextMatch, and the "Live now" filter (a just-ended game now reads FT immediately).
- **Live state everywhere + richer timeline (app-wide audit follow-up):**
  - Live badge/clock now shows in **Week** and **Bracket** views (was Schedule-only),
    via shared `LiveBadge`/`ScoreCheck` components; Week also gained pens/AET labels
    and the source cross-check badge.
  - **Match status label**: the badge shows ESPN's `shortDetail`, so it reads
    "HT"/"FT" at breaks instead of a frozen clock; **stoppage time** is preserved in
    the clock ("45'+3'") and in goal/card minutes ("45+2'"). (ESPN's feed does not
    expose the *announced* added-time "+4", only elapsed — documented in espn.js.)
  - **Cards & substitutions**: ESPN `details` now parsed into `m.cards`/`m.subs` and
    rendered in the Match Detail timeline (⚽ 🟨 🟥 🔁); "Goals" → "Match events".
  - **"Live now" filter** uses the real `m.live` flag instead of the time-based guess.
  - **Accessibility**: `aria-label`/`role="status"` on live/FT badges, aria-label on
    bracket matches, and a `useModalA11y` hook (focus trap + restore) for both modals.
  - **SEO/social**: description, Open Graph, Twitter card, and theme-color in index.html.
  - **Robustness**: all three fetchers guard `res.json()`; OpenFootball also asserts a
    `matches[]` array so a bad 200 surfaces an error instead of silently showing none.

- **TheSportsDB as a third source + score cross-check:** added
  `src/services/thesportsdb.js` (free, CORS-open, public test key; FIFA World Cup
  league 4429, season 2026) as an independent backup source of final scores.
  Refactored the validator into a source-agnostic `src/services/reconcile.js`
  (`crossCheck`, `annotateScoreChecks`, `reconcileScores`), with each adapter now
  exposing a `*FinalScore` getter (`openFootballFinalScore`, `espnFinalScore`,
  `sdbFinalScore`). The app fetches all three feeds in parallel and annotates
  every final with how many sources confirm it: MatchCard shows "✓ confirmed by
  N sources" or "⚠ sources disagree", and `npm run check:feed` now reports
  three-way disagreements. On-page attribution updated (results bar + footer) to
  credit TheSportsDB as the cross-check. worldcupjson.net stays rejected (no 2026
  data, no CORS).
- **Live in-match scores via ESPN:** added `src/services/espn.js` — a live
  overlay on top of OpenFootball. `fetchLive()` reads ESPN's public scoreboard
  (free, no key, CORS-open) and `applyLive()` overlays the running score + clock
  onto the OpenFootball-merged schedule, keyed by team pair (groups) or kickoff
  instant (knockouts, even before teams resolve). OpenFootball stays the source
  of record: once it has a score, ESPN defers. MatchCard now shows ESPN's real
  clock/HT in the LIVE badge instead of a time-based guess, and the results bar
  shows an "N live now" indicator. App fetches both sources in parallel via
  `Promise.allSettled` so ESPN is best-effort. On-page attribution updated in
  both the results bar and the footer disclaimer.
- **ESPN as cross-validator (not worldcupjson.net):** `reconcileScores()` flags
  matches where OpenFootball and ESPN disagree on a final score; wired into
  `npm run check:feed`. worldcupjson.net was evaluated for this backup/validator
  role and rejected — it returns 2022 data for 2026 queries and serves no CORS
  header, so a frontend-only app can neither consume nor validate against it.
- **Feed-freshness check:** evaluated switching the live-results source to
  worldcupjson.net — rejected, it has no 2026 data (queries return 2022) and
  relies on legacy JSONP, not CORS. Stayed on OpenFootball, whose 2026 data file
  is live and well-formed; the stale README was a red herring. To guard the real
  risk (scores lagging once games start), added `scripts/check-feed-freshness.mjs`
  (`npm run check:feed`): reuses `fetchResults`/`matchKey`/`MATCHES` to flag any
  match that finished ≥ `STALE_HOURS` ago but still has no score in the feed.
  Wired it to a new hourly `feed-freshness` GitHub Action so a lagging feed
  surfaces as a failed run (email) instead of stale scores on the site.

## 2026-06-09

- **Fix "Add to Google Calendar" link:** the Google button built a `cid` from an
  https URL (percent-encoded), which Google rejects with "check the URL". It now
  uses a raw `webcal://` cid (`…/calendar/render?cid=webcal://…`) per Google's
  subscribe-by-URL format, preserving the `?teams=` query for the my-teams feed.
  Extracted `webcalUrl`/`googleCalendarUrl` into `utils/ics.js` with tests.
- **Analysis folder:** added `analysis/worst-hours.mjs` (+ generated
  `worst-hours.csv` and a README) — a side analysis of which countries' fans get
  the worst local hours to watch their group-stage games. Reads the app's data
  modules directly; not part of the build.
- **README refresh:** documented the newer features (home-country hover times,
  follow teams, next-match bar, week view, match detail, calendar subscription,
  theme) and added a "Schedule accuracy" section describing the fixture-based
  validation; added `npm test` and a credits line.
- **Bracket, draw & timezone validation:** verified the knockout bracket wiring
  (all 32 group-position slots, third-place routing, and Winner/Loser-Match
  progression) against the Wikipedia bracket; the group draw against NBC Sports;
  and the team→home-timezone map (valid IANA zones, full coverage). All correct —
  no data changes. Froze the official bracket slots + group draw into the fixture
  and added tests for them plus timezone validity. Suite now 75 tests.
- **Venue audit + consistency tests:** verified all 104 host venues against
  authoritative sources (Wikipedia knockout cities; Yahoo + MLSsoccer by-stadium
  for the group stage) — all correct (a Yahoo article mislabeled Uruguay v Spain
  as Monterrey; it's Estadio Akron, as we had it). Froze the official venue per
  match into the test fixture. Added internal-consistency tests: each group is a
  complete round-robin, final-matchday games kick off simultaneously, no team
  plays twice within 48h, no venue double-books, and every "Winner/Loser Match N"
  reference resolves to an earlier match. Suite now 71 tests.
- **Full kickoff-time audit + regression test:** cross-checked all 104 kickoffs
  against authoritative sources (Wikipedia knockout table; wilx/Yahoo group
  schedules). The group stage (1–72) was already correct. Found and fixed **14
  more knockout games** (75, 79, 81, 82, 85, 87, 88, 90, 92, 93, 94, 96, 100,
  101) whose local wall-clock time had been stored as if it were Eastern Time,
  shifting them 1–3 hours early. Added `test/fixtures/official-kickoffs.js` (the
  official ET kickoff for every match) and tests that assert each match matches
  it to the minute, uses the `-04:00` offset, and lands at a plausible local
  hour — so this class of error can't recur silently. Suite now 65 tests.
- **Fix SoFi knockout kickoff times:** matches 73 (R32, Jun 28), 84 (R32,
  Jul 2) and 98 (QF, Jul 10) at SoFi Stadium were stored 2–3 hours early; all
  three are 12:00 PM PT / 3:00 PM ET per the official schedule (now
  `15:00-04:00`). The five SoFi group games were already correct.
- **CI action upgrades:** bumped GitHub Actions to their Node-24 majors
  (checkout v6, setup-node v6, configure-pages v6, upload-pages-artifact v5,
  deploy-pages v5) ahead of GitHub forcing Node 20 actions to Node 24 on
  2026-06-16.
- **Hover for home-country kickoff times:** hovering a team in any match-context
  view (schedule, week, bracket, next-match bar, detail modal) shows when the
  game kicks off in that team's home-country local time. Countries spanning
  multiple time zones (USA, Canada, Mexico, Brazil, Australia, NZ, Ecuador,
  Spain, Portugal, DR Congo) list each distinct local time; same-clock zones
  collapse. Backed by a new `teamTimezones` map and `teamKickoffTooltip` helper,
  with tests (suite now 61).
- **Footer credit + source link:** footer now credits Chester Ismay
  (chester.rbind.io) and links to the GitHub repo.
- **Now public + second host:** repository made public; the app is also deployed
  to GitHub Pages at https://ismayc.github.io/world-cup-viewer/ (alongside
  Netlify). Build uses a relative base so one artifact works at both a domain
  root and a sub-path; the Pages deploy runs from CI after tests pass.
- **Disclaimer added:** footer and README now state the project is unofficial and
  not affiliated with/endorsed by FIFA, and credit the public-domain data source.
- **Follow teams:** star any team to highlight it everywhere (schedule, week,
  bracket, standings) and filter to a one-click "⭐ My Teams" view. Saved in the
  browser (localStorage).
- **Next-match countdown + jump:** a hero bar counts down to the next kickoff
  (prioritizing your followed teams, or "Live now" when one is in play) with a
  "Jump to it" button that scrolls to that match.
- **Match detail + goal timeline:** click any match for a detail modal with full
  venue/time/broadcast info and a minute-by-minute goal timeline (penalties &
  own-goals flagged) once results are in.
- **Qualification scenarios:** standings now apply the official FIFA tie-breakers
  (points → goal difference → goals scored → head-to-head points/GD/GF among
  tied teams; alphabetical fallback where fair-play/lots data isn't available),
  mark who advances, and rank the **8 best third-placed teams**.
- **Calendar subscription:** subscribe via `webcal://` to an auto-updating feed
  (all matches or just your teams) served by a Netlify Function — it reflects
  resolved knockout teams and scores as they happen. Plus one-time `.ics`
  downloads (all / current filter / my teams) and a Google Calendar link.
- **Light/dark theme:** a theme toggle (defaults to your system preference) with
  no flash on load.
- **Collapsed filters by default:** the whole filter/search panel (search, stage
  chips, dropdowns) is now hidden behind a compact "⚙ Filters & Search" toggle so
  the schedule is front-and-center. The toggle shows an active-filter count with a
  "Clear all" shortcut, and the panel auto-opens when a shared URL already has
  filters applied.
- **Mobile-friendly:** responsive pass for phones/tablets — match cards stack,
  the filter panel stops sticking, the view switcher scrolls horizontally,
  search and selects go full-width (with 16px text to stop iOS zoom-on-focus),
  standings collapse to one column, and week/bracket grids scroll. Bigger tap
  targets throughout.
- **Tests + CI/CD:** added a Vitest suite (44 tests, since grown) covering data integrity,
  the search parser, results merge/parsing, week/time/ICS/standings utils, and a
  jsdom render smoke test for every view. Wired up GitHub Actions: every push/PR
  runs tests + build, and pushes to `main` deploy to Netlify only if tests pass.
- **Fix:** resolved a blank/black page caused by a missing `useState` import in
  the Filters component (a runtime crash the production build didn't catch — now
  guarded by the render smoke test).
- Initial release of the World Cup 2026 Schedule Viewer (React + Vite).
- **Schedule:** all 104 matches with kickoff auto-converted to the viewer's
  timezone (detected via `Intl`, switchable to 20+ zones); stadium-local time
  shown when it differs.
- **Venues:** 16 host stadiums across the USA, Canada, and Mexico, each with
  city, country, and FIFA region.
- **How to watch (US):** per-match English (FOX/FS1) and Spanish
  (Telemundo/Universo) TV + streaming options, with free over-the-air channels
  flagged.
- **Filtering:** search; stage chips; group, team, host country, region,
  city/stadium, timeframe (live/upcoming/finished), and broadcast-language
  filters; reset.
- **Scoped search:** the search box understands `field: value` syntax —
  `team: Mexico`, `city: Dallas`, `stadium: SoFi`, `country: Canada`,
  `group: C`, `stage: Final`, `region: Western` — and combines multiple tokens
  (`team: Brazil stage: group`). Plain text still does a broad match. One-click
  example chips make the syntax discoverable.
- **Collapsible search:** the search box is hidden behind a 🔍 Search toggle by
  default; opening reveals the input + example chips, closing clears the query.
  A query restored from the URL opens it automatically.
- **Add to calendar:** per-match `.ics` download (UTC times, venue, broadcast
  info) for Apple/Google/Outlook calendars.
- **Bracket view:** two-sided knockout bracket (R32 → Final) plus third-place
  match; fills in real teams as the knockout resolves.
- **Week view:** a Sunday–Saturday calendar laid out as 7 day-columns, with
  matches color-coded by group (and a color for knockout games), plus prev/next
  week navigation and a color legend. Respects active filters and spoiler mode.
- **Group standings:** all 12 group tables (P/W/D/L/GF/GA/GD/Pts) computed from
  results; top-two highlighted as qualifying.
- **Spoiler-free mode:** hide scores globally, per day, or reveal a single
  match; standings respect it too.
- **Shareable state:** active view, timezone, spoiler mode, and all filters
  persist to the URL.
- **Live results:** scores fetched from the OpenFootball public JSON feed (no
  API key), merged into the schedule immutably; knockout placeholders resolve to
  real teams. Manual refresh + optional 2-minute auto-refresh.
- **Deployment:** private GitHub repo `ismayc/world-cup-viewer`; hosted on
  Netlify at https://world-cup-viewer.netlify.app.
