import { describe, it, expect } from 'vitest'
import {
  teamRecord,
  topScorers,
  scorerRanks,
  tournamentTotals,
  applyBootExtras,
  mergeLiveAssists,
  activeTeams,
} from '../src/utils/tournamentStats.js'

// Minimal match shapes — only the fields the aggregators read.
const m = (over) => ({ stage: 'Group', t1: 'Brazil', t2: 'Ghana', ...over })

describe('teamRecord', () => {
  const matches = [
    // Group: win, draw, loss (from Brazil's perspective; one as t2).
    m({ score: [3, 1], goals: {} }),
    m({ t1: 'Ghana', t2: 'Brazil', score: [2, 2] }),
    m({ score: [0, 1] }),
    // Knockout won on penalties after a 1–1 draw.
    m({ stage: 'R16', score: [1, 1], pens: [4, 2] }),
    // Knockout lost in extra time (score carries the ET result).
    m({ stage: 'QF', score: [1, 2], aet: true }),
  ]

  it('aggregates W/D/L, goals, and clean sheets across finished matches', () => {
    const r = teamRecord(matches, 'Brazil')
    expect(r.played).toBe(5)
    expect(r.w).toBe(2) // 3–1 + the shootout win
    expect(r.d).toBe(1)
    expect(r.l).toBe(2)
    expect(r.pensWon).toBe(1)
    expect(r.pensLost).toBe(0)
    expect(r.gf).toBe(3 + 2 + 0 + 1 + 1)
    expect(r.ga).toBe(1 + 2 + 1 + 1 + 2)
    expect(r.gd).toBe(r.gf - r.ga)
    expect(r.cleanSheets).toBe(0)
  })

  it('orients the score when the team is t2', () => {
    const r = teamRecord([m({ t1: 'Ghana', t2: 'Brazil', score: [0, 2] })], 'Brazil')
    expect(r.w).toBe(1)
    expect(r.gf).toBe(2)
    expect(r.ga).toBe(0)
    expect(r.cleanSheets).toBe(1)
  })

  it('ignores live and voided matches (a live score is provisional)', () => {
    const r = teamRecord(
      [m({ score: [2, 0], live: { minute: 60 } }), m({ score: [1, 0], voided: true })],
      'Brazil',
    )
    expect(r.played).toBe(0)
  })

  it('counts cards per side and reports card-data presence', () => {
    const withCards = m({
      score: [1, 0],
      cards: { t1: [{ color: 'yellow' }, { color: 'red' }], t2: [{ color: 'yellow' }] },
    })
    const r = teamRecord([withCards], 'Brazil')
    expect(r.hasCardData).toBe(true)
    expect(r.yellow).toBe(1)
    expect(r.red).toBe(1)
    expect(teamRecord([m({ score: [1, 0] })], 'Brazil').hasCardData).toBe(false)
  })

  it('a drawn knockout with no decisive shootout counts as a draw (not a guess)', () => {
    const r = teamRecord([m({ stage: 'SF', score: [0, 0] })], 'Brazil')
    expect(r.d).toBe(1)
  })

  it('`before` limits the record to matches that kicked off strictly earlier', () => {
    const timeline = [
      m({ ko: '2026-06-12T15:00:00-04:00', score: [1, 0] }),
      m({ ko: '2026-06-18T15:00:00-04:00', score: [2, 0] }), // simultaneous with cutoff
      m({ ko: '2026-06-24T15:00:00-04:00', score: [3, 0] }), // after cutoff
    ]
    const r = teamRecord(timeline, 'Brazil', { before: '2026-06-18T15:00:00-04:00' })
    expect(r.played).toBe(1)
    expect(r.gf).toBe(1)
    // No cutoff → everything counts.
    expect(teamRecord(timeline, 'Brazil').played).toBe(3)
  })
})

