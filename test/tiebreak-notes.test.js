import { describe, it, expect } from 'vitest'
import { softTiebreaks } from '../src/utils/tiebreakNotes.js'

// Group A teams: Mexico, South Africa, South Korea, Czechia. Build a full
// round-robin so we can force exact ties down to the soft criteria.
const A = ['Mexico', 'South Africa', 'South Korea', 'Czechia']
const PAIRS = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
]
function groupA(scores, cards = {}) {
  return PAIRS.map(([i, j], k) => ({
    num: 100 + k,
    stage: 'Group',
    group: 'A',
    t1: A[i],
    t2: A[j],
    score: scores[k],
    cards: cards[k],
  }))
}

describe('softTiebreaks', () => {
  it('flags placings separated only by FIFA ranking', () => {
    // Every game 0-0: all four level on points, head-to-head, GD and goals, and
    // there are no cards — so the entire order is decided by FIFA ranking.
    const matches = groupA(PAIRS.map(() => [0, 0]))
    const notes = softTiebreaks('A', matches)
    expect(notes.size).toBe(4)
    for (const name of A) expect(notes.get(name).reason).toBe('fifa')
  })

  it('flags a placing separated by fair-play conduct (cards)', () => {
    // All 0-0, but Czechia picks up a red card → its conduct is worse, so the
    // pair straddling Czechia is separated by conduct rather than FIFA ranking.
    const cards = { 2: { t2: [{ color: 'red' }] } } // match Mexico v Czechia, Czechia carded
    const notes = softTiebreaks('A', groupA(PAIRS.map(() => [0, 0]), cards))
    expect(notes.get('Czechia').reason).toBe('conduct')
    expect(notes.get('Czechia').vs).toBeTruthy()
  })

  it('adds no note when placings are separated by points or goal difference', () => {
    // Mexico wins all, Czechia loses all, the middle two split — clear on points
    // and goal difference, so nothing is down to a soft tie-breaker.
    const scores = [
      [1, 0], // MX v SA
      [1, 0], // MX v SK
      [3, 0], // MX v CZ
      [1, 0], // SA v SK
      [2, 0], // SA v CZ
      [2, 0], // SK v CZ
    ]
    const notes = softTiebreaks('A', groupA(scores))
    expect(notes.size).toBe(0)
  })

  it('does not flag teams that are clear on head-to-head', () => {
    // Mexico and South Africa both end on 6 pts with identical GD/GF, but Mexico
    // beat South Africa head-to-head — so it's H2H, not a soft tie-breaker.
    const scores = [
      [1, 0], // MX v SA  -> Mexico wins the head-to-head
      [2, 0], // MX v SK
      [0, 0], // MX v CZ
      [0, 0], // SA v SK
      [2, 0], // SA v CZ
      [0, 0], // SK v CZ
    ]
    const notes = softTiebreaks('A', groupA(scores))
    expect(notes.has('Mexico')).toBe(false)
    expect(notes.has('South Africa')).toBe(false)
  })
})
