import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MATCHES } from '../src/data/matches.js'
import { R32_SLOT_LABELS } from '../src/utils/outlookEnum.js'
import OutlookView from '../src/components/OutlookView.jsx'

// All group games scored → 0 remaining (≤ MAX_REMAINING), so the component enters
// the 'enumerating' phase and constructs a Worker — which we stub so the test can
// drive its messages (the real worker can't run in jsdom).
const COMPLETE = MATCHES.map((m) => (m.stage === 'Group' ? { ...m, score: [1, 0] } : m))
const NUMS = Object.keys(R32_SLOT_LABELS)
  .map(Number)
  .sort((a, b) => a - b)

let workerInstance
class FakeWorker {
  constructor() {
    workerInstance = this
    this.onmessage = null
    this.postMessage = vi.fn()
    this.terminate = vi.fn()
  }
}

beforeEach(() => {
  workerInstance = null
  globalThis.Worker = FakeWorker
})
afterEach(() => {
  delete globalThis.Worker
})

const send = (msg) => act(() => workerInstance.onmessage({ data: msg }))

function allLocked() {
  const perMatch = {}
  for (const n of NUMS) perMatch[n] = [
    { locked: 'Mexico', candidates: [] },
    { locked: 'Canada', candidates: [] },
  ]
  return { total: 1, remaining: 0, cap: 8, perMatch }
}

describe('OutlookView (enumeration result rendering)', () => {
  it('shows the enumerating progress bar, then renders the grid with locked / candidate / TBD sides', () => {
    render(<OutlookView matches={COMPLETE} />)
    // Worker was constructed and we're enumerating.
    expect(workerInstance).toBeTruthy()
    expect(screen.getByText(/Enumerating goal-difference outcomes/)).toBeInTheDocument()

    // A progress tick updates the percentage.
    send({ type: 'progress', done: 1, total: 2 })
    expect(screen.getByText(/Enumerating goal-difference outcomes… 50%/)).toBeInTheDocument()

    // One match has a non-locked side (candidates with >99 / mid / <1 formatting)
    // and an empty (TBD) opposite side; the rest are locked.
    const perMatch = {}
    for (const n of NUMS) perMatch[n] = [
      { locked: 'Mexico', candidates: [] },
      { locked: 'Canada', candidates: [] },
    ]
    perMatch[NUMS[0]] = [
      {
        locked: null,
        candidates: [
          { team: 'Spain', pct: 0.999 },
          { team: 'Brazil', pct: 0.5 },
          { team: 'Norway', pct: 0.001 },
        ],
      },
      { locked: null, candidates: [] },
    ]
    send({
      type: 'done',
      result: { total: 100, remaining: 1, cap: 6, perMatch },
      survivors: ['Ghana', 'Uzbekistan'],
      requirements: {
        Ghana: {
          ownGroupComplete: true,
          variable: [{ group: 'K', contenders: ['DR Congo', 'Senegal'] }],
          needAtLeast: 1,
          profile: { Pts: 4, GD: 0 },
        },
        Uzbekistan: {
          ownGroupComplete: false,
          ownGroup: 'L',
          thirdPts: 3,
          unresolvedGroups: ['K'],
        },
      },
    })

    // Header summary with the enumerated total + cap.
    expect(screen.getByText(/100/)).toBeInTheDocument()
    // "margins to ±6" appears in both the header summary and the exact-runs line.
    expect(screen.getAllByText(/margins to ±6/).length).toBeGreaterThan(0)
    // Candidate share formatting: >99, mid, <1.
    expect(screen.getByText('>99%')).toBeInTheDocument()
    expect(screen.getByText('<1%')).toBeInTheDocument()
    // Locked sides show the confirmed ✅; a TBD side shows the placeholder.
    expect(document.querySelector('.bo-confirmed')).toBeTruthy()
    expect(screen.getByText('To be determined')).toBeInTheDocument()

    // Hidden-alive net: one team with an exact checklist, one with the 3rd-place race.
    expect(screen.getByText(/Still mathematically alive/)).toBeInTheDocument()
    expect(screen.getByText(/Needs/)).toBeInTheDocument()
    expect(screen.getByText(/1 of 1/)).toBeInTheDocument()
    expect(screen.getByText(/Must finish/)).toBeInTheDocument()
    expect(screen.getByText(/3rd in Group L/)).toBeInTheDocument()
  })

  it('announces a fully-set bracket when every slot is locked and nobody is alive beyond the margins', () => {
    render(<OutlookView matches={COMPLETE} />)
    send({ type: 'done', result: allLocked(), survivors: [], requirements: {} })
    expect(screen.getByText(/Every Round-of-32 matchup is now mathematically set/)).toBeInTheDocument()
  })

  it('surfaces an enumeration error', () => {
    render(<OutlookView matches={COMPLETE} />)
    send({ type: 'error', message: 'boom' })
    expect(screen.getByText(/Enumeration failed: boom/)).toBeInTheDocument()
  })
})

describe('OutlookView — the messages and boards the grid also has to survive', () => {
  it('reads a done message with no survivors list as nobody alive beyond the margins', () => {
    // An older worker build (or one that bailed before the exact pass) posts a
    // result with no `survivors` key at all. That is "none", not a crash.
    render(<OutlookView matches={COMPLETE} />)
    send({ type: 'done', result: allLocked() })
    expect(screen.queryByText(/Still mathematically alive/)).toBeNull()
  })

  it('ignores a message of a kind it does not know', () => {
    render(<OutlookView matches={COMPLETE} />)
    send({ type: 'something-else' })
    // Still enumerating: an unknown message moves nothing.
    expect(screen.getByText(/Enumerating goal-difference outcomes/)).toBeInTheDocument()
  })

  it('marks locked sides, candidates and survivors the flag table has never heard of', () => {
    render(<OutlookView matches={COMPLETE} />)
    const perMatch = {}
    for (const n of NUMS) perMatch[n] = [
      { locked: 'Nowhere United', candidates: [] },
      { locked: 'Canada', candidates: [] },
    ]
    perMatch[NUMS[0]] = [
      { locked: null, candidates: [{ team: 'Elsewhere City', pct: 0.5 }] },
      { locked: null, candidates: [] },
    ]
    send({
      type: 'done',
      result: { total: 2, remaining: 1, cap: 6, perMatch },
      survivors: ['Somewhere Rovers'],
    })
    const flags = [...document.querySelectorAll('.bo-flag, .bo-cand-flag')].map((n) => n.textContent)
    expect(flags).toContain('•')
    expect(screen.getAllByText('Nowhere United').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Elsewhere City').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Somewhere Rovers').length).toBeGreaterThan(0)
  })

  it('counts a single remaining group game in the singular', () => {
    // Every group game final except one: the intro line says "1 group game left",
    // not "1 group games left".
    let left = 1
    const oneOpen = MATCHES.map((m) => {
      if (m.stage !== 'Group') return m
      if (left > 0) {
        left--
        return m // leave exactly one unplayed
      }
      return { ...m, score: [1, 0] }
    })
    render(<OutlookView matches={oneOpen} />)
    expect(screen.getByText(/group game left/)).toBeInTheDocument()
    expect(screen.queryByText(/group games left/)).toBeNull()
  })
})