describe('topScorers', () => {
  const goal = (name, extra = {}) => ({ name, ...extra })

  it('aggregates goals per player+team, own goals excluded, penalties counted', () => {
    const matches = [
      m({
        score: [3, 1],
        goals: {
          t1: [goal('Vini'), goal('Vini', { penalty: true }), goal('Own Golo', { og: true })],
          t2: [goal('Partey')],
        },
      }),
      m({ score: [1, 0], goals: { t1: [goal('Vini')], t2: [] } }),
    ]
    const s = topScorers(matches)
    expect(s[0]).toMatchObject({ name: 'Vini', team: 'Brazil', goals: 3, pens: 1 })
    expect(s.find((x) => x.name === 'Own Golo')).toBeUndefined()
    expect(s.find((x) => x.name === 'Partey')).toMatchObject({ team: 'Ghana', goals: 1 })
  })

  it('merges diacritic spellings of the same player (ESPN vs OpenFootball)', () => {
    const matches = [
      m({ score: [1, 0], goals: { t1: [goal('Julián Quiñones')], t2: [] } }),
      m({ score: [1, 0], goals: { t1: [goal('Julian Quinones')], t2: [] } }),
    ]
    const s = topScorers(matches)
    expect(s).toHaveLength(1)
    expect(s[0].goals).toBe(2)
  })

  it('keeps the same name on different teams separate', () => {
    const matches = [
      m({ score: [1, 1], goals: { t1: [goal('Silva')], t2: [goal('Silva')] } }),
    ]
    expect(topScorers(matches)).toHaveLength(2)
  })

  it('includes goals from a live match and flags the entry', () => {
    const matches = [
      m({ score: [1, 0], live: { minute: 50 }, goals: { t1: [goal('Vini')], t2: [] } }),
    ]
    const s = topScorers(matches)
    expect(s[0].live).toBe(true)
  })

  it('never splits a tie at the cut line', () => {
    const matches = Array.from({ length: 6 }, (_, i) =>
      m({ score: [1, 0], goals: { t1: [goal(`P${i}`)], t2: [] } }),
    )
    const s = topScorers(matches, { limit: 3 })
    expect(s).toHaveLength(6) // all level on 1 goal — the whole tie stays
  })

  it('sorts by goals, then fewest penalties, then name', () => {
    const matches = [
      m({
        score: [4, 0],
        goals: {
          t1: [goal('A'), goal('A', { penalty: true }), goal('B'), goal('B')],
          t2: [],
        },
      }),
    ]
    const s = topScorers(matches)
    expect(s.map((x) => x.name)).toEqual(['B', 'A'])
  })
})

describe('scorerRanks', () => {
  it('shares ranks across ties and skips past the block', () => {
    const ranks = scorerRanks([{ goals: 5 }, { goals: 4 }, { goals: 4 }, { goals: 3 }])
    expect(ranks).toEqual([1, 2, null, 4])
  })

  it('honours a custom levelling key', () => {
    const ranks = scorerRanks(
      [{ goals: 5, assists: 2 }, { goals: 5, assists: 1 }, { goals: 5, assists: 1 }],
      (s) => `${s.goals}|${s.assists}`,
    )
    expect(ranks).toEqual([1, 2, null])
  })
})

describe('applyBootExtras', () => {
  const s = (name, goals, pens = 0) => ({ name, team: 'X', goals, pens, live: false })

  it('joins by diacritic-insensitive name and re-sorts by the award criteria', () => {
    const scorers = [s('Lionel Messi', 8), s('Kylian Mbappe', 8), s('Erling Haaland', 7)]
    const extras = [
      { name: 'Lionel Messi', goals: 8, assists: 2, minutes: 530 },
      { name: 'Kylian Mbappé', goals: 8, assists: 4, minutes: 540 },
      { name: 'Erling Haaland', goals: 7, assists: 0, minutes: 600 },
    ]
    const { scorers: out, enriched } = applyBootExtras(scorers, extras)
    expect(enriched).toBe(true)
    // Mbappé's 4 assists beat Messi's 2 despite equal goals.
    expect(out.map((x) => x.name)).toEqual(['Kylian Mbappe', 'Lionel Messi', 'Erling Haaland'])
    expect(out[0]).toMatchObject({ assists: 4, minutes: 540 })
  })

  it('splits equal goals+assists on FEWEST minutes', () => {
    const { scorers: out } = applyBootExtras([s('A', 5), s('B', 5)], [
      { name: 'A', assists: 1, minutes: 600 },
      { name: 'B', assists: 1, minutes: 480 },
    ])
    expect(out.map((x) => x.name)).toEqual(['B', 'A'])
  })

  it('sorts unknown entries below covered ones on an otherwise-equal line', () => {
    const { scorers: out } = applyBootExtras([s('Unknown Player', 5), s('Covered', 5)], [
      { name: 'Covered', assists: 0, minutes: 90 },
    ])
    expect(out.map((x) => x.name)).toEqual(['Covered', 'Unknown Player'])
    expect(out[1].assists).toBeUndefined()
  })

  it('is a no-op without extras', () => {
    const scorers = [s('A', 5)]
    expect(applyBootExtras(scorers, null)).toEqual({ scorers, enriched: false })
    expect(applyBootExtras(scorers, [])).toEqual({ scorers, enriched: false })
  })
})

