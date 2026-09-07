import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// `color-scheme` tells the browser which palette its OWN chrome should use: scrollbars,
// form controls, and the canvas it paints behind the document. It is not decorative and
// no amount of `background` on `body` substitutes for it. Without it a dark page gets
// light scrollbars.
//
// Six of the twelve apps in this family declared it and six did not, split along
// scaffolding lines rather than by any decision: the soccer and FIBA viewers had it, the
// hub, both March Madness repos and the three schedule repos did not. Nothing compared
// them, because each stylesheet is only ever read next to itself.
//
// Asserting the declarations exist is not enough on its own: they have to sit in the
// blocks that actually define each theme, or they describe the wrong palette.
const ROOT = join(import.meta.dirname, '..')
const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8')

// The text of a rule block, given the selector that opens it.
const block = (selectorPattern) => {
  const m = css.match(new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\n\\}`))
  return m ? m[1] : null
}

describe('the browser chrome follows the app theme', () => {
  it('declares the dark scheme in the block that defines the dark palette', () => {
    const dark = block(":root,\\s*\\n:root\\[data-theme='dark'\\]")
    expect(dark, 'no dark :root block found').not.toBeNull()
    expect(dark).toMatch(/color-scheme:\s*dark/)
    // Same block that sets the background, so the two cannot drift apart.
    expect(dark).toMatch(/--bg:/)
  })

  it('declares the light scheme in the block that defines the light palette', () => {
    const light = block(":root\\[data-theme='light'\\]")
    expect(light, 'no light :root block found').not.toBeNull()
    expect(light).toMatch(/color-scheme:\s*light/)
    expect(light).toMatch(/--bg:/)
  })

  it('does not declare a scheme it never defines a palette for', () => {
    const schemes = [...css.matchAll(/color-scheme:\s*([a-z ]+);/g)].map((m) => m[1].trim())
    expect(schemes.sort()).toEqual(['dark', 'light'])
  })
})
