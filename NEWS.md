# NEWS

A dated changelog for the World Cup 2026 Schedule Viewer. Each heading is a
calendar day; bullet points capture every change made that day (features, fixes,
data/source updates, deployment). Newest day on top.

## 2026-07-14
- **Golden Boot: click a player for their match-by-match breakdown.** A popup
  lists every match their team has contested: opponent, oriented result (W/D/L,
  shootouts noted), each goal with its minute (and pen flag) from the merged
  feeds, plus per-match assists and minutes via ESPN's summary endpoint —
  fetched on open and cached forever once a match is final. Minutes are derived
  from starts and substitution events (labelled approximate); DNP marks a squad
  member who didn't play, and a live match shows "—" for minutes (still
  running). Clicking a row opens the full match detail. Merged matches now
  carry `espnId` (the summary handle) from the ESPN overlay.
  (`PlayerDetail`, `services/espnMatchStats.js`.)
- **Golden Boot goes (close to) real-time.** Goals already tracked the 30-second
  live poll; now the official tie-breakers do too: assists can only change when
  a goal is scored, so any change in the total goal tally force-refreshes the
  ESPN extras (skipping the 15-min cache), plus a 5-minute interval keeps
  minutes played current while a match is live. Athlete names are cached
  permanently (they never change), so refreshes cost roughly half the requests
  of a cold load — and the initial load no longer double-fetches while the
  feeds are still arriving.
- **Golden Boot: ● marks players in action right now.** A pulsing red dot next
  to anyone whose team is playing at this moment (during the France–Spain semi:
  Mbappé, Dembélé, Oyarzabal) — their tally can still change today. Replaces
  the narrower "includes a live goal" marker.
- **Radial: give "ROUND OF 32" breathing room.** The label was touching the two
  spokes flanking the top seam (half-width ~42 SVG units vs spokes at ±41.8).
  Smaller size + tighter letter-spacing brings it to ~7 units of clearance per
  side, measured via getBBox in the browser. (Reported by Chester.)
- **Radial: four upgrades for the closing week.** (1) Eliminated teams' flags
  fade while the tournament is on (driven by `activeTeams` — nothing dims once
  the Final is done, and third-place participants stay vivid until Saturday);
  (2) matches playing TODAY get a soft pulsing halo behind their match number,
  and unplayed ties show their kickoff time where the score will land; (3) once
  the Final is decided the champion's entire route from the outer ring to the
  trophy lights up gold (auto, unless a manual "Path to the Final" pick is
  active); (4) faint round labels ("ROUND OF 32" … "SEMI-FINALS") run down the
  clear seam at the top of the circle so the geometry explains itself.
- **Fix: the tale of the tape is now historically accurate.** Opening a PAST
  knockout tie (e.g. Argentina–Egypt in the R32) showed the teams' records
  TODAY ("6–0–0") under "Tournament so far" — wrong for that moment. A played
  match now computes each record as of its kickoff (strictly-earlier matches
  only, so simultaneous group finales and the match itself stay out) under the
  heading **"Going into this match"**; upcoming matches keep "Tournament so
  far". Spotted by Chester on the Argentina v Egypt detail.
- **Goal alerts: on-page toasts + click-to-open notifications.** Every new goal
  now raises an in-app toast (top-right; scorer, minute, live score; click
  opens the match, ✕ or ~8s dismisses) alongside the browser notification —
  the OS often mutes notifications for the tab you're actively watching, and
  toasts also work when permission was denied, so enabling goal alerts no
  longer requires it (the permission is still requested so the OS channel
  joins when allowed). Clicking a browser notification now focuses the app
  and opens that match's detail. Same detection pipeline, dedup, and flood
  suppression for both channels. (`GoalToasts`, `App.jsx`.)
- **Stats tiles drill down.** The EXTRA-TIME GAMES and SHOOTOUTS tiles are now
  buttons: clicking lists the matches behind the number (stage, tie, decisive
  score, and "after extra time" / the shootout score), each row opening the
  full match detail. The extra-time list notes how many of its ties went all
  the way to penalties; tiles disable when the count is 0.
  (`extraTimeMatches` / `shootoutMatches`, `StatsView`.)
- **Golden Boot: bold the scorers still in the tournament.** Players whose team
  has a match left (or in play) render bold — their tally can still grow; the
  rest are frozen where they finished. Data-driven (`activeTeams`: any real
  team in a not-yet-final match), so third-place losers stay bold until the
  play-off ends and nobody is bold after the Final. A legend line appears only
  while the table has both kinds. Today that's Messi & Mbappé — 1st and 2nd,
  both still playing — plus Bellingham, Kane, Dembélé and Oyarzabal.
- **Golden Boot now ranks by the official award criteria.** ESPN's core API
  (keyless, CORS-open — verified) exposes per-athlete season totals, so the
  Boot table pulls assists AND minutes played for everyone in ESPN's goals or
  assists leader lists and orders the race exactly as the award would: goals,
  then most assists, then FEWEST minutes. New A / Min columns; the results are
  cached in localStorage (15 min TTL) so the ~100 small first-open requests
  happen once; everything is best-effort — if ESPN is unreachable the table
  falls back to the previous goals-then-fewest-pens ordering. It matters
  today: Mbappé (8 goals, 3 assists) actually leads Messi (8, 2).
  (`services/espnStats.js`, `applyBootExtras`.)
- **Fix (properly): the ⚖️ tie-break marks render as "?" on some devices.** The
  emoji font stack shipped this morning didn't help the affected device — its
  font chain has no U+2696 glyph at all. The markers (Best-thirds table, tie
  note heading, Scenarios) are now an inline SVG scales icon (`ScalesIcon`),
  drawn in gold via currentColor — a vector can't fall back to "?".
- **New "👟 Stats" tab: Golden Boot race + tournament totals.** A top-scorers
  table built from the merged goal data (OpenFootball for finished matches, ESPN
  for live ones): top 15 with ties never split, shared ranks for level scorers,
  penalty counts noted, own goals excluded, and a pulsing dot on any tally that
  includes a goal from a match still in play. Diacritic spellings from the two
  feeds ("Julián"/"Julian") merge into one player. Above it, a totals strip:
  matches played, goals, goals per match, extra-time games, shootouts. Hidden
  behind a reveal in spoiler-free mode. (`StatsView`, `utils/tournamentStats.js`.)
- **Tale of the tape in the match detail for knockout ties.** Once both slots
  hold real teams, the detail popout compares their tournaments side by side:
  W–D–L (shootout wins noted), goals scored/conceded, goal difference, clean
  sheets, cards (best-effort, ESPN feed) and FIFA ranking — ready for today's
  France–Spain semifinal. Spoiler-free mode keeps it behind its own reveal.
- **Champion finale, shipped before Sunday.** The moment the Final is FINAL
  (not merely live), a gold confetti banner crowns the winner under the header
  (click opens the Final; hidden in spoiler-free mode; confetti respects
  reduced-motion), and the Radial view lights up — glowing trophy, 👑, and the
  champion's name in gold at the centre. Verified end-to-end by replaying a
  simulated completed tournament through the real feed pipeline.
- **Fix: ⚖️ tie-break marks rendering as "?".** The scales emoji (U+2696) is
  missing from some devices' default font chain, so the two marks in the Best
  third-placed table (Ghana/Ecuador, split on fair-play points) showed as bare
  question marks. Marker glyphs now pin an explicit color-emoji font stack
  (`.tiebreak-mark` / `.emoji-glyph`).

## 2026-07-01
- **No premature "Delayed" badge at kickoff.** ESPN flips a match to
  `STATUS_DELAYED` right at the scheduled hour, but kickoff normally happens a
  few minutes after it. An ESPN "Delayed" within 5 minutes of the scheduled
  start is now treated as pre-match (the countdown stays; no amber badge, no
  provisional score) — a real delay outlives the window and shows as before.
  Suspensions are never suppressed. (`applyLive` in `services/espn.js`.)

## 2026-06-29
- **Radial view: tidy the third-place label.** The match number ("M103") now sits
  below the `· vs ·` matchup, rendered smaller (faint match-number style, mirroring
  the inner matchups), instead of trailing the "Third place" heading. The score
  shifts down accordingly so it tucks just under the number. (`RadialBracket`.)

## 2026-06-28
- **Schedule collapses each completed round, not just the group stage.** The
  group-stage-hiding was generalized: once every game in a stage is final it drops
  out of the Schedule by default — group stage, then Round of 32, Round of 16,
  quarter-finals and semi-finals as each wraps up — with a per-stage note ("Round
  of 32 complete — N Round-of-32 games hidden · Show Round-of-32 games") to bring it
  back via the stage filter. Reusable `stageArchived` helper; the Final and
  third-place play-off are never auto-hidden.
- **"Delayed" instead of a false "LIVE" once past kickoff.** When a match is inside
  its scheduled window but ESPN isn't ticking minutes yet (kicked off late — e.g. a
  weather/lightning hold), the schedule card, match detail, Next-match bar and the
  day/group pop-ups now read **"⏸ Delayed"** rather than a bare "● LIVE". The moment
  ESPN starts the clock, the live minute takes over as before. (ESPN-confirmed live
  and ESPN-flagged delays were already handled; this covers the past-kickoff-with-
  no-feed gap.) Tests updated.
- **New “Radial” bracket view.** A circular rendering of the knockout bracket: the
  32 Round-of-32 teams sit on the outer ring and each match’s winner advances one
  ring inward toward the trophy at the centre, so the flags progress along the
  spokes as results land. Drawn as a true radial bracket (straight radial spokes +
  ring-hugging bars) so the structure reads at a glance; the two finalists meet on
  the horizontal line through the trophy, and the third-place play-off sits just
  below it. Hovering a flag names the country; tapping opens the match. New tab
  beside Bracket. (`RadialBracket`, +3 tests.)
