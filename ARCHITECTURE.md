# Architecture

A contributor's map of the World Cup 2026 Schedule Viewer. The README covers
*what the app does*; this covers *how the code is laid out* and how data flows
through it. Day-to-day "what changed when" lives in [`NEWS.md`](./NEWS.md); the
authoritative per-function detail lives in each module's header comment — this
file is the index that points you at the right one.

The app is a client-only React 18 + Vite SPA. There is no backend: all logic
runs in the browser (plus a handful of Node scripts for CI/contribution and one
Netlify function for the calendar feed).

## Data flow at a glance

```
static schedule (src/data)                 live feeds (src/services)
  matches · teams · venues · fifaRanking      OpenFootball (record) ─┐
  thirdPlaceCombinations                      ESPN (live overlay)   ─┤ merge
        │                                     TheSportsDB (cross-check)│
        └───────────────┬──────────────────────────────────────────┘
                        ▼
         merged matches  (App.jsx state, refreshed on a timer)
                        │
   ┌────────────────────┼─────────────────────────────────────────┐
   ▼                    ▼                    ▼                      ▼
 qualification        clinch /            asItStands            bracketResolve
 (standings,          eliminationCheck    (provisional R32      (fill bracket
  tie-breakers,       (guaranteed         projection via         placeholders as
  best thirds)        outcomes)           Annexe C)              teams resolve)
                        │
                        ▼
                    components/  (Standings, Bracket, WeekView, …) render it
```

Everything downstream of the merge is **pure**: given a `matches` array it
recomputes standings, clinches, projections and bracket fills with no side
effects — which is why most logic is unit-testable without the DOM.

## `src/data` — static inputs

| File | Exports | Role |
| --- | --- | --- |
| `matches.js` | `MATCHES`, `STAGE_LABELS` | The frozen 104-match schedule (kickoffs, venues, group/knockout slot labels). Source of truth for structure; validated by `check:schedule`. |
| `teams.js` | `TEAMS`, `FLAG_BY_TEAM`, `ALL_TEAMS` | 48 teams by group, flag/name lookups. `FLAG_BY_TEAM[name]` doubles as the "is this a real team?" test in the UI. |
| `venues.js` | `VENUES` | 16 host stadiums (name, city, country, region). |
| `fifaRanking.js` | `FIFA_RANK`, `byFifaRank` | FIFA World Ranking, the final group tie-breaker. |
| `thirdPlaceCombinations.js` | `THIRD_PLACE_COMBINATIONS`, `THIRD_WINNER_ORDER` | FIFA Annexe C: which of the 12 thirds land in which R32 tie, for all 495 qualifying combinations. |
| `broadcast.js`, `teamTimezones.js`, `groupColors.js` | — | US TV/streaming, per-country kickoff times, group accent colors. |

## `src/services` — live data ingestion & merge

The three feeds are merged in priority order; the merge is where cryptic feed
spellings are normalised to our canonical names.

- **`results.js`** — OpenFootball `worldcup.json`, the **source of record** for
  final scores and for resolving knockout team names. Key exports: `fetchResults`,
  `applyResults` (overlay scores + resolve knockout `t1/t2`), `normalizeTeam`,
  `pairKey`, `isRealTeam`, `matchKey`, `openFootballFinalScore`. Score shape is
  `{ ft, ht, et, p }`; `applyResults` prefers `et` for knockouts decided in extra
  time so the bracket doesn't stall on a level 90-minute score.
- **`espn.js`** — ESPN public scoreboard, the **live in-match overlay** (clock,
  provisional score, goal/card events). `fetchLive`, `applyLive`, `espnFinalScore`,
  `scoreboardDates`, `normEspn`. Used only while a match is live or just-finished
  before OpenFootball posts; OpenFootball wins once it has the score.
- **`thesportsdb.js`** — independent **cross-check** of final scores/pens.
  `fetchBackup`, `sdbFinalScore`, `sdbFinalPens`, `normSdb`.
- **`reconcile.js`** — reconciles the three feeds per match → "confirmed by N
  sources" / "sources disagree".
- **`goalNotify.js`** — opt-in browser goal notifications for followed teams.

`App.jsx` owns the fetch loop: it polls every ~2 min, dropping to ~30 s while any
match is live, and recomputes the derived state below on each refresh.

## `src/utils` — derived logic (pure)

**Standings & qualification**
- `qualification.js` — `computeQualification` (all 12 tables), `rankGroup`,
  `headToHead`, `groupComplete`. Implements the official 2026 tie-breaker order
  (points → head-to-head → GD → goals → conduct/cards → FIFA rank) and the
  cross-group best-third ranking.
- `tiebreakNotes.js` — `softTiebreaks`, `softThirdTiebreaks`: detect placings
  separated only by conduct or FIFA ranking (the "⚖️" cases), used by the group
  tables and the third-place tie-breaker note.
- `standings.js` — small presentation helpers for the tables.

**Guaranteed outcomes**
- `clinch.js` — `computeClinch` plus `resolveClinchedSlots` / `resolveRunnerUpSlots`
  (fill group-winner/runner-up bracket slots), `newlyClinched`, `clinchHeadline`,
  `clinchBadge`. Marks teams 🥇/✅/❌ once mathematically settled.