describe('mergeLiveAssists', () => {
  const extras = [
    { name: 'Lionel Messi', goals: 8, assists: 2, minutes: 530 },
    { name: 'Erling Haaland', goals: 7, assists: 0, minutes: 600 },
  ]

  it('adds live-match assists onto the season aggregate by name', () => {
    // Messi has assisted twice in a live match; aggregate still reads 2.
    const out = mergeLiveAssists(extras, [{ name: 'Lionel Messi', assists: 2 }])
    const messi = out.find((e) => e.name === 'Lionel Messi')
    expect(messi).toMatchObject({ assists: 4, goals: 8, minutes: 530 })
    // Untouched players stay put.
    expect(out.find((e) => e.name === 'Erling Haaland').assists).toBe(0)
  })

  it('joins diacritic-insensitively and adds live assisters the aggregate omits', () => {
    const out = mergeLiveAssists([{ name: 'Kylian Mbappé', assists: 1, goals: 3, minutes: 200 }], [
      { name: 'Kylian Mbappe', assists: 1 }, // no accent from the live feed
      { name: 'Morgan Rogers', assists: 1 }, // not in the aggregate at all
    ])
    expect(out.find((e) => e.name === 'Kylian Mbappé').assists).toBe(2)
    expect(out.find((e) => e.name === 'Morgan Rogers')).toMatchObject({
      assists: 1,
      goals: null,
      minutes: null,
    })
  })

  it('returns the aggregate untouched when nothing is live', () => {
    expect(mergeLiveAssists(extras, null)).toBe(extras)
    expect(mergeLiveAssists(extras, [])).toBe(extras)
  })
})

describe('activeTeams', () => {
  it('collects real teams from unplayed and live matches only', () => {
    const teams = activeTeams([
      m({ stage: 'SF', t1: 'France', t2: 'Spain' }), // unplayed → both active
      m({ stage: 'SF', t1: 'England', t2: 'Brazil', score: [1, 0], live: { minute: 70 } }), // live → active
      m({ stage: 'QF', t1: 'Ghana', t2: 'Mexico', score: [2, 0] }), // final → not active
      m({ stage: 'Final', t1: 'Winner Match 101', t2: 'Winner Match 102' }), // placeholders → skipped
      m({ t1: 'Canada', t2: 'Uruguay', voided: true }), // voided → skipped
    ])
    expect([...teams].sort()).toEqual(['Brazil', 'England', 'France', 'Spain'])
  })

  it('is empty once every match is final (the race is over)', () => {
    expect(activeTeams([m({ score: [1, 0] })]).size).toBe(0)
  })
})

describe('tournamentTotals', () => {
  it('counts finished matches only, with extra time and shootouts', () => {
    const t = tournamentTotals([
      m({ score: [2, 1] }),
      m({ score: [1, 1], pens: [5, 4] }),
      m({ score: [2, 1], aet: true }),
      m({ score: [9, 9], live: { minute: 12 } }), // live — excluded from totals
      m({}), // unplayed
    ])
    expect(t.played).toBe(3)
    expect(t.goals).toBe(3 + 2 + 3)
    expect(t.perMatch).toBeCloseTo(8 / 3)
    expect(t.et).toBe(1)
    expect(t.shootouts).toBe(1)
    expect(t.live).toBe(1)
  })
})
