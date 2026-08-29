---
name: verify
description: Build, launch, and drive the World Cup viewer app to verify a change end-to-end in a real browser.
---

# Verifying changes in the running app

Probed against this app on 2026-08-29. This file used to be a copy of
`world-cup-viewer`'s and described that app; everything below was checked here.
If a selector does not resolve, re-probe and fix this file rather than working
around it.

## Launch

```bash
npm run dev -- --port 5199 &   # Vite dev server; app at http://localhost:5199/
```

`base: './'` in vite.config.js, so the app serves at the root path: no
`/world-cup-viewer/` prefix is needed in dev.

## Drive (headless browser)

No Playwright in devDependencies, so import it from the npx cache. Find the newest
copy and check whether its browsers are actually installed (the `ms-playwright`
cache gets cleared periodically, so an empty or missing dir is normal rather than a
broken setup):

```bash
for d in ~/.npm/_npx/*/node_modules/playwright; do echo -n "$d: "; node -p "require('$d/package.json').version"; done
ls ~/Library/Caches/ms-playwright 2>/dev/null   # no chromium_headless_shell-* => install below
```

If it's missing, install once (~94 MB, ~30s) against the newest version's dir:

```bash
cd ~/.npm/_npx/<hash> && node node_modules/playwright/cli.js install chromium
```

Then write a plain `.mjs` script in the scratchpad and run it with `node`,
importing `chromium` from that dir's `playwright/index.mjs`.

## Feeds

```
FEED  = https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
ESPN  = https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
```

Matches 73-102 are keyed by `num`; the third-place match and the Final by the round
names 'Match for third place' and 'Final'. A result is `{ ft: [a,b], et: [...cumulative
after extra time], p: [pens] }`.

## Pin the feeds for a deterministic run

World Cup 2026 is finished, so the committed board already carries every result and
the champion is real. You rarely need to invent results; what you need is for the
feeds to stop moving. Fetch once and replay:

```js
const body = JSON.stringify(await (await fetch(FEED)).json())
await page.route(FEED + '*', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body }))
await page.route('**/site.api.espn.com/**', (r) => r.fulfill({ json: { events: [] } }))
await page.route('**/thesportsdb.com/**', (r) => r.fulfill({ json: {} }))
```

Note the ESPN host is **`site.api`** here, not `site.web.api`. Routing the wrong
one stubs nothing. (The FIBA sibling is the opposite way round.)

## Selectors that work

- **Shell**: `.app-header`, `.results-bar` (state class, `.results-bar.results-ok`
  on success), `.view-bar`, `.view-btn`, `.view-btn.active`, `.spoiler-btn`.
- **Tabs**: `📋 Schedule`, `📆 Week`, `📊 Groups`, `🏆 Bracket`, `🎯 Radial`, `👟 Stats`.
  Match on the word, not the emoji: `page.locator('.view-btn', { hasText: 'Groups' })`.
- **Schedule**: `.day`, `.day-header`, and `.card` once a day is open. See the
  first gotcha below: `.card` is **0** on a fresh load.
  A card's buttons are `☆` (one per team), `📺 How to watch (US) ▼`,
  `＋ Add to calendar`, `ℹ Details`.
- **Detail modal**: `.md-card`, close with `.md-close`. It exists only while open.
- **Groups**: `.standings-toolbar`, `.standings-grid`, `.group-card`,
  `.standings-table`, `.as-it-stands`, `.ais-title`, `.ais-list`.
- **Bracket**: `.bracket-wrap`, `.path-picker`, `.bracket`, `.bx-col`,
  `.bx-col-head`, `.bx-col-body`, `.bx-match`, `.bx-meta`, `.bx-side`,
  `.bx-score`, `.bx-venue`.
- **Week**: `.weekview`, `.week-nav`, `.week-title`, `.week-legend`, `.week-grid`,
  `.week-col`, `.week-col-head`, `.week-col-body`, `.wc-time`, `.wc-team`, `.wc-mid`.
- **Stats**: `.stats-wrap`, `.stats-strip`, `.stat-tile`, `.boot-section`, `.boot-table`.
- **Champion**: `.champ-banner` (+ `.confetti`), `.nm-champ-runner`. Spain won
  World Cup 2026, so the banner is present on a fresh load and reads "Spain are the 2026 World Champions!".
- **Radial**: `.radial-wrap`, `.rb-svg`, `.rb-ring-label`, `.rb-matchup`, `.rb-node`,
  `.rb-flag`, `.rb-score`, `.rb-hint`; champion centre is `.rb-trophy-won`, `.rb-crown`,
  `.rb-champ-name`; the winner's route is `.champ-trail` / `.on-trail`. **These exist
  only while the Radial tab is open** — probing them from another tab reports a false
  miss.

## Gotchas

- **`.card` is 0 on a fresh load.** The Schedule opens with its days
  **collapsed**, so no cards are mounted. Click a `.day-header` (a `div`, not a
  button) first, then query `.card`. Every "find the card for match N" recipe has to
  open the right day before it can work.
- **`Scenarios` and the `Outlook` tab are gone.** They are group-phase tools and hide
  once the group stage is archived, which it is for this finished edition. Do not
  wait on them.
- This edition has 104 matches and the Final is match 104. Match numbers from
  a sibling (the World Cup's 104, its 73-102 knockout range) do not exist here.
- Rendering is time-of-day sensitive (countdowns, past-day folding); don't assert
  exact times.
- Scores can be hidden: `.spoiler-btn` toggles spoiler-free mode, and the champion
  banner is deliberately hidden while scores are hidden.
- **`innerText` returns null on SVG `<text>`.** Use `.textContent()`, and confirm
  with `.isVisible()` / `.boundingBox()` rather than trusting a text match.
- **Don't assert with loose attribute globs.** `[class*="active"]` also matches the
  nav's `view-btn active`, and a `/Champions/` body-text regex matches the champion
  banner from any tab. Target the specific class, and dump
  `evaluateAll(els => els.map(e => e.className))` when a count is non-zero but you
  cannot say which element it is.