- `eliminationCheck.js` — exact per-group scoreline enumeration for
  elimination/advancement, with a sound points-bound fallback.
- `opponentClinch.js` — `reachableThirdSets` (a **safe over-approximation** of the
  still-possible third-place sets — fine for demoting locks, over-claims if used to
  *add* candidates), `lockedOpponent`.

**Projection & bracket**
- `asItStands.js` — `projectKnockout`: the provisional "as it stands" R32
  projection, placing the eight qualifying thirds via Annexe C.
- `bracketResolve.js` — `resolveBracket` (full pipeline), `resolveKnockoutSlots`
  (propagate "Winner/Loser Match N" up the rounds), `resolveThirdPlaceSlots`,
  `resolveLockedThirdSlots`, `decideMatch` (winner/loser of a finished tie; null
  while live/drawn-without-pens). Conservative: a slot stays a placeholder until
  genuinely settled.
- `bracket.js` — `BRACKET` (two-sided layout), `matchesByNum`, `groupSlotMap`.
- `outlookEnum.js` — the (group-stage-only) R32 Outlook: goal-difference margin
  enumeration with weighted per-group dedup. Runs in a web worker.

**Group-stage tools & misc**
- `scenarios.js` — deterministic what-if picks; `groupStageArchived` (retires the
  group-stage-only tabs once every group game is final).
- `time.js` — `formatTime`, `tzAbbrev`, `statusFlag`, `teamKickoffTooltip`.
- `week.js`, `search.js`, `urlState.js`, `ics.js` — week-calendar bucketing,
  filtering, shareable-URL (de)serialization, `.ics` generation.

## `src/components` & `src/context`

`App.jsx` is the shell: data loop, filters, timezone, spoiler mode, view routing,
and the group-stage-archived gating. Views: `Standings`, `Bracket`, `WeekView`,
plus the group-stage `ScenariosView` / `OutlookView`. Cards/modals: `MatchCard`,
`MatchDetail`, `DayMatchesModal`, `GroupGamesModal`, `CalendarModal`, `Filters`,
`NextMatch`, `LiveBadge`, `ScoreCheck`. Cross-cutting state lives in
`context/` (`follow.jsx` for starred teams, `detail.js` for the match-detail modal).

The bracket's **potential-matchup** display (a "Winner Match N" slot expanding to
the candidate pair, cascading round by round) lives in `Bracket.jsx`'s
`feederTeams` helper — round-agnostic and per-slot by construction.

## `scripts` — CI, monitoring & contribution

Run with `node scripts/<name>.mjs`; the npm aliases are in `package.json`. These
must use **only Node built-ins and in-repo source** (no npm deps) — enforced by
`test/scripts-runtime.test.js` — so the autofill workflow can run without `npm ci`.

- **Schedule drift** — `check-schedule-drift.mjs` (+ pure core `schedule-core.mjs`,
  fixers `schedule-fix-core.mjs`): validate stored kickoffs/venues against FIFA
  (authority) with ESPN/TheSportsDB/OpenFootball corroboration. Groups keyed by
  team pair; knockouts keyed by FIFA match number, with a resolved-team feed-
  consensus fallback when FIFA is unreachable. `npm run check:schedule`.
- **Sync readiness** — `check-sync-readiness.mjs` (+ `cuptxt.mjs`): verify the
  upstream OpenFootball `cup.txt` / `cup_finals.txt` still name every group and
  resolved-knockout match under the spellings the autofill expects.
  `npm run check:sync`.
- **Contribution** — `openfootball-autofill.mjs` (+ `autofill-core.mjs`): write
  confirmed final scores back to OpenFootball when ESPN + TheSportsDB agree.
- **Other guards** — `check-bracket-consistency.mjs` (our bracket vs the official
  draw), `check-feed-freshness.mjs`, `active-window.mjs` (is a match window open?),
  `coverage-badge.mjs`, `outlook-snapshot.mjs`, `openfootball-edits.mjs`.

## Outside `src`

- `netlify/functions/calendar.js` — the auto-updating `webcal://` `.ics` feed
  (fetches the live schedule per request; mirrors `utils/ics.js` formatting).
- `test/` — Vitest suite (units + jsdom component tests). Fixtures in
  `test/fixtures/` freeze real upstream data (`official-kickoffs.js`,
  `final-group-results.js`, `cup-txt-snapshot.txt`, …) as regression anchors.

## Conventions

- **Purity downstream of the merge.** Logic takes a `matches` array and returns
  derived data; no module mutates its input. Tests pass synthetic `matches`.
- **Conservative resolution.** Clinch/bracket code only commits an outcome when
  mathematically guaranteed; provisional views (projection, outlook) are where
  "what could happen" lives.
- **Canonical names.** Every feed normalises to the `src/data/teams.js` spelling
  at ingestion; aliases live next to each feed (`normEspn`, `normSdb`, `cupName`).
- **Module header comments are the spec.** Before changing a util, read its top
  comment — it states the invariant the rest of the code (and tests) rely on.
