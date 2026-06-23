import { describe, it, expect } from 'vitest'
import { MATCHES } from '../src/data/matches.js'
import { projectKnockout } from '../src/utils/asItStands.js'

// Regression: once a group is clinched, the live feed resolves its R32 slot label
// ("Winner Group A") to the real team ("Mexico"). projectKnockout must read the
// slot structure from the STATIC schedule by match number, or it loses that
// winner's 1st projection AND the paired 3rd projection (both came back null).
describe('projectKnockout — resolved winner/third slot labels', () => {
  it('still projects every group when R32 winner slots are resolved to real teams', () => {
    // Resolve the three "winner v third" hosts the way the live feed would once
    // those groups are decided (this is what broke it: M74/M79/M81).
    const resolved = MATCHES.map((m) => {
      if (m.num === 79) return { ...m, t1: 'Mexico' } // was "Winner Group A"
      if (m.num === 74) return { ...m, t1: 'Germany' } // was "Winner Group E"
      if (m.num === 81) return { ...m, t1: 'USA' } // was "Winner Group D"
      return m
    })
    const { perGroup } = projectKnockout(resolved)

    // No group's 1st projection is lost…
    for (const g of Object.keys(perGroup)) {
      expect(perGroup[g].first, `group ${g} first`).toBeTruthy()
    }
    // …and the resolved winner hosts still point at their R32 match.
    expect(perGroup.A.first.matchNum).toBe(79)
    expect(perGroup.E.first.matchNum).toBe(74)
    expect(perGroup.D.first.matchNum).toBe(81)

    // The paired 3rd slots (the other side of those matches) also resolve: some
    // qualifying third must be projected into M79 / M74 / M81.
    const thirdMatchNums = Object.values(perGroup)
      .filter((p) => p.thirdQualifies && p.third)
      .map((p) => p.third.matchNum)
    for (const n of [74, 79, 81]) expect(thirdMatchNums, `a third in M${n}`).toContain(n)
  })
})
