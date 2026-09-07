// How to read a knockout match's bracket slot labels, and which round the group
// stage feeds into.
//
// This module exists in every sibling tournament viewer and was never back-ported
// here, which is where it was originally needed most: the same label grammar was
// written out as SIXTEEN regex literals across seven files, and the entry round as
// a bare 'R32' in ten more. Adding a group letter meant editing all of them and
// hoping none was missed.
//
// ── One difference from the siblings, on purpose ──────────────────────────────
//
// The other viewers export a `slotLabels(m)` that reads `m.label1 ?? m.t1`, because
// once a match is played their `t1`/`t2` hold the real teams and the drawn labels
// move to `label1`/`label2`. This edition's committed data carries NO label1/label2
// on any match, so that helper would be dead code here and is deliberately absent.
// If a future refresh starts writing those fields, add it then; do not port it now
// just because the siblings have it.
import { TEAMS } from '../data/teams.js'

// The knockout round the group stage feeds into. 48 teams in 12 groups: the top two
// of each, plus the eight best third-placed teams, make 32 — so the groups feed a
// ROUND OF 32. The best-thirds layer is why this edition needs
// data/thirdPlaceCombinations.js and the siblings that advance only the top two
// (womens-world-cup, copa) do not.
export const ENTRY_ROUND = 'R32'

// Group letters actually in use, as a regex character class, so a stray label naming
// a group this edition does not have fails to parse instead of resolving to nothing
// halfway through. The literals this replaced all hardcoded [A-L], which is right
// for twelve groups and silently wrong for any other number.
export const GROUP_CLASS = `[${Object.keys(TEAMS).join('')}]`

export const WINNER_GROUP = new RegExp(`^Winner Group (${GROUP_CLASS})$`)
export const RUNNERUP_GROUP = new RegExp(`^Runner-up Group (${GROUP_CLASS})$`)
export const WINNER_MATCH = /^Winner Match (\d+)$/
export const LOSER_MATCH = /^Loser Match (\d+)$/

// A best-third slot names the set of groups whose third-placed team can land in it,
// e.g. "3rd A/B/C/D/F". FIFA Annexe C decides which one actually does; see
// data/thirdPlaceCombinations.js.
export const THIRD_SLOT = new RegExp(`^3rd ${GROUP_CLASS}(?:/${GROUP_CLASS})*$`)

// Every match of the knockout round the groups feed into.
export function entryMatches(matches) {
  return matches.filter((m) => m.stage === ENTRY_ROUND)
}
