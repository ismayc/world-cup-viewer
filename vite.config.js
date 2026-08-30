import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the same build works both at the domain root (Netlify) and
  // under a sub-path (GitHub Pages: /world-cup-viewer/).
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Test files run one at a time. Vitest's v8 provider merges each worker's
    // coverage after the run, and with files in parallel that merge races. It has
    // surfaced three different ways in this family, all of them the same fault:
    // an ENOENT when a worker's temp JSON is read after the worker is gone
    // (premier-league), an unstable percentage between identical runs (the hub),
    // and a function reported uncovered while its own test demonstrably exercises
    // it (fiba, the-nba-schedule's App.jsx inline handlers). Every file passes in
    // isolation; only the parallel merge is unsafe.
    //
    // The cost is real but small where it matters. On a 2-core CI runner the
    // parallel run is already CPU-bound, so serialising changes the job length
    // little; on a many-core laptop it is roughly 4x (measured 2026-08-30 on
    // world-cup-viewer, the largest suite: 35s parallel, 132s serial). A
    // deterministic gate is worth that.
    //
    // All twelve app repos serialise as of 2026-08-30, and
    // sports-viewer-meta/scripts/audit-family.mjs asserts it so this stays true.
    fileParallelism: false,
    setupFiles: ['./test/setup.js'],
    // Full-app userEvent tests (past-day folding, the scenarios steppers) mount the
    // whole tree and click through it, which blows well past the default 5s ceiling
    // on a loaded CI runner under coverage instrumentation. Matches the headroom the
    // rest of the family already carries.
    testTimeout: 30000,
    // Pin the suite's timezone so any test asserting a day heading, or what counts
    // as "today", is runner-independent. UTC is what these tests were already
    // written against: CI's runners sit in UTC, so this changes nothing there. What
    // it fixes is the LOCAL run, which until now needed an explicit `TZ=UTC` prefix
    // and failed in a confusing way without one. test/guards.test.js asserts the pin
    // so it cannot be dropped unnoticed on an already-UTC runner.
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      all: true, // count untested files too, so the badge isn't flattered
      // netlify/functions is inside the gate as well as src. The subscription
      // endpoint is real shipped code that a subscriber's calendar hits directly,
      // and it sat outside coverage.include while the badge read 100%.
      include: ['src/**', 'netlify/functions/**'],
      exclude: ['src/main.jsx', 'src/**/*.test.{js,jsx}'],
      reporter: ['text-summary', 'json-summary', 'json'],
      // Enforced gate: the suite (and CI's coverage:badge step) fails if any
      // metric slips below 100%. Genuinely unreachable defensive arms carry an
      // inline `/* v8 ignore next -- why */` with a justification rather than
      // lowering these.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
