# NEWS

A dated changelog for the World Cup 2026 Schedule Viewer. Each heading is a
calendar day; bullet points capture every change made that day (features, fixes,
data/source updates, deployment). Newest day on top.

## 2026-06-24
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
