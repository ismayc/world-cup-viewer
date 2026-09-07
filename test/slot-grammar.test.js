import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  ENTRY_ROUND,
  GROUP_CLASS,
  WINNER_GROUP,
  RUNNERUP_GROUP,
  WINNER_MATCH,
  LOSER_MATCH,
  THIRD_SLOT,
  entryMatches,
} from '../src/utils/slots.js'
import { MATCHES } from '../src/data/matches.js'
import { TEAMS } from '../src/data/teams.js'

// The bracket's label grammar used to be sixteen regex literals across seven files,
// and the entry round a bare 'R32' in ten more. Every sibling viewer had extracted
// utils/slots.js; this repo, where the duplication was worst, never got it back.
//
// Asserting the module's outputs would not have caught that. What catches it is
// looking for the SHAPE of the mistake: a hand-written label regex anywhere under
// src/utils. That is the same check that found six missed components in the FIBA
// viewer's separator sweep.
const UTILS = join(import.meta.dirname, '../src/utils')

describe('the slot grammar has exactly one definition', () => {
  it('is written out by hand nowhere under src/utils', () => {
    const offenders = []
    for (const f of readdirSync(UTILS).filter((n) => n.endsWith('.js') && n !== 'slots.js')) {
      const src = readFileSync(join(UTILS, f), 'utf8')
      for (const m of src.matchAll(/\/\^(?:Winner|Runner-up|Loser) (?:Group|Match)[^/\n]*\//g)) {
        offenders.push(`${f}: ${m[0]}`)
      }
      for (const m of src.matchAll(/\/\^3rd \[[^\]]*\]\+?\$\//g)) {
        offenders.push(`${f}: ${m[0]}`)
      }
    }
    expect(offenders, `hand-written slot regexes: ${offenders.join(' · ')}`).toEqual([])
  })

  it('names the entry round once, not as a bare string in the engines', () => {
    const offenders = []
    for (const f of readdirSync(UTILS).filter((n) => n.endsWith('.js') && n !== 'slots.js')) {
      const src = readFileSync(join(UTILS, f), 'utf8')
      // A stage comparison against the literal, rather than against ENTRY_ROUND.
      for (const m of src.matchAll(/stage\s*[!=]==\s*'R32'/g)) offenders.push(`${f}: ${m[0]}`)
    }
    expect(offenders, `bare entry-round comparisons: ${offenders.join(' · ')}`).toEqual([])
  })
})

describe('the grammar derives from this edition, not from a hardcoded range', () => {
  it('builds its group class from the groups that exist', () => {
    expect(GROUP_CLASS).toBe(`[${Object.keys(TEAMS).join('')}]`)
    expect(WINNER_GROUP.test('Winner Group A')).toBe(true)
    // The literals this replaced all said [A-L]. Right for twelve groups, silently
    // wrong for any other number, and a stray label would have parsed as nothing.
    expect(WINNER_GROUP.test('Winner Group M')).toBe(false)
    expect(RUNNERUP_GROUP.test('Runner-up Group M')).toBe(false)
  })

  it('parses every slot label the committed fixture list actually uses', () => {
    const patterns = [WINNER_GROUP, RUNNERUP_GROUP, WINNER_MATCH, LOSER_MATCH, THIRD_SLOT]
    const realTeams = new Set(Object.values(TEAMS).flat().map((t) => t.name))
    const unparsed = []
    for (const m of MATCHES) {
      if (m.stage === 'Group') continue
      for (const side of [m.t1, m.t2]) {
        if (typeof side !== 'string' || realTeams.has(side)) continue
        if (!patterns.some((p) => p.test(side))) unparsed.push(side)
      }
    }
    expect(unparsed, `slot labels no pattern matches: ${unparsed.join(' · ')}`).toEqual([])
  })

  it('finds the round the groups feed into', () => {
    expect(ENTRY_ROUND).toBe('R32')
    const entry = entryMatches(MATCHES)
    // 48 teams, 12 groups: top two of each plus the eight best thirds is 32.
    expect(entry).toHaveLength(16)
  })
})