- **Groups: explain the soft tie-breakers among the third-placed teams.** A note
  below the Best third-placed table now spells out each adjacent pair of thirds that
  finished level on points, goal difference AND goals scored — where the order came
  down to a criterion whose value isn't in the table. It names the higher team and
  shows the deciding values: fair-play points (cards) if those differ, otherwise
  FIFA ranking. So e.g. "Ghana finished above Ecuador … broken by fair-play points"
  is explained, not just flagged with the ⚖️ marker. Driven off the ranked thirds,
  so it reflects whatever the live data produces.
- **Bracket: show potential matchups for unresolved slots.** A "Winner/Loser Match
  N" slot now expands to the two teams of the tie it feeds from — rendered
  "🇲🇽 Mexico / 🇨🇦 Canada" — as soon as that source tie has both real teams. So the
  Round of 16 reads as potential matchups (each side a candidate pair, with a "vs"
  on its own line between the two pairs of an all-four-teams box) instead of cryptic
  "Winner Match N" labels. The expansion is round-agnostic and per-slot: it cascades
  to the QF, SF, Final and third-place play-off as each round's teams are confirmed,
  and a side populates the moment its own feeder resolves (no waiting for the rest of
  the round). The "vs" between pairs is wide-layout only; the tall mobile rows keep
  the slash. Locked in with cascade + partial-completion regression tests.
- **Knockouts have started — retired the group-stage tools and tidied the Schedule.**
  Scenarios + R32 Outlook now auto-hide the moment every group game is final (the
  `groupStageArchived` gate dropped its 24-hour grace period — it was a leftover
  that delayed the handover). On the Schedule, the now-complete group games are
  hidden by default once the stage is archived, with a one-line note and a "Show
  group games" link to bring them back. Group-stage tests updated to the no-grace
  rule.
- **Knockout coverage for the live drift guards (`check:schedule`, `check:sync`).**
  - `check:schedule`: when FIFA (the authority) is unreachable, resolved knockout
    ties now fall back to the same two-feed consensus the group path uses — keyed by
    each tie's resolved team pair (from OpenFootball), corroborated by ESPN /
    TheSportsDB / OpenFootball — instead of going dark on the knockouts. FIFA still
    wins whenever it has a time; a lone dissenting feed is a note, never a drift.
  - `check:sync`: now also validates `cup_finals.txt` — every knockout `(NN)` line is
    present (catches an upstream restructure), and once a tie's teams resolve, the
    pairing is verified locatable under our `cupName` aliases (the exact lookup the
    autofill does). A resolved tie upstream hasn't named yet is reported as info, not
    a failure.
  - Added a propagation-level guard that a **live** knockout never advances the
    bracket — even one with a leading score — until full time, plus unit coverage for
    the new schedule fallback.
- **Group stage complete — froze the final results + official R32 draw.** Added
  Groups G–L to `test/fixtures/final-group-results.js` (all 12 now locked) and
  filled `OFFICIAL_R32` with FIFA's published Round-of-32 draw, sourced from
  OpenFootball and cross-checked by `check:bracket` (0 divergence). The
  `final-standings` test's R32-draw assertion is now active: it replays every
  frozen group result through the ranking engine and confirms our `resolveBracket`
  reproduces the official draw exactly, with no placeholder slots left — a static
  regression anchor independent of the live feed. Verified: Scenarios + R32 Outlook
  tabs auto-archive >24h after the last group kickoff. 726 tests green.
- **Fix: handle knockouts decided in extra time (no shootout).** A knockout won in
  ET has a *level* 90-minute score (`ft`) with the decider in `et`; the results
  ingestion was using `ft`, so an ET-decided tie would read as a draw with no
  pens → `decideMatch` returned null and the winner never advanced (the whole
  downstream bracket would stall). Now `applyResults` / `openFootballFinalScore`
  prefer `score.et` when present (and `parseScore` keeps it). The `.ics` calendar
  feed likewise now shows the ET/penalty result instead of the level 90-min score.
  New tests cover the ET-without-shootout path. (Penalty shootouts already worked;
  this closes the ET-only gap.)
- **Knockout-propagation sanity check (real data).** Confirmed R32 results feed the
  bracket correctly through to a champion on the actual frozen results — winners
  land in the right R16 slots, the penalty-shootout path resolves draws, and SF
  losers route to the 3rd-place play-off, with 0 unresolved knockout slots. Added a
  `bracket-resolve` test that replays the real R32 (incl. a Mexico–Ecuador shootout)
  up the bracket (the existing end-to-end test used a synthetic group stage). 727
  tests green.

## 2026-06-27
- **Week view: per-day "all matches" pop-up.** Each date header with matches now
  has a small ⤢ button that opens a pop-up listing every match scheduled that day
  as compact rows (kickoff time, both teams, score/live status, stage, venue/city).
  Each row drills into the existing full match-detail modal. Respects the
  timezone and spoiler-free mode (reveal toggle). Empty days have no button. New
  `DayMatchesModal` (reuses the modal + match-row patterns); WeekView tests added.
- **R32 Outlook: drop the bounds-based "<1%" tags (they over-claimed).** The "<1%"
  margin extras came from `reachableThirdSets`, a SAFE over-approximation for
  *demoting* a lock but one that *over-claims* when used to *add* a candidate — it
  surfaced e.g. "Austria <1% vs Switzerland (M85)" even though the exact margin
  enumeration never places Austria there at ANY goal difference (checked to ±14).
  It also left a dead "<1%" link after the panel was removed. Now the exact
  goal-difference grid is the sole source of truth for who can fill each slot; the
  bottom panel keeps only the exact-`eliminationCheck` "still alive beyond the
  enumerated ±cap" net (with its goal-difference "needs N of these" requirements),
  which is empty under current standings. Removed `reconcileLocks` and the unused
  `aliveSlots` plumbing from the worker/component/snapshot.
- **R32 Outlook: drop the redundant "Matchup not yet fixed" box.** Now that the
  bracket grid shows each team's real goal-difference-resolved percentage in every
  slot it can reach (e.g. Ecuador 94% vs Mexico / 6% vs the Group K winner, both
  visible in the grid), the bottom box duplicated a slice of that — and only an
  arbitrary one: it listed solely third-placed teams whose Annexe C opponent maps
  to ≥2 winners, while ignoring the many winners/runners-up with equally unfixed
  matchups. Removed it; the panel now only appears for the rare "still alive beyond
  the enumerated ±cap margins" case (a goal-difference net), which is otherwise
  empty. Snapshot generator updated to match.
- **R32 Outlook: enumerate goal differences for real GD-resolved percentages.**
  The Outlook enumerator no longer collapses every game to a one-goal scoreline;
  it now walks each remaining game's **goal-difference margin** over an adaptive
  range (±8 by default), so goal-difference tie-breakers resolve with actual
  proportions. Bubble teams that the one-goal model showed at 0%/"<1%" (Scotland,
  Ecuador) now get **real percentages** in every slot they can reach. Made
  tractable by per-group **weighted dedup**: each group's games are enumerated
  locally and margin combinations producing identical (winner, runner-up, third
  profile) collapse into one weighted outcome; the cross-group step walks the
  distinct cartesian (≈1.5M here) accumulating weights. Adaptive cap auto-lowers
  if the cartesian gets too big; goals-scored follows a goals=margin convention
  (tiny residual blind spot only on GD ties). The exact "still alive" net still
  catches anything needing a swing beyond the cap, flagged "<1%". Correctness test
  rewritten to brute-force the margin space independently and match exactly.
  Repro: `node scripts/outlook-snapshot.mjs` writes a self-contained preview HTML.
