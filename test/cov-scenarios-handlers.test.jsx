import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MATCHES } from '../src/data/matches.js'
import { GROUP_STAGE_MD3 } from './fixtures/group-stage-md3.js'
import ScenariosView from '../src/components/ScenariosView.jsx'

// Live snapshot with the same partial group stage the main scenarios test uses.
const snapshot = MATCHES.map((m) =>
  m.stage === 'Group' && GROUP_STAGE_MD3[m.num] ? { ...m, score: GROUP_STAGE_MD3[m.num] } : m,
)

describe('ScenariosView — quick-pick + stepper handlers', () => {
  it('fires the away-win, draw and goal-decrement handlers', () => {
    render(<ScenariosView matches={snapshot} />)

    // getAllByTitle(/win$/i) yields [home0, away0, home1, away1, …]; clicking the
    // away button exercises the away-win quick-pick handler.
    fireEvent.click(screen.getAllByTitle(/win$/i)[1])
    // A draw quick-pick.
    fireEvent.click(screen.getAllByTitle('Draw')[0])

    // Set the first fixture to a home win so its score steppers appear, then
    // decrement the home goals — exercising the Stepper's minus button and the
    // first stepper's onChange (onScore) handler.
    fireEvent.click(screen.getAllByTitle(/win$/i)[0])
    const minus = screen.getAllByLabelText(/goals minus$/i)[0]
    expect(minus).toBeTruthy()
    fireEvent.click(minus)
    // Re-set the home win (the decrement cleared the steppers' enabled state) and
    // bump the SECOND (away) stepper to exercise its onChange (onScore) handler.
    fireEvent.click(screen.getAllByTitle(/win$/i)[0])
    const plus = screen.getAllByLabelText(/goals plus$/i)
    fireEvent.click(plus[plus.length - 1])
  })
})

describe('ScenariosView — every remaining match picked', () => {
  it('marks every projected matchup confirmed once the picks decide the whole group stage', () => {
    render(<ScenariosView matches={snapshot} />)

    // Quick-pick a home win for every remaining fixture. With nothing left
    // undecided on the synthetic board, the bracket it projects can no longer
    // change, so each matchup is confirmed outright rather than being checked
    // pair by pair.
    // getAllByTitle(/win$/i) yields [home0, away0, home1, away1, …]; re-query on
    // each pass because picking a fixture re-renders its row.
    const count = screen.getAllByTitle(/win$/i).length
    for (let i = 0; i < count; i += 2) fireEvent.click(screen.getAllByTitle(/win$/i)[i])

    expect(screen.queryAllByLabelText('Matchup confirmed').length).toBeGreaterThan(0)
  })
})
