---
name: verify
description: Build, launch, and drive the World Cup viewer app to verify a change end-to-end in a real browser.
---

# Verifying changes in the running app

## Launch

```bash
npm run dev -- --port 5199 &   # Vite dev server; app at http://localhost:5199/
```

`base: './'` in vite.config.js — the app serves at the root path, no `/world-cup-viewer/` prefix needed in dev.

## Drive (headless browser)

No Playwright in devDependencies — import it from the npx cache. Find the newest copy and check whether its browsers are actually installed (the `ms-playwright` cache gets cleared periodically — an empty or missing dir is normal, not a broken setup):

```bash
for d in ~/.npm/_npx/*/node_modules/playwright; do echo -n "$d: "; node -p "require('$d/package.json').version"; done
ls ~/Library/Caches/ms-playwright 2>/dev/null   # no chromium_headless_shell-* => install below
```

If it's missing, install once (~94 MB, ~30s) against the newest version's dir:

```bash
cd ~/.npm/_npx/<hash> && node node_modules/playwright/cli.js install chromium
```

Then write a plain `.mjs` script in the scratchpad and run it with `node`, importing `chromium` from that dir's `playwright/index.mjs`.

Selectors that work:
- Wait for data: `.results-bar.results-ok` (OpenFootball feed loaded).
- Tabs: `button:has-text("📋 Schedule")`, `"📊 Groups"`, `"🏆 Bracket"`, `"🎯 Radial"`, `"👟 Stats"`.
- A schedule card is `.card`; find one via `page.locator('.card', { hasText: 'Match 101' })`. Opening the detail modal requires its `button:has-text("Details")` — clicking the card body does nothing.
- Detail modal: `.md-card`, close with `.md-close`.
- Spoiler toggle: `.spoiler-btn`.
- Champion state: `.champ-banner` (+ `.confetti`), `.nm-champ-runner`; radial centre is
  `.rb-trophy-won`, `.rb-crown`, `.rb-champ-name`; the winner's route is `.champ-trail` / `.on-trail`.

## Simulating future results (bracket / champion states)

Intercept the feeds with `page.route` and serve a doctored OpenFootball JSON — this drives the real merge pipeline instead of poking components:

```js
const raw = await (await fetch(OF_URL)).json()  // OF_URL = raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
// matches 73–102 are keyed by `num`; the 3rd-place match and Final by round
// names 'Match for third place' / 'Final'. Set team1/team2 + score:
// { ft: [a,b], et: [...cumulative after ET], p: [pens] }.
await page.route(OF_URL + '*', (r) => r.fulfill({ json: raw }))
await page.route('**/site.api.espn.com/**', (r) => r.fulfill({ json: { events: [] } }))
await page.route('**/thesportsdb.com/**', (r) => r.fulfill({ json: {} }))
```

## Gotchas

- The ESPN live overlay can mark matches live/delayed around real kickoffs — block it (above) when you need deterministic state.
- Rendering logic is time-of-day sensitive (countdowns, "past days" folding); don't assert exact times.
- **`innerText` returns null on SVG `<text>`** (the whole radial bracket). Use `.textContent()`, and
  confirm it actually rendered with `.isVisible()` / `.boundingBox()` rather than trusting a text match.
- **Don't assert with loose attribute globs.** `[class*="active"]` matches the nav's `view-btn active`,
  and a `/Champions/` body-text regex matches the champion banner from any tab — both read as false
  passes. Target the specific class, and check `evaluateAll(els => els.map(e => e.className))` when a
  count is non-zero but you can't say which element it is.
