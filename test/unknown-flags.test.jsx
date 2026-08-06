import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FollowProvider } from '../src/context/follow.jsx'
import { DetailContext } from '../src/context/detail.js'
import FeederPair from '../src/components/FeederPair.jsx'
import GroupGamesModal from '../src/components/GroupGamesModal.jsx'
import DayMatchesModal from '../src/components/DayMatchesModal.jsx'
import { MATCHES } from '../src/data/matches.js'

/**
 * Teams the flag table does not know.
 *
 * Every side of the app renders a flag beside a team name, and each does it the
 * same way: look the name up, fall back to a neutral mark when there is nothing
 * there. That is not a defensive nicety — a bracket before its feeders resolve
 * is full of names like "Winner Match 5", and a data refresh can rename a team
 * out from under the flag table. These render each of those places with a name
 * that has no flag and check the fallback appears rather than an empty gap.
 */

const NO_FLAG = 'Nowhere United'
const venueOf = MATCHES[0].venue
const TZ = 'UTC'

const wrap = (ui) => (
  <FollowProvider>
    <DetailContext.Provider value={vi.fn()}>{ui}</DetailContext.Provider>
  </FollowProvider>
)

describe('flag fallbacks for a team with no flag', () => {
  it('marks a feeder pair’s candidates', () => {
    render(wrap(<FeederPair feeder={{ type: 'group', group: 'A', candidates: [NO_FLAG] }} />))
    expect(document.querySelector('.feeder-flag').textContent).toBe('•')
  })

  it('marks both sides of a group fixture, the team header and the knockout line', () => {
    const fixtures = [
      {
        num: 9101,
        stage: 'Group',
        group: 'A',
        t1: NO_FLAG,
        t2: 'Elsewhere City',
        ko: '2027-06-11T15:00:00Z',
        venue: venueOf,
        score: [1, 1],
        pens: [4, 2],
      },
    ]
    render(
      wrap(
        <GroupGamesModal
          group="A"
          team={NO_FLAG}
          matches={fixtures}
          tz={TZ}
          hideScores={false}
          knockout={{ opponent: 'Someone Unknown', matchNum: 49 }}
          onClose={vi.fn()}
        />,
      ),
    )
    const flags = [...document.querySelectorAll('.gg-flag')].map((n) => n.textContent)
    expect(flags.length).toBeGreaterThan(0)
    expect(flags.every((f) => f === '•')).toBe(true)
    // A shootout in the group stage is not a thing, but the row renders one when
    // the data carries it rather than dropping the result.
    expect(document.querySelector('.gg-pens')).toBeTruthy()
  })

  it('marks both sides of a day-list row', () => {
    const day = [
      {
        num: 9102,
        stage: 'QF',
        t1: NO_FLAG,
        t2: 'Elsewhere City',
        ko: '2027-07-01T15:00:00Z',
        venue: venueOf,
        score: [2, 2],
        pens: [5, 3],
      },
    ]
    render(
      wrap(
        <DayMatchesModal
          matches={day}
          tz={TZ}
          hideScores={false}
          byNum={new Map()}
          onClose={vi.fn()}
        />,
      ),
    )
    const flags = [...document.querySelectorAll('.gg-flag')].map((n) => n.textContent)
    expect(flags).toEqual(['•', '•'])
    expect(document.querySelector('.gg-pens')).toBeTruthy()
  })
})
