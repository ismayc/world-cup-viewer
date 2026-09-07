import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LEAGUE } from '../src/config/league.js'

// index.html, public/manifest.webmanifest and package.json state this app's identity in
// files no ES module can import, so src/config/league.js cannot be their source. The
// pre-paint theme script in particular MUST stay a blocking classic script: a
// `type="module"` script is deferred by spec, and the flash of the wrong palette it
// exists to prevent would come straight back.
//
// So the duplication stays, and this file makes it a CHECKED duplicate. The pattern has
// already caught two live mismatches in this family: premier-league shipped browser
// chrome of #12121a against a page painting #15171b, and the hub's manifest disagreed
// with its own meta tag. the-nfl-schedule still declares a themeColor nothing matches.
//
// The storage prefix has a second reason to be here. test/guards.test.js matches storage
// keys with a single-quoted-literal regex, so once the nine keys in this repo became
// template literals it could only see the one in index.html, and it checks that against
// the family registry. Tying the config to index.html closes the chain:
// registry <- index.html <- LEAGUE.storageKey.
const ROOT = join(import.meta.dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

describe('the browser chrome agrees with src/config/league.js', () => {
  const html = read('index.html')

  it('titles the page with the full product title', () => {
    expect(html.match(/<title>([^<]+)<\/title>/)[1]).toBe(LEAGUE.title)
  })

  it('paints one background color across the page, the browser UI and the manifest', () => {
    // Dark is the family default, so the bare :root block carries the shipped color.
    const cssBg = read('src/index.css').match(/--bg:\s*(#[0-9a-f]{6})/i)[1].toLowerCase()
    const meta = html.match(/<meta\s+name="theme-color"\s+content="(#[0-9a-f]{6})"/i)[1]
    const manifest = JSON.parse(read('public/manifest.webmanifest'))

    expect(cssBg).toBe(LEAGUE.themeColor.toLowerCase())
    expect(meta.toLowerCase()).toBe(LEAGUE.themeColor.toLowerCase())
    expect(manifest.theme_color.toLowerCase()).toBe(LEAGUE.themeColor.toLowerCase())
    expect(manifest.background_color.toLowerCase()).toBe(LEAGUE.themeColor.toLowerCase())
  })

  it('reads the theme from this app own storage prefix before paint', () => {
    expect(html.match(/localStorage\.getItem\('([^']+)'\)/)[1]).toBe(`${LEAGUE.storageKey}:theme`)
  })

  it('names the installed app with the full product title', () => {
    expect(JSON.parse(read('public/manifest.webmanifest')).name).toBe(LEAGUE.title)
  })

  it('builds the .ics identity from the deploy slug', () => {
    // The UID domain is the slug with its hyphens removed, which is a real convention in
    // this family rather than an accident, so it is asserted as a derivation rather than
    // as a second literal.
    const slug = JSON.parse(read('package.json')).name
    expect(LEAGUE.feedHost).toBe(`https://${slug}.netlify.app`)
    expect(LEAGUE.ics.domain).toBe(slug.replace(/-/g, ''))
  })

  it('stamps the edition year into every UID', () => {
    // This edition has finished and its committed schedule will not change. A subscriber
    // who also holds a future edition's feed must not have one overwrite the other, so
    // the year is part of the UID rather than only part of the calendar name.
    expect(LEAGUE.ics.uidPrefix).toContain(String(LEAGUE.season))
    expect(LEAGUE.ics.filenameBase).toContain(String(LEAGUE.season))
    expect(LEAGUE.edition).toContain(String(LEAGUE.season))
    expect(LEAGUE.title).toContain(String(LEAGUE.season))
  })
})