- **R32 Outlook: surface alternative opponents for ALL thirds, not just Scotland.**
  A qualified third (e.g. Ecuador) could be pinned by the one-goal model to a single
  group winner even though its FIFA Annexe C matchup can still shift if the set of
  eight qualifying thirds changes. Now the margin-aware reachability is applied to
  every third: any third slot a team can reachably fill but isn't shown in gets the
  team as a "<1%" tag (and that slot is no longer shown clinched), and a new
  "Matchup not yet fixed" sub-section lists each on-course third with all the group
  winners it could still face. `aliveR32Slots` now also gates on a team actually
  being able to finish 3rd in its group (fixes a latent case where group winners
  were attributed their group's third slots). The panel is reorganised under
  "Beyond the one-goal model" with two sub-sections (still-alive vs matchup-not-
  fixed). reconcileLocks generalised + tests updated.
- **Fix: sensible requirements for a team whose own group is still playing.** The
  "needs N of these" checklist used a team's *best reachable* third-place profile,
  which for a team still mid-group meant a cap-inflated blowout — producing nonsense
  like "needs 0 of 3 … GD below +6" for Uzbekistan. Now the fixed checklist is used
  only when the team's group is FINISHED (profile settled — e.g. Scotland). When the
  group is still live, points/GD aren't fixed, so it's framed as the two-step goal-
  difference race instead: "finish 3rd in Group K, then — as a 3-point third — win
  the GD race with the other 3-point thirds; the bigger the win, the better," plus
  the still-unresolved groups that can shift the cut. New test.
- **R32 Outlook: "needs N of these" goal-difference checklist for live teams.**
  Under each still-alive (margin-dependent) team, the panel now spells out what it
  needs to advance: if its own group is still playing, finish 3rd there first; then
  "needs at least N of these M" rival groups' third-placed teams to finish at/below
  it, each stated in goal-difference terms (e.g. "Group G's third must finish on
  fewer than 3 points, or on 3 with a goal difference worse than −3"). New
  `advancementRequirements` / `allAdvancementRequirements` in `eliminationCheck.js`
  classify every other group as forced-above / forced-below / in-the-balance using
  the team's best reachable third profile, and 8-advance arithmetic gives the
  "at least N" count. Surfaced via the Outlook worker. New test.
- **R32 Outlook fix: don't show a slot "clinched" while a live team can reach it.**
  The Outlook's ✅ "locked" badge came from the one-goal enumeration, which
  excludes margin-dependent survivors — so a third-place slot could read 100% /
  clinched (e.g. Ecuador vs Mexico) even though a still-alive team (Scotland)
  could mathematically still land there. New `reconcileLocks` cross-checks each
  one-goal lock against the exact margin-aware reachability (`reachableThirdSets`
  via the worker's `aliveSlots`) and demotes any third slot a still-alive team can
  reach to ">99% / <1%" instead of a false ✅. Winner/runner-up slots unaffected.
  "Every matchup set" now also requires nobody left alive-but-hidden. (The Bracket
  page already used the margin-aware lock, so it was already correct.) New tests.
- **R32 Outlook: show where margin-dependent teams would play + "<1%" tags.**
  The "Still mathematically alive — but margin-dependent" panel now lists, for
  each team, the Round-of-32 matchup(s) it would land in if it advanced —
  resolved via the FIFA Annexe C reachable third-place combinations (a third's
  slot isn't fixed, so every still-possible winner it could face is shown, with
  the opponent resolved to a real team once that group winner is locked). Those
  same teams now also appear in the bracket grid on the relevant third-place
  slot tagged "&lt;1%" (a dotted link that jumps to the note), so they no longer
  silently read as absent. New `thirdPlaceR32Slots` / `aliveR32Slots` in
  `eliminationCheck.js` (reusing `reachableThirdSets` + Annexe C), surfaced
  through the Outlook worker. New test covers Scotland's reachable slots.
- **Best third-placed table: live-aware status + blinking dot.** The completion
  marker is now three-way — `final` (all group games truly played), `in play` (a
  group match is live right now, so the position is provisional), or `to play`
  (games still to come) — fixing the case where a live final-matchday game made a
  line read "final." In-play rows also get the same blinking red live dot as the
  group tables (gold if the match is delayed/suspended). Status no longer keys off
  `groupComplete` (which counts a live score as complete); it inspects each group's
  matches directly. New standings test covers the live case.
- **Best third-placed teams table: completion markers + in-contention teams.**
  Each row now carries a "final" (all group games played → line locked) or "to
  play" (group still in progress → provisional) marker, so it's clear at a glance
  which thirds are settled. Added a "Still in contention" section listing teams
  currently 4th in a group that's still playing and not yet eliminated — they can
  still climb into 3rd but the static 12-row table of *current* thirds would
  otherwise hide them (e.g. Uzbekistan). Contenders are gated on the group having
  kicked off and `clinch !== 'eliminated'`, shown unranked and visually distinct.
  Two new tests in `standings.test.jsx`.
- **Exact "still alive" check + R32 Outlook panel.** The Outlook enumerates
  outcomes under a one-goal convention (every remaining game modelled 1–0/1–1/0–1,
  since goals are unbounded), which silently drops a bubble third-placed team whose
  only survival paths need real goal-difference swings — so a team like Scotland
  (3 pts, −3 GD) showed 0% and vanished even though it is **not** eliminated. New
  `src/utils/eliminationCheck.js` answers elimination objectively instead of by
  proportion: it enumerates each group's remaining **scorelines** (not just W/D/L)
  up to a generous goal cap — reusing clinch.js's exact engine — and applies the
  full FIFA third-place comparator (points → GD → goals → conduct → FIFA ranking).
  Groups being independent, a team's best path is found by optimising each group on
  its own, so it's exact and cheap. The Outlook worker now also returns the exact
  survivors, and `OutlookView` shows a **"Still mathematically alive — but
  margin-dependent"** panel listing any non-eliminated team the one-goal model
  omits, with an explanation. Reuses the goal-cap/scoreline helpers from clinch.js
  (now exported). New `test/elimination-check.test.js` (7 tests): a frozen
  "Scotland alive" scenario proving the exact check and the one-goal enumeration
  disagree, a flip-to-eliminated case, and a full-stage cross-check against
  `computeQualification`'s best-8. All 713 tests green.

## 2026-06-26
- **Durable bracket-consistency guard (GitHub Actions, not a session job).** New
  `scripts/check-bracket-consistency.mjs` (`npm run check:bracket`) compares OUR
  Annexe-C/tie-breaker `resolveBracket` against the knockout teams OpenFootball has
  resolved from the official draw/results — and fails (→ the hourly `feed-freshness`
  workflow emails the maintainer) on any divergence. Self-gating: it only checks
  already-resolved knockout sides, so it does nothing before the draw and lights up
  as matches finish (the "end of match" trigger). Wired into `feed-freshness.yml`
  alongside the existing check:sync/feed/schedule guards. Currently: 3 resolved R32
  matchups checked, 0 divergences. (Replaces the fragile session-only self-check.)
- **Knockout readiness.** Froze Groups D, E and F final results into
  `final-group-results.js` (orders re-verified by hand against points/GD/head-to-head
  — A–F now locked; G–L pending their final matchday). Ran the FIFA-anchored
  schedule check: 0 drift / 0 venue mismatch across all 72 group + 32 knockout
  matches. Added a full end-to-end bracket test that plays every knockout round to
  a single champion — including penalty shootouts feeding the next round and the
  semifinal losers routing to the third-place play-off — so the propagation is
  proven before live games hit it.
- **Old `/outlook.html` URL redirects to the in-app R32 Outlook tab.** A static
  `public/outlook.html` (copied verbatim, so it doesn't reintroduce the multi-page
  build) redirects to `./?view=outlook`, so existing links/bookmarks to the removed
  standalone page land on the R32 Outlook view. Works at both the domain root
  (Netlify) and the `/world-cup-viewer/` sub-path (GitHub Pages).
- **Bracket fills a locked third-place opponent early.** The bracket only dropped
  third-placed teams into their "3rd X/Y/Z" R32 slots once the *entire* group stage
  was final — so e.g. USA vs Bosnia stayed half-resolved (USA shown, opponent a
  placeholder) even though Bosnia was already mathematically locked. New
  `resolveLockedThirdSlots` fills any third slot whose team is locked across every
  still-reachable outcome (same exact analysis as the team pop-up's clinch check),
  independent of whether that slot's winner side is decided yet, while leaving
  genuinely-undecided thirds as placeholders. Audited the other completion gates:
  all in-app views flow through `resolveBracket` (consistent); the remaining
  `allComplete`/`completion` uses are honest *provisional labels* backstopped by
  the exact clinch badges, not under-claiming resolution. +2 tests.
- **R32 Outlook lists every possible team per spot.** Removed the top-6 cap and the
  "+N more" roll-up — each open Round-of-32 slot now shows the full set of teams
  that can fill it, each with its exact share.
- **Nav wraps to two rows on mobile; R32 Outlook is now an in-app tab.** The view
  bar no longer scrolls horizontally on phones (which hid Bracket) — it wraps after
  Groups into a second row: Schedule · Week · Groups / Scenarios · R32 Outlook ·
  Bracket (desktop keeps one row). R32 Outlook moved from its standalone
  `/outlook.html` page back into the app as a tab (`OutlookView`, same exact Web
  Worker enumeration; re-runs only when group results change, not on every live
  poll); the separate page and multi-page build were removed. Scenarios and R32
  Outlook (group-stage tools) drop out of the nav a day after the last group game
  via `groupStageArchived`. +4 tests.
- **⚖️ marker when a placing is decided by cards / FIFA ranking.** A placing that
  comes down to a *soft* tie-breaker — fair-play conduct (cards) or FIFA ranking,
  once points, head-to-head, goal difference and goals are all level — now shows a
  ⚖️ next to the team, with a tooltip naming the decider (and noting card data is
  best-effort). Shown on the **Groups standings** tables, the **Best third-placed
  teams** table (cross-group, no head-to-head), and the **Scenarios** projected
  tables. New `utils/tiebreakNotes.js` (`softTiebreaks` mirrors the qualification
  engine's exact clustering so it flags only genuine 7th/8th-criterion splits;
  `softThirdTiebreaks` for the thirds race). +5 tests.
- **Scenarios: clearer confirmed-matchup mark + confirm all once fully set.** The
  "Projected Round of 32" lines now use a bare ✔️ (with an accessible label) instead
  of the "✓ Matchup confirmed" text, which was ambiguous about which side was fixed.
  Also fixed under-confirmation: a matchup is now confirmed from EITHER side of the
  tie (so a third-placed team's line confirms via its winner opponent), and once
  every group is decided the whole bracket is fixed so all matchups show confirmed.
- **Fix: R32 Outlook third-place proportions were wrong (found by new tests).**
  Added an independent brute-force reference enumerator and cross-checked it
  against `enumerateOutlook` on small fixtures — which exposed two bugs in the
  third-place ranking: it sorted thirds *ascending* (taking the worst 8 instead
  of the best 8) and skipped the conduct/FIFA-ranking tie-breakers the
  qualification engine uses. Winner/runner-up slots and the Groups/Scenarios tabs
  were unaffected; only the standalone Outlook page's third-slot shares were off.
  Now ranks thirds identically to `computeQualification` (verified: USA→Bosnia
  locks at 100% over all 4,782,969 outcomes). +5 correctness tests (exact match
  vs the reference, slot-eligibility invariants, rational-share checks).
- **Scenarios: "✓ Matchup confirmed" on locked projected R32 ties.** As you set
  results on the Scenarios tab, any "Projected Round of 32" line whose matchup can
  no longer change (the opponent is mathematically locked given the picks so far)
  now gets a green ✓ Matchup confirmed badge, reusing the exact `lockedOpponent`
  logic. +1 test.
- **"R32 Outlook" moved to its own page with EXACT enumeration (Web Worker).**
  Replaced the in-app tab (and its Monte-Carlo estimate) with a standalone page at
  `/outlook.html`, linked from the footer. It now walks **every** remaining
  win/draw/loss combination of the group games — at a full final matchday that's
  3¹⁴ = 4,782,969 outcomes — in a Web Worker (progress bar, ~20–40s), so the
  percentages are the exact share of scenarios, not a sample. Each open R32 slot
  lists its candidate teams with % bars; mathematically locked spots show ✅ 100%.
  Guarded to only run when the field has narrowed enough to enumerate (≤ 14 games
  left); otherwise it reports the (astronomical) outcome count and waits. New
  `utils/outlookEnum.js` + `workers/outlook.worker.js` + `outlook/` page, Vite
  multi-page build. Replaces the removed `bracketOdds`/`BracketOddsView`. +5 tests.
- **Scenarios tab: exact scorelines + "possible orders" count.** Two upgrades to
  the what-if tab. (1) Each picked game now has − / + goal steppers (the W/D/W
  buttons set a one-goal default), so goal-difference tie-breakers resolve exactly
  instead of by assumption. (2) Each in-play group header shows how many distinct
  final standings are still reachable given the results set so far ("5 possible
  orders" → "order decided"), via an exact enumeration of the remaining games
  (`possibleOrderings`, with a budget fallback for groups with many games left).
  +3 tests.
- **New "Scenarios" (what-if) tab.** A deterministic explorer — no predictions.
  Pick the result (W / D / W) of each remaining group game and the projected group
  standings and Round-of-32 recompute live from exactly those outcomes. Each
  still-in-play group gets a card with its remaining fixtures, the projected order
  (advancers highlighted, third place flagged), and an "as it stands" R32 line per
  qualifier; the third-place/opponent lines update across groups as more results
  are set. Built on the existing qualification + projection engines (no new data),
  with a note that goal-difference tie-breakers assume a one-goal margin. New
  `utils/scenarios.js` + `components/ScenariosView.jsx`. +5 tests.

## 2026-06-25
- **Locked Group A final standings.** All six Group A matches complete and
  cross-verified against two independent sources (OpenFootball + web search via
  Yahoo Sports / CBS Sports / Bolavip). Final order: **Mexico** 1st (9 pts, GD +6,
  swept all three games with clean sheets), **South Africa** 2nd (4 pts, GD −1),
  **South Korea** 3rd (3 pts, GD −1), **Czechia** 4th (1 pt, GD −4). South Africa
  and South Korea separated on points alone; no tie-breaker needed. Frozen in
  `test/fixtures/final-group-results.js`.
- **Locked Group C final standings.** All six Group C matches are complete and
  verified against two independent sources (OpenFootball + ESPN). Final order:
  **Brazil** 1st (7 pts, GD +6), **Morocco** 2nd (7 pts, GD +3), **Scotland**
  3rd (3 pts, GD −3), **Haiti** 4th (0 pts). Brazil and Morocco each went W2 D1;
  goal difference separates them. Scotland advance provisionally as a best
  third-placed team pending the other groups. Frozen in
  `test/fixtures/final-group-results.js`.

## 2026-06-24
- **Exact knockout-opponent clinch (no longer over-conservative).** The team
  pop-up previously only ever called a Round-of-32 matchup "confirmed" once *all*
  groups had finished — which wrongly kept real locks (e.g. USA vs Bosnia) labeled
  "provisional" while other groups were still playing. New `utils/opponentClinch.js`
  resolves the opponent exactly: for a clinched group winner/runner-up it checks
  the *other* side of the R32 tie across **every still-reachable outcome**. A
  winner/runner-up slot locks when that group's winner/runner-up is itself
  clinched; a third-place slot enumerates the still-reachable FIFA Annexe C
  combinations (using the clinch engine's exact per-group third-place bounds) and
  locks only if every one assigns the same finished group. The pop-up now shows
  "✅ confirmed" for a locked opponent and drops the provisional note. Grounded
  in the live case where USA winning Group D + the frozen profiles of completed
  groups pin Bosnia as the opponent regardless of the 14 remaining group games.
  +5 unit tests (incl. a frozen live snapshot) + 2 UI tests.
- **Knockout matchup in the team pop-up.** Once a team has *clinched* a Round-of-32
  place (group winner, runner-up, top-two, or a best third-placed team — from the
  same `computeClinch` verdict the standings badges use), its team pop-up now shows
  a **Round of 32** section below the group fixtures: the projected opponent (or
  "To be determined") and match number, pulled from the "As it stands" projection,
  with the clinch badge (🥇 Won group / ✅ Through). The matchup is marked
  **provisional only while it can still change** — a tie is treated as settled the
  moment *both* of its R32 sides are locked (e.g. a Runner-up A v Runner-up B tie
  settles as soon as Groups A & B finish, independent of the cross-group
  third-place race; third-place slots wait for all groups). Shown only for a
  selected team that's actually through — not for the whole-group view. +5 tests.
- **TheSportsDB backup source restored.** The integration queried
  `eventsseason.php?…s=2026`, which silently **froze at 5 events on Jun 13** — so
  the third corroborating source went dark after the opening days. Switched
  `fetchBackup` (and the schedule-drift script's SDB lookup) to the per-day
  endpoint (`eventsday.php?d=…&l=4429`) across a date window, the same shape as the
  ESPN adapter; resilient to a single day's failure. The conservative "final"
  gate still ignores SDB's occasional mislabeled `HT` status, so a just-finished
  score is cross-checked, never a half-time one. +2 tests.
- **Knockout schedule-drift detection.** The FIFA-anchored schedule check covered
  only group matches; it now also validates all 32 knockout matches, keyed by FIFA
  MatchNumber (73–104, which equal our knockout nums) since their teams are still
  placeholders. Catches a moved kickoff or venue for R32→Final, and feeds the same
  report/auto-fix/email path. Currently 0 drift — our times match FIFA. +5 tests.
- **Calendar: friendly knockout labels.** The .ics feed showed OpenFootball's
  cryptic slot codes (1A, 2B, 3A/B/C/D/F, W73, L101) for undecided knockout ties;
  it now maps them to the same wording the app uses ("Winner Group A", "Runner-up
  Group B", "Winner Match 73", …). +4 tests.
- **Team-name alias coverage locked for all 48.** Re-captured ESPN's spellings now
  that every team has played (24→48) and added a test asserting the snapshot covers
  all 48 — so a never-before-seen spelling can't silently drop a live score when a
  team advances. (TheSportsDB's season feed still lags at the opening days.)
- **Final-results lock extended to the R32 draw.** The final-group-results fixture
  gains an `OFFICIAL_R32` draw + a test that, once all twelve groups are locked,
  asserts our resolved bracket reproduces FIFA's published R32 matchups (the
  cross-group best-third/Annexe C check). Dormant until the group stage ends.
- **Mobile-friendly bracket.** On phones the knockout bracket no longer demands
  side-to-side scrolling across nine columns: it shows a **round selector**
  (R32 / R16 / QF / SF / 🏆 Final) and renders one round at a time as a full-width
  vertical list. It opens to the round in play, and "as it stands" links jump to
  the right round automatically. Desktop keeps the full two-sided bracket. +3
  tests.
- **Bracket auto-fills through the knockouts.** Completing the placeholder
  resolution: once the group stage is fully final, the eight best third-placed
  teams drop into their "3rd X/Y/Z" Round-of-32 slots (via FIFA's Annexe C table,
  reusing the projection engine); and as each knockout tie finishes, its winner
  flows into the next round's "Winner Match N" slot and the loser into the
  third-place play-off (penalties break a draw). All conservative — a slot stays
  a placeholder until its outcome is genuinely settled. New `utils/bracketResolve`
  with `resolveBracket` now drives every view. +10 tests.
- **Final group results locked against the engine.** New `final-group-results`
  fixture + test freezes each group's verified official finishing order and
  replays it through the tie-breaker engine, so the standings can't silently
  drift from the real tournament. Seeded with Group B; extended group-by-group as
  the stage completes. +2 tests.
- **Eliminated styling muted to grey, reserving red for LIVE.** The eliminated
  row tint, left-border, and the ❌ badge now use a neutral grey ("faded out /
  done") instead of red, so the only vivid red in the standings is the pulsing
  LIVE indicator — removing the colour clash between "playing now" and "out".
  The ❌ glyph stays as the verdict marker.
- **Clearer ✓ tooltip on provisional qualifiers.** The "currently top two"
  checkmark now reads "Advances to the Round of 32 (if current match status
  holds)" on two lines — making explicit that it reflects the live/current
  standings (e.g. while a final-matchday game is in progress), not a clinched
  outcome.
- **Wide standings verdicts wrap to their own line.** The text badges — "Won
  group", "Group runner-up", "Provisional 3rd", "Through (3rd)", "Eliminated" —
  now sit on their own line beneath the team name instead of wrapping raggedly
  to its right in the narrow 3-groups-across layout. The single-glyph
  qualification marks (✓ · ✕) stay inline so most rows keep their height.
- **Best-third table uses the same green/yellow/red scale, per clinch.** The
  "Best third-placed teams" table no longer paints its top 8 green and bottom 4
  red unconditionally. Each row is now tinted by that team's own clinch verdict:
  **green** once it has clinched a best-third spot, **red** once mathematically
  eliminated, **yellow** while merely provisional (currently top 8), plain
  otherwise — matching the group tables. Rows flip to green the instant a team
  clinches, not only when every group finishes. +1 test.
- **Group standings rows tint green / yellow / red by outlook.** Extending the
  existing green highlight for the top two: a **provisional best-third** row now
  gets a subtle **yellow** tint + gold left-border, and a **mathematically
  eliminated** team gets a **red** tint + red left-border. Same understated
  treatment as the green (very light background, the colored edge carries the
  signal), so the row colors now line up with the clinch badge scale —
  advancing / on the bubble / out. Undecided rows stay plain. +1 test.
- **Distinct "Group runner-up" and "Through (3rd)" clinch badges.** Added a new
  `runner-up` clinch status for a team locked into *exactly* 2nd (separate from
  `top2`, which now means "top two, but 1st-vs-2nd still open"). It shows a silver
  **🥈 Group runner-up** badge; a clinched best-third now reads **✅ Through (3rd)**
  instead of a bare **✅ Through**, so the two routes are distinguishable at a
  glance without the (mobile-invisible) tooltip. Legend, match-card route tooltip,
  and the clinch-notification email headline updated to match. +4 tests.
- **Runner-ups flow into the bracket once a group is decided.** When every match
  in a group is final, the group's second-placed team now fills its
  "Runner-up Group X" knockout slots everywhere (bracket, schedule, detail modal,
  calendar) — mirroring how clinched winners already resolve. So e.g. Canada
  (2nd in Group B) now appears in its Round-of-32 tie (Match 73) instead of a
  placeholder. Third-place slots stay as placeholders, since which third lands
  where depends on the cross-group best-third race. +3 tests.
- **Provisional best-third badge made explicit.** A 3rd-placed team currently
  inside the 8 best thirds no longer shows a bare `3⃣` (which read like a locked
  verdict). It now shows a dashed-yellow **"Provisional 3rd"** badge with a
  tooltip spelling out that it's NOT clinched and depends on the other groups
  still to finish. Legend updated to match. Clinched advancement still uses the
  solid ✅ "Through" badge, keeping provisional and guaranteed visually distinct.
- **Group fixtures pop-up in the Groups tab.** Clicking a **team name** now opens a
  modal with that team's three group-stage matches — results (with scores, an FT
  badge, or the live clock) and games still to play (kickoff in your timezone);
  clicking a **group title** opens the whole group's six-match schedule. Each
  fixture row opens the full match detail, the selected team is highlighted, and
  scores respect spoiler mode (•–• with a reveal). A tip at the top of the
  standings describes the interaction. Reuses the shared modal a11y/status
  helpers. +4 tests.
- **Next-match hero stacks simultaneous *upcoming* matches.** Extending the
  live-match stacking to games that haven't started: when no favorite team drives
  the pick, the hero now lists every upcoming match sharing the earliest kickoff
  (final group matchdays run two at once, e.g. today's 3 PM ET pair) under one
  shared countdown — previously only the first appeared. A followed team's next
  game still takes over as a single card. +2 tests.

## 2026-06-23
- **Fix: "As it stands" dropped some 1st/3rd matchups once a group clinched.** When
  a group's winner is decided, the live feed resolves its R32 slot ("Winner Group
  A" → "Mexico"), which no longer parsed as a slot — so that winner's projection
  *and* the paired qualifying-third's projection both vanished (e.g. Groups A/D/E
  1st and C/H/J 3rd showed blank). `projectKnockout` now reads R32 slot labels from
  the static schedule by match number (they're invariant), independent of resolved
  team names. Verified live: all 1st/2nd/3rd resolve, pairings symmetric. +1
  regression test.

## 2026-06-22
- **Handle one-off match statuses (suspended/abandoned/postponed/canceled/awarded).**
  Building on the weather-delay work, ESPN's `status.type.name` is now categorized
  in the feed: **paused** (delayed *or* suspended → amber "⏸ Delayed"/"⏸ Suspended",
  still live-but-stopped), **voided** (abandoned/postponed/canceled → not a real
  result), and **awarded** (forfeit/walkover → an awarded final). Correctness:
  voided matches are **excluded from clinch and the standings/"As it stands"** (an
  abandoned partial score can't quietly shift the tables), via a shared
  `statusFlag` helper + `liveState → 'voided'`. UI: all four views (schedule card,
  detail, bracket, week) show a muted grey pill (⏸ Postponed / ⚠ Abandoned /
  ⚠ Canceled) instead of a countdown or live clock — abandoned shows its partial
  score *labeled*, not as a confirmed final; awarded shows the score with an
  "awarded" note; all respect spoiler mode. Grounded in WC history (2018 fair-play,
  abandonments, walkovers); a guard test locks the no-group-shootout 2026 scoring
  assumption. New tests across status-card/detail/bracket/week + espn/logic/guard.
- **Venue cross-check in the schedule monitor.** The FIFA-anchored `check:schedule`
  now also compares each group match's stored venue to FIFA's stadium (matched by
  team pair, via an `IdStadium` alias map for all 16 venues) and reports any
  mismatch in the email — report-only, no auto-fix. Verified live: 0 venue
  mismatches today. `scripts/schedule-core.mjs` stays pure (venue data passed in);
  +15 tests.
- **Fix: long venue name overflowed a stacked live row.** The stacked rows forced
  the venue onto one line, so "New York/New Jersey" ran past the hero box on
  mobile. Rows now wrap; verified at 390px against the live Group I doubleheader.
- **Next-match hero stacks multiple live matches.** When two games run at once
  (final group matchday), the hero now lists them as compact, tap-to-jump rows
  with each match's live/delayed badge — instead of showing only one. A followed
  team that's live still takes over: one followed-live match shows solo, and if
  two followed teams are playing at once, both are shown. +3 tests.
- **Hardened live handling for simultaneous kickoffs.** On the final group
  matchday two matches start at once (e.g. the 8 PM ET pair). Live data is keyed
  by team pair, so they're already independent — but the feed's event-dedup fell
  back to kickoff *date* when an event lacked an id, which would have merged two
  same-time matches. Now it dedups by id/uid only. Verified both matches keep
  their own live score either way. +2 tests.
- **Delayed matches show an amber "⏸ Delayed" (not a red live clock).** ESPN marks
  a stopped match `STATUS_DELAYED` (e.g. weather) while keeping it "in progress" —
  caught live during France v Iraq. The feed now carries a `delayed` flag, and the
  UI reflects it: the shared live badge shows amber **⏸ Delayed** (Schedule /
  Bracket / Match detail), the Next-match hero reads **⏸ Delayed** instead of
  "● in progress", and a delayed group shows **⏸ DELAYED** with amber dots in the
  Groups tab. +6 tests; coverage stays 100%.

## 2026-06-20
- **Live matches blink in the Groups tab.** Because the standings and "As it
  stands" reflect in-progress scores, any group with a match underway now shows a
  pulsing "● LIVE" marker in its header and a blinking dot on the two teams
  playing — so it's clear the table/projection are provisional and updating. Uses
  the existing live colour + pulse. +2 tests (coverage stays 100%).
- **Test coverage to 100% (statements / lines / functions), app-wide.** Brought
  every source file to full statement coverage — components (CalendarModal,
  LiveBadge, ScoreCheck, NextMatch, MatchCard, MatchDetail, Standings, Filters,
  Bracket, WeekView), services (results, espn, thesportsdb, reconcile), the
  `follow` context, `App.jsx`, the utils, and the `useModalA11y` hook — via 24 new
  focused test files (498 tests total, all green). Branches sit at ~94% (a few
  defensive short-circuits). `matchThirds` is now exported for direct unit testing
  and its unreachable-in-prod caller is `v8 ignore`d (the Annexe C table covers all
  495 third-place combinations, so the fallback never runs).
- **Removed the OpenFootball-autofill README badge.** That workflow self-loops and
  serializes via a concurrency group, so superseded runs end as `cancelled` —
  which GitHub renders as a red/"failing" badge even though nothing is wrong. The
  CI badge is the real health signal.
- **README badges + MIT license.** Added a CI status badge and a self-hosted
  **test-coverage badge** (now 100%): CI runs `vitest --coverage`, a tiny
  script writes a shields.io endpoint `coverage.json` into the deployed site, and
  the badge reads it — no third-party coverage service or token. Added a `LICENSE`
  (MIT) for the code + a license badge (trademarks/data remain governed by the
  disclaimer). New `scripts/coverage-badge.mjs`, `test:coverage` /
  `coverage:badge` npm scripts, `@vitest/coverage-v8`.
- **"As it stands" match numbers link to the bracket.** Each projected R32 match
  number (e.g. M79) is now a link — clicking it switches to the Bracket tab,
  scrolls that tie into view, and flashes a highlight.
- **README refreshed.** Documented the big features that had landed but weren't
  written up: clinch/elimination detection, the "As it stands" Round-of-32
  projection (official FIFA Annexe C, bracket-linked), the 2026 tie-breakers incl.
  fair play, phone-friendly collapsing schedule, and FIFA-anchored reschedule
  monitoring with auto-fix PRs.
- **Groups tab polish.** The "As it stands" block now pins to the bottom of each
  group card, so the blocks line up across a row even when a clinch badge (e.g.
  Group D's "Won group" / "Eliminated") makes one table taller. The legend's
  tie-breaker list — clunky on a phone — collapses to a compact "tie-breakers"
  label that reveals the full order on hover/tap (a real CSS tooltip, since the
  native one only showed a help cursor). And mobile overflow fixes: the legend
  now wraps instead of running off the side, and the view switcher scrolls
  internally instead of widening the whole page.
- **Fair-play (conduct) tie-breaker added — standings now match BBC.** When teams
  are level on points, head-to-head, goal difference and goals, FIFA's next
  criterion is the team conduct score (cards), *before* FIFA ranking. We now
  compute it best-effort from ESPN's card feed (yellow −1, red −4; available with
  the history backfill for ~28/32 finished group matches). This fixed six "As it
  stands" matchups that differed from the BBC — e.g. dead-even draws like
  Netherlands 2–2 Japan and Iran 2–2 New Zealand now order by cards (then FIFA
  ranking), and all the projected Round-of-32 ties match the BBC. Caveat: ESPN
  flags yellow/red only (can't always tell a 2nd yellow from a direct red) and a
  card-less match scores 0, so it's an approximation, with FIFA ranking as the
  final fallback. +1 test.
- **"As it stands" can be hidden.** It's shown by default under each group; a
  toggle near the top of the Groups view hides it (preference persisted) for
  those who just want the tables.
- **Schedule-drift check is now FIFA-anchored & multi-source.** Instead of
  trusting ESPN alone (or making you the tiebreaker), `check:schedule` now pulls
  four free/keyless feeds — **FIFA's official data API as the authority**, plus
  ESPN, TheSportsDB, and OpenFootball as corroboration — and validates **all 72
  group matches** by team pair. If FIFA disagrees with our stored kickoff, that's
  the answer (the email gives FIFA's time and which feeds back it up, so you just
  update the data); if FIFA confirms us but a feed is off, it's logged as a feed
  glitch, not an alarm; if FIFA is unreachable, it falls back to requiring two
  feeds to agree. Verified live: all 72 group matches agree across all four
  sources, FIFA included. `scripts/schedule-core.mjs` rewritten; tests updated.
  The footer now notes "kickoff times are cross-checked daily against FIFA's
  official schedule" (a trust signal for the monitoring — not a live data feed;
  the app still fetches scores from OpenFootball/ESPN/TheSportsDB).
- **Auto-fix PR when FIFA's schedule changes.** The daily check now closes the
  loop: on a FIFA-confirmed kickoff change it rewrites both `src/data/matches.js`
  and the official-kickoffs fixture to FIFA's time and opens a ready-to-merge PR
  (one rolling `auto/kickoff-fix` branch, deduped) — so it's review-and-merge,
  never a hand edit. Conversion + the in-file rewrites are a pure, unit-tested
  module (`scripts/schedule-fix-core.mjs`); verified end-to-end by simulating a
  drift and confirming it restores FIFA's exact time. +5 tests.

- **Hardened the test suite (+21 tests).** Added focused coverage for the
  correctness-critical logic where bugs surfaced this week: more `qualification`
  tie-breaker scenarios (3-way head-to-head cycle → overall GD, level-on-points +
  H2H split by GD, no-results FIFA-rank ordering, group completion flags); more
  `clinch` cases (badge mapping, `groupWinners`, `resolveClinchedSlots` leaving
  runner-up/third slots alone, `newlyClinched` detecting new eliminations and
  top2→won-group upgrades); new `byFifaRank` tests; new `urlState` read/write
  round-trip tests; and a schedule-drift threshold-boundary test. 236 tests total.

## 2026-06-19
- **"As it stands" Round-of-32 projection under each group.** Each group table
  now shows where its current 1st / 2nd / (qualifying) 3rd would land in the
  Round of 32 — with concrete opponents — based on the live standings, like the
  BBC's group pages. Winner/runner-up slots resolve directly from the table; the
  eight qualifying thirds are placed using **FIFA's official Annexe C allocation**
  — all 495 combinations, parsed verbatim from the Regulations PDF and validated
  against the Art. 12.6 candidate lists (`src/data/thirdPlaceCombinations.js`).
  (Early in the group stage, before eight thirds have data, it falls back to
  constraint-matching the candidate lists.) New `src/utils/asItStands.js`;
  +7 tests.
- **FIFA World Ranking now breaks otherwise-tied standings.** When teams are
  level on points, head-to-head, goal difference, and goals scored, the app used
  a placeholder alphabetical order — which wrongly put e.g. Cape Verde ahead of
  Spain (both 1 pt, 0 GD, 0 GF, and a 0–0 head-to-head). It now applies FIFA
  World Ranking as the decider (the official criterion after the uncomputable
  conduct-score), so Spain (2nd) correctly ranks ahead of Cape Verde (67th), in
  the group tables and the best-third race. New `src/data/fifaRanking.js` (June
  11 2026 edition, sourced + dated like the kickoff fixture). +2 tests.
- **Schedule-drift monitoring so a reschedule can't slip by again.** Our kickoff
  times were static (validated once), so nothing flagged FIFA moving M32 — it was
  only caught by eye. New `check:schedule` compares every upcoming match's stored
  kickoff against ESPN's scheduled time (reusing the app's team-name resolution;
  knockout placeholders matched by venue, incl. the Azteca→Banorte rename) and
  reports anything off by ≥5 min. It runs two ways: hourly via feed-freshness
  (red build → email backstop) and every morning at 05:00 MST (before the day's
  games) via a new `schedule-check.yml` that emails a report of any changes for
  the day/week ahead. Confirmed M32 was a genuine FIFA move (a Dec 27 2025
  archive showed our original 9 PM PT) and that no other game in the rest of
  group play is off. New `scripts/schedule-core.mjs` + `check-schedule-drift.mjs`;
  +5 tests.
- **Schedule fix: M32 (Türkiye v Paraguay) kickoff was off by 1 hour.** The app
  had 00:00 ET (June 20) but the actual kickoff is 23:00 ET (June 19), so it
  showed as upcoming while already in progress. Confirmed against ESPN (live at
  03:00 UTC), FIFA, and the Levi's Stadium event page; a full sweep confirms it's
  the only match off by ≥5 min. Cause of the original discrepancy is undetermined
  — our value was 00:00 ET from initial release and survived the 2026-06-09
  audit, but no reschedule announcement could be found and the early-June source
  listings couldn't be re-checked (web archives unreachable). Corrected in
  `src/data/matches.js` and the official-kickoffs fixture.
- **Fix: missed eliminations when head-to-head locks a team out (e.g. Haiti).**
  The "can this team still reach 2nd/3rd?" check fell back to an optimistic
  points bound even when the group was exactly enumerable, so a team that could
  only *tie* on points but loses the head-to-head (so can't actually climb) was
  never eliminated. It now trusts the exact ranks (which account for head-to-head
  / goal difference) when the group is enumerable, using the points bound only as
  a fallback for groups too large to enumerate. +1 regression test.
- **Best third-placed table: drop the ✓ badge, keep the light-green row.** The
  qualifying eight already get the same light-green highlight as the group
  leaders; the extra ✓ looked too much like the "Through" clinch badge, so it's
  removed.
- **Fix: clinch engine missed real "Through" verdicts (e.g. USA in Group D).**
  Two bugs: (1) a lopsided group with several games left blew the scoreline-
  enumeration budget, so the engine bailed and showed no status for the whole
  group; (2) the best-third advancement check required all 12 groups to be
  exactly enumerable, far too strict mid-tournament. Added a cheap points-only
  W/D/L analysis (always feasible) that runs alongside the exact scoreline pass;
  statuses use the precise answer when available and a sound points bound
  otherwise. The cross-group third-place race now uses each group's achievable
  third-place points (precise GD when enumerable, sound bound when not), so a
  team guaranteed no worse than 3rd with a points total that can't be beaten by 8
  other groups' thirds is correctly marked Through. +1 regression test.
- **Clinch announcements in the score-sync email.** When the OpenFootball
  autofill syncs a final score, it now also reports any clinch/elimination that
  result settles — comparing the clinch picture with vs without the new
  result(s) and appending a "🏆 Clinch updates" section to the same email (all
  events: won group / through / eliminated). Pure helpers `newlyClinched` and
  `clinchHeadline` in `clinch.js`; the workflow's test-email path now previews
  the format. +2 tests.
- **Fix: clinched group winners now resolve everywhere, not just the bracket.**
  A clinched "Winner Group X" slot was filled in the bracket's rendering only, so
  clicking the match opened a detail modal that still showed the placeholder.
  Resolution now happens once in the match data (`resolveClinchedSlots`), so the
  resolved team flows to every view — bracket, match-detail modal, schedule
  cards, week view, and calendar. Clinch tags stay limited to group-stage cards.
  +2 tests (204 total).
- **Fix: wrong group tie-breaker order (head-to-head vs goal difference).** The
  ranking used the pre-2026 order (overall goal difference before head-to-head),
  but FIFA changed it for 2026: head-to-head now comes FIRST (matching the UEFA
  Euro), then overall GD, then goals, then conduct score / FIFA ranking (drawing
  of lots was removed). `rankGroup` now applies head-to-head among teams level on
  points before overall GD, re-applying it to any still-tied subset. This
  corrects the standings, `computeQualification`, and the clinch engine — e.g. a
  team that has beaten the only side that can match its points now correctly
  reads "🥇 Won group" rather than "Through". Sources: FIFA.com tie-breaker
  article, FOX Sports. +1 test (202 total).

## 2026-06-18
- **Fix: clinch detection counted a live match's running score as final.** A
  team could read "clinched" mid-match (e.g. while it was still 1–0 up) because
  the engine treated any match with a score as decided — but a live match carries
  a provisional ESPN score. Live matches are now treated as undecided (enumerated
  like unplayed fixtures), so a verdict only appears once results are actually
  final. +1 test (201 total).
- **Clinch & elimination detection.** The site now works out what's
  mathematically *locked* for each team — 🥇 won the group, ✅ through (top two,
  or guaranteed as one of the 8 best third-placed teams), or ❌ eliminated — using
  the full FIFA tie-breakers. It enumerates every possible outcome of a group's
  remaining matches (with a goal cap well above any tie-breaker-relevant margin),
  and judges the cross-group third-place race with sound per-group bounds. It is
  built to never over-claim: when a situation is genuinely undecided (or too large
  to enumerate early in the group stage), it stays silent rather than guess.
  Verdicts show as badges in the Groups standings and as tags on Schedule match
  cards; the Bracket now fills each "Winner Group X" slot with that team the
  moment the group is clinched. New `src/utils/clinch.js`; +6 tests (196 total).
- **"Hide past days" button on the Schedule.** Once group play piles up,
  reaching today's games meant a long scroll past every finished day — painful on
  a phone. A new control in the Schedule controls bar (shown only when past days
  exist, with a count) drops every past day from the schedule in one tap, so
  today's matches sit at the top. Past days still show by default as collapsed
  sections that expand per-day as before. (190 tests.)

## 2026-06-16
- **Fix: a feed gap could flood you with dozens of stale goal alerts.** The
  "seen goals" snapshot was replaced every poll, so a transient ESPN gap (a poll
  briefly returning fewer events and dropping live matches' goals) made every goal
  look new when the next poll restored them — one user saw 31 at once. The snapshot
  now ACCUMULATES (unions) every goal key ever seen, so a disappear/reappear is
  silent. Added a defense-in-depth cap: a single poll yielding >5 new goals is
  treated as a desync and suppressed rather than fired. +1 regression test.
- **Fix: goal alert showed the scorer next to a stale 0–0.** ESPN appends a goal
  to its event list a beat before it bumps the aggregate score, so the alert could
  read e.g. "Mbappé 12' — France 0–0 Senegal". The notification's score line now
  derives from the goal lists themselves (which already credit own goals to the
  right side and exclude shootout kicks), so it's always consistent with the goal
  that triggered it. +2 tests (189 total).
- **Goal alerts — browser notification when a goal is scored.** New 🔔 toggle in
  the results bar: when on, the app raises a desktop/mobile notification (scorer,
  minute, and the running score) the moment a new goal lands in a live match. A
  scope dropdown switches between ⭐ my teams (default) and all matches. It reuses
  the existing ESPN poll (~30s while a match is live) to diff each snapshot for
  new goals, so there's no extra fetching. Enabling requests Notification
  permission (and the toggle reflects whether it's actually granted); the
  preference persists. Because the site is static (no backend), alerts fire only
  while the app is open in a tab — backgrounded is fine. Pure detection/formatting
  logic lives in `src/services/goalNotify.js` and is unit-tested (+14 tests, 187
  total).

## 2026-06-15
- **Count ESPN as a confirming source for matches past the live window.** The
  source reconciler only checked ESPN's rolling 3-day window, so a finished match
  silently dropped to "1 source" once it aged out — even though ESPN still has the
  final. It now also consults the by-date backfill map, so every finished match
  reflects ESPN's confirmation (the opening-day games that TheSportsDB carries now
  show 3 sources; the rest show 2 = OpenFootball + ESPN). TheSportsDB itself is
  still stalled at 5 events (last June 13), so it is not the source of the newer
  "2 sources" labels — ESPN is.
- **Fix: finished matches lost their yellow/red cards in the detail view.**
  OpenFootball (the source of record) carries final scores + goals but no cards or
  subs, and `applyLive` had been early-returning once OpenFootball had the score —
  so the moment a match ended its ESPN card timeline was dropped. `applyLive` now
  still overlays ESPN's cards/subs (oriented to our team order) onto a match that
  already has an OpenFootball score, while leaving the score/goals untouched.
- **Backfill cards for matches that finished before the live window.** ESPN drops
  finished games from its rolling scoreboard after a couple of days, so older
  matches (e.g. the June 11–12 openers) had no ESPN record to overlay at all. Added
  `historyDates` + a one-time by-date ESPN fetch (`fetchLive(signal, dates)`),
  merged as a backfill overlay beneath the live window. All 14 of the 15 finished
  matches that had cards now show them (Germany 7–1 Curaçao genuinely had none).
  +4 tests (173 total).

## 2026-06-14
- **Post on ESPN's final immediately — no second-source wait (target: within ~10
  min of full time):** dropped the ✓✓-required gate. ESPN is now the trigger — the
  moment it reports a match 'post'/final, the next poll (~5 min) syncs it.
  TheSportsDB stays only as a safety CHECK: if it's present and CONTRADICTS ESPN we
  defer (never write a disputed score); if absent or agreeing, we post. ESPN is
  also no longer required to have BOTH feeds reachable — only ESPN. Removed the
  ESPN-only time threshold. This matters most during the maintainer's off-hours.
- **Shorter wait for TheSportsDB before the ESPN-only fallback:** lowered
  `ESPN_ONLY_AFTER_MIN` 150→125 (≈ full time + ~10 min) so a confirmed-by-ESPN
  final syncs sooner when TheSportsDB lags. (ESPN only counts as 'post'/final, so
  the result is genuine; this only bounds the cross-check wait.)
- **Knockout autofill would not have worked — two critical fixes (PR):** a deep
  scan of openfootball's 1930–2026 files (vs our writer) found that 2026 knockouts
  live in a **separate file** `2026--usa/cup_finals.txt` (with a `(NN)`
  match-number prefix on each line), not `cup.txt` — so the autofill (which only
  edited `cup.txt`, with a regex that choked on `(NN)`) would have **silently
  no-op'd every knockout result**. Now it writes group results to `cup.txt` and
  knockouts to `cup_finals.txt` (one commit per file), and the line regex accepts
  the optional `(NN)` prefix. Also fixed the **a.e.t. paren order**: real files
  write `(score-at-90, half-time)` — e.g. `3-3 a.e.t. (2-2, 2-0)` — but our writer
  (and the test that encoded it) had it reversed. Froze a real `cup_finals.txt`
  snapshot + tests (every knockout match number is present; `(NN)`-prefixed line
  matching; corrected a.e.t. order against the 2022 final). The scan also
  *confirmed* our `(OG)`, `(pen.)`, shootout, and stoppage-minute formats are
  correct for the current files. 169 tests.
- **Hardening pass — kill the mapping-mismatch bug class (PR):** an audit (driven
  by the two name/date bugs below) found and fixed more of the same class:
  (1) **TheSportsDB spells it "Bosnia-Herzegovina"** (hyphen), which our aliases
  didn't map — Bosnia's matches would silently fail the cross-check; (2) the
  autofill's `espnGoals` still fetched a **single ESPN date** (the lag the live
  fix addressed) — now uses the ±1-day window so a midnight-ET match's
  scorers/extra-time aren't dropped; (3) `applyResults` could write a **reversed
  score** if a feed name matched neither team — now it skips. New tests pin every
  **real captured ESPN + TheSportsDB spelling** to a known team (would've caught
  both prior bugs), assert the duplicated ESPN alias maps stay in sync, exercise
  `applyEdit` against a frozen real cup.txt snapshot (CRLF + idempotency), and
  check static-data integrity. Plus `npm run check:sync` — a runtime drift guard
  (wired into the hourly feed-freshness job) that fails if upstream cup.txt renames
  a team so the autofill can't find its line. 146 tests.
- **Fix: autofill couldn't sync Türkiye/Czechia matches (name spelling).** Our app
  and the feeds use the official FIFA names (Türkiye, Czechia), but cup.txt's match
  lines use simpler spellings (Turkey, Czech Republic) — so the writer searched for
  e.g. "Australia v Türkiye", didn't find the "Australia v Turkey" line, and
  silently skipped (this is why Australia 2–0 Türkiye didn't sync overnight despite
  ESPN confirming it). Added a `cupName` alias map so the line lookup uses cup.txt's
  spelling, with a test. Australia 2–0 Türkiye
  ([commit](https://github.com/openfootball/worldcup/commit/7b779a6837a69b06c391308b0c7aab82717ea48a))
  synced once fixed.
- **Fix: live matches stuck on "Live" with no score/clock.** The live overlay
  used ESPN's default scoreboard (no date param), which returns only one date's
  slate and can lag a day — so a late-night match (e.g. a midnight-ET kickoff that
  ESPN files under the next date) was missing from it, and the card fell back to a
  time-based "Live" with no score or clock. `fetchLive` now queries the dates
  around now (yesterday/today/tomorrow, UTC) and merges them, so live games show
  their score and clock again. (Caught live on Australia 1–0 Türkiye, 43'.)
- **Self-perpetuating autofill loop + a big test pass (PR):** GitHub's scheduler
  fires too sparsely (~once/2h) to rely on, so a loop run now **re-dispatches the
  next one** while another match window is within ~5.5h — coverage during a match
  day no longer depends on the scheduler (the `*/15` cron is just a backstop to
  restart the chain after overnight rests). Loop runs share one concurrency group
  so the chain never doubles up; quick manual runs get their own. Extracted the
  autofill's risky decision/parsing logic into `scripts/autofill-core.mjs`
  (`classifyMatch`, `parseEspnEventDetail`) and added tests: ESPN-only fallback /
  disagreement / ✓✓ branches, ESPN event → goals/penalties/extra-time parsing
  (incl. a 2022-final-shaped shootout fixture), more `windowStatus` edges, and a
  guard that the scripts pull in **zero npm packages** (the workflow runs without
  `npm ci`). 147 tests total. Design + optional external-pinger notes in
  [`docs/autofill-scheduling.md`](./docs/autofill-scheduling.md).
- **Resilient scheduling (sleep-until-window) + manual babysit:** GitHub fires
  scheduled workflows only sporadically (observed ~once every 2h), which could
  miss a match's ~95-min sync window entirely. Reworked the loop to SLEEP until
  the next match window (up to a ~5h budget) and poll through it, so a single
  sparse trigger still covers upcoming games. Added a `babysit` workflow_dispatch
  input that runs this long loop on demand (used to guarantee overnight coverage).
- **ESPN-only fallback when TheSportsDB lags:** the autofill still prefers ✓✓
  (both sources agree), but TheSportsDB often posts a final tens of minutes late,
  which was blocking otherwise-confirmed syncs. Now, once a match is ≥150 min
  past kickoff (≈ full time + ~30 min) and ESPN has confirmed the final while
  TheSportsDB still hasn't, it syncs on ESPN alone — the commit and email note
  “ESPN only — TheSportsDB lagging”. Disagreements are still never auto-written.
  (First use: Haiti 0–1 Scotland.)
- **Autofill now runs only during match-finishing windows (and actually at
  ~5-min cadence):** GitHub throttles `*/5` cron schedules hard — the workflow was
  only firing a couple of times an hour. Reworked it into a window-gated
  self-loop: a coarse `*/15` trigger spins the job up, and it loops every ~5 min
  *only* while a match is in its finishing window (kickoff +85 to +180 min —
  late second half through source confirmation, [`scripts/active-window.mjs`](./scripts/active-window.mjs));
  outside those windows it exits in seconds. Because each window is ~95 min long,
  a coarse trigger reliably lands inside it, and the concurrency group hands off
  between jobs with no gap. Dropped `npm ci` (the scripts have no npm deps) so the
  idle checks are cheap, and moved the sync email in-script (Gmail SMTP via
  python3) so it fires per loop iteration — also retiring the third-party mail
  Action. New `windowStatus()` is unit-tested (128 tests total).
- **Manual-review alerts for knockouts the autofill can't auto-sync:** when a
  knockout is confirmed but can't be written safely (ESPN/TheSportsDB disagree on
  the penalty tally, goals don't reconcile, or ESPN has no goal detail), the
  workflow opens a **deduplicated GitHub issue** assigned to the maintainer —
  raised once (not every 5-minute run), so it's a trackable to-do rather than
  email spam. Bumped `action-send-mail` to v17 (Node 24; clears the deprecation
  warning).
- **Email notification on every upstream sync:** when the autofill workflow
  actually commits a new final to `openfootball/worldcup`, it now emails
  chester.ismay@gmail.com with the match(es), commit link, and run link. The
  script emits step outputs only on a real push (no commit → no email; deferred
  /manual-review items don't email). The email step uses Gmail SMTP and needs two
  repo secrets — `MAIL_USERNAME` (the Gmail address) and `MAIL_PASSWORD` (a Gmail
  App Password); if they're absent the step is skipped and the sync still runs.
- **Autofill now handles knockout a.e.t./penalties** (was group-stage only): the
  OpenFootball autofill writer renders knockout results in cup.txt's full house
  style — `1-1 a.e.t. (1-0, 1-1), 4-2 pen.` — with extra-time-aware half-time and
  FT-at-90 scores and shootout kicks excluded from the goalscorer block. The
  after-extra-time score is still ✓✓ (ESPN + TheSportsDB); the penalty tally is
  ESPN-primary, cross-checked against TheSportsDB when it carries one (a
  disagreement, or a knockout whose goals can't be reconciled, is surfaced for
  manual review rather than written as a bare score). Matches are merged first so
  knockout lines pick up resolved team names instead of "Winner Group A". New
  `buildScore()` + a.e.t./penalty tests in `cuptxt.mjs` anchored on the verified
  2022 final (Argentina 3–3 a.e.t. (2–0, 2–2), 4–2 pen.). First live autofill
  commit: Brazil 1–1 Morocco
  ([commit](https://github.com/openfootball/worldcup/commit/dc6d4da963150ef6e41de2ac82afd692291705a2)).

## 2026-06-13
- **`npm run of:autofill` + hourly workflow — automatically give confirmed
  finals back to OpenFootball:** the write-capable counterpart to `of:edits`.
  For every finished match where ESPN + TheSportsDB agree on the final and
  OpenFootball is missing it, it edits the `cup.txt` line (score + half-time +
  goalscorers, in the file's house style) and commits to `openfootball/worldcup`
  master. Conservative: group stage only (knockouts can be a.e.t./penalties —
  surfaced for manual review), ✓✓-confirmed only, and idempotent (only touches a
  line still reading `Home v Away`). Half-time/scorers come from ESPN; if they
  don't reconcile with the agreed final it writes a valid score-only line. All
  formatting + placement is isolated in [`scripts/cuptxt.mjs`](./scripts/cuptxt.mjs)
  and covered by [`test/cuptxt.test.js`](./test/cuptxt.test.js) (19 tests:
  FT/HT, `(pen.)`/`(OG)`, repeat-scorer comma-merge, one-sided vs two-sided
  blocks, orientation to the file's team order, special characters, CRLF
  endings, idempotency, placement). The
  [workflow](./.github/workflows/openfootball-autofill.yml) runs every 5 minutes
  (GitHub's minimum cron granularity) so a freshly-finished match is filled in
  within minutes; it needs an `OF_PUSH_TOKEN` secret (PAT, Contents: write);
  without it, it dry-runs. Format conventions were derived from a survey of the
  2006–2026 cup.txt files.
- **`npm run of:edits` — give late finals back to OpenFootball:** OpenFootball
  commits results by hand and sometimes lags after a match. This new script
  ([`scripts/openfootball-edits.mjs`](./scripts/openfootball-edits.mjs)) reuses
  the app's existing three-source reconciliation to list finished matches whose
  final OpenFootball hasn't posted yet but ESPN and/or TheSportsDB have —
  printed as paste-ready `cup.txt` lines (`Home  FT  Away`), ranked ✓✓ both
  fallbacks agree / ⚠ one fallback only / ✗ fallbacks disagree, plus any match
  where OpenFootball's score disagrees with the fallbacks (possible
  corrections). It's the follow-through on the maintainer's edit-in-place invite
  in [worldcup.json#23](https://github.com/openfootball/worldcup.json/issues/23);
  read-only (never writes). Its first real catch — Qatar 1–1 Switzerland
  (Jun 13), confirmed by ESPN + TheSportsDB — was contributed back to the
  upstream source ([cup.txt edit](https://github.com/openfootball/worldcup/commit/cb9171670e19695bb95625683ead74d9d469e55e)).
  Note the edit target is `openfootball/worldcup`'s `2026--usa/cup.txt`, **not**
  `worldcup.json` (bot-regenerated, so direct JSON edits get clobbered).
- **Foldable days on the Schedule:** each day section now collapses/expands from
  its header (chevron + match count), and days that have already passed fold shut
  by default — so the page opens on what's still to come instead of a long scroll
  of finished matches. "Past" is judged against today in the viewer's selected
  timezone; expanding/collapsing a day overrides the default for that day. The
  per-day "Hide scores" spoiler toggle is unchanged and only shows while a day is
  expanded. (Weeks in the Week view are next.)
- **Real soccer ball across the share image and all app icons:** the Open
  Graph/Twitter preview (`public/og-image.png`/`.svg`) and the PWA/home-screen
  icons used an abstract mark that didn't read as a ball. Swapped in the
  [Google Noto Emoji](https://github.com/googlefonts/noto-emoji) soccer ball
  (Apache License 2.0) — a polished, instantly recognizable design. Embedded the
  vector in `og-image.svg` and `icon.svg`, then re-rendered all PNGs from the
  SVGs with headless Chrome: `og-image.png` (1200×630), `icon-512.png` (also the
  maskable icon — ball kept inside the safe zone), `icon-192.png`, and
  `apple-touch-icon.png` (180×180). Credited Noto in the README. The
  `index.html` favicon stays the ⚽ emoji — the detail doesn't read at 16px, and
  the emoji is crisper there.

## 2026-06-11
- **Doc fix — README no longer claims subs in the timeline:** the Match Detail
  timeline advertised substitutions (🔁), but the ESPN *scoreboard* feed the app
  reads only carries goals and cards (its curated "key plays" list) — subs live
  only on ESPN's per-match `summary` endpoint, which the app doesn't fetch. So
  subs never rendered. Trimmed the subs mention from the README feature list and
  data-sources note to match actual behavior. (The timeline's sub-rendering code
  stays as harmless scaffolding if we later wire the summary endpoint.)
- **Feed-freshness gate now alarms only when the app is blind:** the CI check
  bucketed STALE on OpenFootball alone, so it red-failed after every finished
  match while OpenFootball (which commits results hours late) caught up — even
  though ESPN/TheSportsDB already carried the final and the app showed it. The
  gate now treats a match as scored if *any* of the three sources has the final,
  and only fails when none do (the app would genuinely show no score).
  OpenFootball lagging behind a fallback is surfaced as an informational note
  instead of a failure. (Opener: Mexico 2–0 South Africa was on ESPN but not yet
  in OpenFootball — gate stayed green.)
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
