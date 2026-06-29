# World Cup 2026 Schedule Viewer

[![CI](https://github.com/ismayc/world-cup-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/ismayc/world-cup-viewer/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/endpoint?url=https://world-cup-viewer.netlify.app/coverage.json)](https://github.com/ismayc/world-cup-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A React + Vite web app showing all 104 matches of the 2026 FIFA World Cup
(USA · Canada · Mexico) in **your** timezone, with where to watch, host
city/stadium, a bracket, group standings, and live results.

🔗 **Live:** https://world-cup-viewer.netlify.app · https://ismayc.github.io/world-cup-viewer/

## Features

- **Your timezone** — kickoff times auto-convert to your detected timezone
  (switchable to 20+), with stadium-local time shown when it differs.
- **Hover for home-country time** — hover a team in any view to see when the
  match kicks off back home; countries spanning multiple time zones (USA, Brazil,
  Australia, …) list each distinct local time.
- **Follow teams** — star any team to highlight it everywhere and filter to a
  one-click "⭐ My Teams" view (saved in your browser).
- **Next-match bar** — a live countdown to the next kickoff (prioritising your
  followed teams, or "Live now"), with a jump-to-match button.
- **Goal alerts** — opt-in 🔔 browser notifications when a goal is scored (scorer,
  minute, and the running score), scoped to your followed teams or all matches.
  Fires while the app is open in a tab (no backend, so no background push).
- **Four views** — chronological schedule, a Sunday–Saturday week calendar,
  group standings, and the knockout bracket.
- **Phone-friendly schedule** — past days collapse to tappable headers by default
  (or hide entirely), so the schedule opens on today's games instead of a long
  scroll.
- **Match detail** — click any match for full venue/time/broadcast info, the live
  status/clock, and a minute-by-minute event timeline (goals ⚽, cards 🟨🟥)
  once a match is underway.
- **How to watch (US)** — English (FOX/FS1) & Spanish (Telemundo/Universo) TV
  and streaming per match; free over-the-air channels flagged.
- **Venues** — all 16 host stadiums with city, country, and region.
- **Filtering** — search, stage, group, team, host country, region,
  city/stadium, timeframe, and broadcast language.
- **Group standings & qualification** — all 12 tables with the official 2026
  tie-breakers (points → head-to-head → goal difference → goals → fair play
  [team conduct / cards] → FIFA World Ranking), who advances, and the 8 best
  third-placed teams. A ⚖️ marker (and a plain-language note below the third-place
  table) explains any placing decided by a soft tie-breaker, showing both teams'
  fair-play or FIFA-ranking values — so e.g. "Ghana above Ecuador" is spelled out.
- **Clinch & elimination detection** — teams are marked 🥇 Won group / ✅ Through /
  ❌ Out the moment the outcome is mathematically guaranteed (an exact
  scoreline-enumeration engine with a sound points-bound fallback, accounting for
  head-to-head and the cross-group third-place race). Shown in the group tables and
  schedule cards, and resolved into the bracket (a clinched "Winner Group X" slot
  fills in everywhere). Clinches are also announced in the score-sync email.
- **"As it stands" Round of 32** — under each group, where its current 1st / 2nd /
  (qualifying) 3rd would land in the knockout, with concrete opponents — like the
  BBC's group pages. The eight qualifying thirds are placed using **FIFA's official
  Annexe C allocation** (all 495 combinations, parsed from the regulations PDF).
  Each projected match number links straight to that tie on the bracket, and the
  whole block can be toggled off.
- **Bracket** — two-sided knockout bracket that fills in as teams resolve. Slots
  still awaiting a result preview the **potential matchup**: a "Winner Match N" box
  shows the two candidate teams of the tie feeding it ("🇲🇽 Mexico / 🇨🇦 Canada"), so
  the Round of 16 reads as pairings rather than "Winner Match N". This cascades
  round by round — and per-slot, the moment each feeder is decided — to the
  quarter-finals, semis, final and third-place play-off.
- **Radial bracket** — a circular view of the knockout bracket: the 32 Round-of-32
  teams ring the outside and each winner advances one ring inward toward the trophy
  at the centre, flags filling in as results land. The finalists meet on the line
  through the trophy, with the third-place play-off just below. Hover a flag for the
  country; tap to open the match.
- **Add to calendar** — per-match `.ics` download, plus a `webcal://`
  subscription feed (all matches or just your teams) that auto-updates.
- **Spoiler-free mode** — hide scores globally, per day, or per match.
- **Light/dark theme** — follows your system preference, with no flash on load.
- **Shareable URLs** — view, timezone, spoiler mode, and filters persist to the
  query string; links unfurl with a title/description preview in chat apps.
- **Accessible** — keyboard-navigable, focus-trapped modals that restore focus on
  close, and screen-reader labels on live/score badges.
- **Live results** — final scores from the [OpenFootball](https://github.com/openfootball/worldcup.json)
  public JSON feed (no API key), merged in and auto-refreshed, with a live
  in-match score + clock (incl. "HT"/stoppage) overlaid from
  [ESPN](https://www.espn.com/soccer/) while games are underway — shown across the
  Schedule, Week, and Bracket views. The Match Detail timeline lists goals and
  cards. Final scores are cross-checked against a third source
  ([TheSportsDB](https://www.thesportsdb.com/)) — each match shows how many
  independent sources confirm the result.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the production build
npm test         # run the Vitest suite
```

Every push runs the tests + build in GitHub Actions; pushes to `main` deploy to
Netlify and GitHub Pages only if they pass.

New to the code? [`ARCHITECTURE.md`](./ARCHITECTURE.md) maps the modules and how
data flows from the static schedule + live feeds through the standings, clinch,
projection and bracket-resolution layers to the views.

## Schedule accuracy

The schedule data is validated against external sources and frozen into
[`test/fixtures/official-kickoffs.js`](./test/fixtures/official-kickoffs.js).
The test suite (75 tests) asserts every match's kickoff (to the minute, in
Eastern Time), venue, knockout-bracket slot, and group-draw assignment matches
the official schedule, plus structural invariants (complete round-robins,
simultaneous final-matchday kickoffs, no team double-booked, valid bracket
references). Sources: the [Wikipedia knockout-stage table](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage)
(kickoffs + bracket), Yahoo Sports & MLSsoccer (group times/venues), and NBC
Sports (group draw).

**Reschedule monitoring.** Because stored kickoffs are static, they're also
re-validated continuously against **FIFA's official data API** (the authority),
with ESPN, TheSportsDB and OpenFootball as corroboration — every group match,
matched by team pair. It runs hourly as a red-build backstop and each morning
(05:00 MST, before kickoff) as an emailed report. If FIFA's time no longer matches
ours, the daily check rewrites both `src/data/matches.js` and the kickoff fixture
to FIFA's time and opens a ready-to-merge PR, so a reschedule (like M32 moving an
hour earlier) can't slip by unnoticed. See `npm run check:schedule`.

Knockout matches are validated too: their teams are placeholders until the bracket
resolves, so they're matched to FIFA by **match number** rather than team pair, and
once a tie's teams are known the secondary feeds provide a consensus fallback if
FIFA is unreachable. A companion check (`npm run check:sync`) verifies the upstream
OpenFootball `cup.txt` / `cup_finals.txt` still name every group and knockout match
under the spellings the result-contribution autofill expects.

## Data sources

- **Schedule, groups, venues** — FIFA Final Draw (Dec 5, 2025) and official
  match schedule (see *Schedule accuracy* above).
- **Broadcast** — FOX Sports / NBCUniversal (Telemundo) US rights.
- **Results (source of record)** — OpenFootball `worldcup.json` (public domain),
  post-match final scores and goal timelines.
- **Live in-match scores** — ESPN's public scoreboard API (free, no API key,
  CORS-open). Used only while a match is underway, or just finished and
  OpenFootball hasn't posted yet; OpenFootball always wins once it has the score.
- **Backup & score cross-check** — [TheSportsDB](https://www.thesportsdb.com/)
  (free, CORS-open, public test key). An independent third source of final
  scores. Final scores are reconciled across all three feeds: each card shows
  "✓ confirmed by N sources", or "⚠ sources disagree" when they don't, and
  `npm run check:feed` reports any mismatch. (worldcupjson.net was evaluated for
  this role and rejected — no 2026 data and no CORS, so a browser-only app can
  neither read nor validate against it.)

### Giving back to OpenFootball

OpenFootball commits results by hand, so it occasionally lags after a match.
`npm run of:edits` reuses the same three-source reconciliation to list finals
that the fallbacks already carry but OpenFootball doesn't yet — printed as
paste-ready `cup.txt` lines (`Home  FT  Away`), ranked by confidence (both
fallbacks agree / one only / they disagree), plus any match where OpenFootball
disagrees with the fallbacks. The maintainer
([openfootball/worldcup.json#23](https://github.com/openfootball/worldcup.json/issues/23))
welcomes edit-in-place fixes; this script tells you exactly which lines to fill
in at [`2026--usa/cup.txt`](https://github.com/openfootball/worldcup/blob/master/2026--usa/cup.txt).
It only reads feeds and prints — it never writes anything.

`npm run of:autofill` is the automated counterpart: it makes the same edits and
commits them to `cup.txt` for you. It's deliberately conservative — by default
only when **both** fallbacks agree on the final (and never when they *disagree*),
and only on a line still reading `Home v Away` (so re-running never double-edits).
Because TheSportsDB often posts finals tens of minutes late, there's an
**ESPN-only fallback**: once a match is ≥150 min past kickoff (≈ full time + ~30
min) and ESPN has confirmed the final while TheSportsDB still hasn't, it syncs on
ESPN alone (the commit/email note it). Half-time and goalscorers come
from ESPN and are written in the file's house style (`Home  FT (HT)  Away` +
scorer block, `(pen.)`/`(OG)` markers, CRLF-safe); if the goals don't reconcile
with the agreed final it writes a valid score-only line. **Knockouts** are
rendered in full — `1-1 a.e.t. (1-0, 1-1), 4-2 pen.` with extra-time-aware
half-time/FT-at-90 and shootout kicks excluded from the scorers; the penalty
tally is taken from ESPN and cross-checked against TheSportsDB when it carries
one (a disagreement, or a knockout whose goals can't be reconciled, is left for
manual review rather than written as a bare score). All of that formatting/placement logic lives in
[`scripts/cuptxt.mjs`](./scripts/cuptxt.mjs) and is unit-tested
([`test/cuptxt.test.js`](./test/cuptxt.test.js)). The
[workflow](./.github/workflows/openfootball-autofill.yml) runs it at ~5-minute
cadence, but **only while matches are finishing** — a coarse `*/15` trigger spins
the job up and it self-loops every ~5 min while "now" is inside a match's
finishing window (late second half through post-match confirmation, see
[`scripts/active-window.mjs`](./scripts/active-window.mjs)); outside those windows
it checks and exits in seconds. Because GitHub's scheduler is unreliable
(it can go ~2h between firings), a loop run also **re-dispatches the next one**
while another window is near, so coverage during a match day is self-sustaining
and doesn't depend on the cron (which is just a backstop); see
[`docs/autofill-scheduling.md`](./docs/autofill-scheduling.md). The scripts use
only Node built-ins + repo source — no `npm ci`. It needs an `OF_PUSH_TOKEN`
secret (push to `openfootball/worldcup`); without it — or with `DRY_RUN=1` — it
previews the edits and pushes nothing.

When the workflow actually commits a new final upstream it emails a notification
(match, commit link, run link). That step uses Gmail SMTP and is gated on a real
push, so it only fires on an actual sync; it needs `MAIL_USERNAME` (a Gmail
address) and `MAIL_PASSWORD` (a [Gmail App Password](https://myaccount.google.com/apppasswords))
as repo secrets, and is skipped if they're absent.

If a **knockout** result can't be auto-synced safely (e.g. ESPN and TheSportsDB disagree on the penalty tally, or the goals don't reconcile), the workflow instead opens a deduplicated GitHub issue assigned to the maintainer — raised once, not every run — so it can be filled in by hand.

See [`NEWS.md`](./NEWS.md) for the changelog.

## Credits

Created by [Chester Ismay](https://chester.rbind.io). Source on
[GitHub](https://github.com/ismayc/world-cup-viewer).

The soccer ball in the app icons and share image is from
[Google Noto Emoji](https://github.com/googlefonts/noto-emoji)
(Apache License 2.0).

## Disclaimer

An unofficial, non-commercial fan project. **Not affiliated with, endorsed by, or
sponsored by FIFA.** “World Cup”, and team, broadcaster, and tournament names are
trademarks of their respective owners. Schedule and results data come from the
public-domain [OpenFootball](https://github.com/openfootball/worldcup.json) project;
live in-match scores come from [ESPN](https://www.espn.com/soccer/); final scores
are cross-checked against [TheSportsDB](https://www.thesportsdb.com/).
