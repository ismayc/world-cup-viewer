import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'
import { enumerateOutlook, R32_SLOT_LABELS } from '../src/utils/outlookEnum.js'
import { computeQualification } from '../src/utils/qualification.js'
import { THIRD_PLACE_COMBINATIONS, THIRD_WINNER_ORDER } from '../src/data/thirdPlaceCombinations.js'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'

// Build a snapshot, then complete all incomplete groups EXCEPT `keepOpen` so the
// enumeration is small enough to brute-force a second, independent way.
function fixtureKeepingOpen(keepOpen) {
  const open = new Set(keepOpen)
  // Remaining matchday-3 games per group (from the snapshot).
  const REM = { D: [59, 60], I: [61, 62], H: [63, 64], G: [65, 66], L: [67, 68], K: [69, 70], J: [71, 72] }
  const fill = {}
  for (const g of Object.keys(REM)) {
    if (open.has(g)) continue
    for (const num of REM[g]) fill[num] = [1, 0] // arbitrary completed result
  }
  const scored = { ...GROUP_STAGE_MD3, ...fill }
  return MATCHES.map((m) => (m.stage === 'Group' && scored[m.num] ? { ...m, score: scored[m.num] } : m))
}

// ---- Independent reference enumerator (deliberately different code path) ----
// Recurses over the remaining games, builds the full synthetic match list, runs
// the production computeQualification, and resolves each R32 slot from scratch.
const SCORE = { W: [1, 0], D: [1, 1], L: [0, 1] }
const R32_STATIC = MATCHES.filter((m) => m.stage === 'R32')
function parse(label) {
  let m = /^Winner Group ([A-L])$/.exec(label)
  if (m) return { t: 'w', g: m[1] }
  m = /^Runner-up Group ([A-L])$/.exec(label)
  if (m) return { t: 'r', g: m[1] }
  if (/^3rd /.test(label)) return { t: '3' }
  return { t: 'o' }
}

function referenceEnumerate(matches) {
  const remaining = matches.filter(
    (m) => m.stage === 'Group' && !m.voided && !(Array.isArray(m.score) && !m.live),
  )
  const remNums = remaining.map((m) => m.num)
  const counts = {}
  for (const m of R32_STATIC) counts[m.num] = [{}, {}]
  const patterns = ['W', 'D', 'L']
  const choice = new Array(remaining.length)
  let total = 0

  const tally = () => {
    total++
    const override = {}
    remNums.forEach((num, i) => (override[num] = SCORE[choice[i]]))
    const syn = matches.map((m) => (override[m.num] ? { ...m, score: override[m.num] } : m))
    const q = computeQualification(syn)
    const W = {}
    const R = {}
    const T = {}
    for (const g of Object.keys(TEAMS)) {
      W[g] = q.groups[g][0].name
      R[g] = q.groups[g][1].name
      T[g] = q.groups[g][2].name
    }
    const key = q.thirds.slice(0, 8).map((t) => t.group).sort().join('')
    const combo = THIRD_PLACE_COMBINATIONS[key]
    const w2t = {}
    if (combo) THIRD_WINNER_ORDER.forEach((w, i) => (w2t[w] = combo[i]))
    for (const m of R32_STATIC) {
      const sides = [parse(m.t1), parse(m.t2)]
      for (let s = 0; s < 2; s++) {
        const sl = sides[s]
        let team = null
        if (sl.t === 'w') team = W[sl.g]
        else if (sl.t === 'r') team = R[sl.g]
        else if (sl.t === '3') {
          const o = sides[1 - s]
          if (o.t === 'w' && w2t[o.g]) team = T[w2t[o.g]]
        }
        if (team) counts[m.num][s][team] = (counts[m.num][s][team] || 0) + 1
      }
    }
  }

  const rec = (i) => {
    if (i === remaining.length) return tally()
    for (const p of patterns) {
      choice[i] = p
      rec(i + 1)
    }
  }
  rec(0)
  return { total, counts }
}

// Convert enumerateOutlook output to the reference's {num:[{team:count},{team:count}]} shape.
function toCounts(result) {
  const out = {}
  for (const num of Object.keys(result.perMatch)) {
    out[num] = result.perMatch[num].map((side) =>
      Object.fromEntries(side.candidates.map((c) => [c.team, c.count])),
    )
  }
  return out
}

describe('outlook enumeration — exact correctness vs an independent reference', () => {
  for (const keepOpen of [['D', 'G'], ['D', 'G', 'H'], ['H', 'K']]) {
    it(`matches the brute-force reference with groups ${keepOpen.join(',')} open`, () => {
      const fx = fixtureKeepingOpen(keepOpen)
      const mine = enumerateOutlook(fx)
      const ref = referenceEnumerate(fx)
      expect(mine.total).toBe(ref.total)
      expect(toCounts(mine)).toEqual(ref.counts)
    })
  }

  it('only ever places a team in a slot its group is allowed to fill', () => {
    const fx = fixtureKeepingOpen(['D', 'G', 'H'])
    const { perMatch } = enumerateOutlook(fx)
    const groupOf = (team) =>
      Object.keys(TEAMS).find((g) => TEAMS[g].some((t) => t.name === team))
    for (const m of R32_STATIC) {
      const labels = [m.t1, m.t2]
      labels.forEach((label, side) => {
        const s = parse(label)
        const allowed =
          s.t === 'w' || s.t === 'r'
            ? new Set([s.g])
            : s.t === '3'
              ? new Set(/^3rd ([A-L/]+)$/.exec(label)[1].split('/'))
              : null
        if (!allowed) return
        for (const c of perMatch[m.num][side].candidates) {
          expect(allowed.has(groupOf(c.team))).toBe(true)
        }
      })
    }
  })

  it('produces exact rational shares (every count is an integer out of the total)', () => {
    const fx = fixtureKeepingOpen(['D', 'G', 'H'])
    const { total, perMatch } = enumerateOutlook(fx)
    for (const num of Object.keys(perMatch)) {
      for (const side of perMatch[num]) {
        for (const c of side.candidates) {
          expect(Number.isInteger(c.count)).toBe(true)
          expect(c.pct).toBeCloseTo(c.count / total, 12)
        }
      }
    }
  })
})
