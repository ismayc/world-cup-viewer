import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENTRY_ROUND } from '../src/utils/slots.js'

// ScenariosView owns the `sc-` class namespace, and its classes were named after a
// round: `sc-r32-*` here, `sc-r16-*` in the euros sibling, and `sc-r32-*` in three
// viewers that have no R32 at all (womens-world-cup enters at the R16, copa at the
// quarter-finals, fiba at a qualifying round). A reader hitting `sc-r32-team` in the
// copa repo has been told something false.
//
// They are `sc-entry-*` now, after the round the groups feed into, which is what
// utils/slots.js already calls ENTRY_ROUND. That name stays true whatever the format.
//
// A class rename is silent when it goes wrong: a JSX class with no CSS rule renders
// unstyled, and a CSS rule with no JSX class is dead weight. Nothing in the suite
// noticed either before. These two assertions do, and they keep working long after
// this rename is forgotten.
const ROOT = join(import.meta.dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const classesInJsx = (src) => {
  const out = new Set()
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? ''
    for (const token of raw.split(/[\s${}?:'"]+/)) {
      if (token.startsWith('sc-')) out.add(token)
    }
  }
  return out
}

const classesInCss = (src) => {
  const out = new Set()
  for (const m of src.matchAll(/\.(sc-[a-z0-9-]+)/g)) out.add(m[1])
  return out
}

describe('the scenarios view class namespace', () => {
  const jsx = classesInJsx(read('src/components/ScenariosView.jsx'))
  const css = classesInCss(read('src/index.css'))

  it('names its entry-round classes after the round the groups feed into', () => {
    // Not after a specific round number, which is right in two repos of five and
    // misleading in the other three.
    const roundNamed = [...jsx, ...css].filter((c) => /^sc-r\d/.test(c))
    expect(roundNamed, `round-numbered classes: ${roundNamed.join(', ')}`).toEqual([])
    expect([...jsx].some((c) => c.startsWith('sc-entry'))).toBe(true)
    expect(typeof ENTRY_ROUND).toBe('string')
  })

  it('styles every class it renders', () => {
    const unstyled = [...jsx].filter((c) => !css.has(c))
    expect(unstyled, `rendered with no CSS rule: ${unstyled.join(', ')}`).toEqual([])
  })

  it('renders every class it styles', () => {
    // An orphan rule is what a half-finished rename leaves behind.
    const orphans = [...css].filter((c) => !jsx.has(c))
    expect(orphans, `styled but never rendered: ${orphans.join(', ')}`).toEqual([])
  })
})
