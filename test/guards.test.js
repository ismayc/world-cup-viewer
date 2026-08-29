// Repo-level guards: invariants about the project itself rather than about the
// competition. Each of these has bitten a viewer in this family before, so the
// same file lives in every sibling repo.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

function walk(dir) {
  const out = []
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel))
    else out.push(rel)
  }
  return out
}

const scripts = walk('scripts').filter((f) => f.endsWith('.mjs'))

describe('scripts runtime', () => {
  it('has scripts to check', () => {
    expect(scripts.length).toBeGreaterThan(0)
  })

  // The data-regeneration scripts run in CI with no `npm install` of app deps.
  // An npm import would work locally and fail in the workflow.
  it('imports only Node built-ins and in-repo source', () => {
    for (const file of scripts) {
      const src = read(file)
      const imports = [...src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
      for (const spec of imports) {
        const ok = spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../')
        expect(ok, `${file} imports "${spec}"`).toBe(true)
      }
    }
  })
})

describe('the ESPN host', () => {
  // site.api.espn.com serves the same routes but 403s from datacenter IPs AND
  // on a browser User-Agent, with no CORS headers. curl with its default UA
  // gets 200, so the host looks healthy from a terminal while every deployed
  // page silently loses live scores. site.web.api serves the same routes.
  it('is site.web.api everywhere it appears', () => {
    const files = [...scripts, 'src/services/espn.js'].filter((f) => existsSync(join(ROOT, f)))
    expect(files).toContain('src/services/espn.js')
    for (const file of files) {
      expect(read(file), file).not.toMatch(/site\.api\.espn\.com\/apis/)
    }
  })
})

describe('the storage namespace', () => {
  // The hub and all the sibling viewers are served from one origin
  // (ismayc.github.io), so localStorage is shared. A key prefix borrowed from a
  // sibling silently reads and writes that app's preferences. Verified against
  // every repo's source on 2026-08-29.
  const FAMILY = [
    ['pl:', 'premier-league'],
    ['nba:', 'the-nba-schedule'],
    ['wnba:', 'the-wnba-schedule'],
    ['nfl:', 'the-nfl-schedule'],
    ['st:', 'hub'],
    ['mmm:', 'the-mens-march-madness'],
    ['mmw:', 'the-womens-march-madness'],
    ['wc2026:', 'world-cup-viewer'],
    ['wwc:', 'womens-world-cup-viewer'],
    ['euros:', 'football-euros-viewer'],
    ['copa:', 'copa-america-viewer'],
    ['fwwc:', 'fiba-womens-world-cup-viewer'],
  ]
  const OWN = 'wc2026:'
  const files = [...walk('src'), 'index.html'].filter(
    (f) => /\.(js|jsx|html)$/.test(f) && existsSync(join(ROOT, f)),
  )

  it('knows its own prefix is in the family registry', () => {
    expect(FAMILY.map(([p]) => p)).toContain(OWN)
  })

  it('uses this app’s prefix, never a sibling’s', () => {
    for (const file of files) {
      const src = read(file)
      const keys = [...src.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*'([^']+)'/g)].map(
        (m) => m[1],
      )
      for (const key of keys) {
        expect(key.startsWith(OWN), `${file} uses storage key "${key}"`).toBe(true)
      }
    }
  })

  it('never mentions a sibling’s prefix', () => {
    // The leading quote matters: it keeps 'nba:' from matching 'wnba:theme'.
    for (const file of files) {
      const src = read(file)
      for (const [foreign, repo] of FAMILY) {
        if (foreign === OWN) continue
        expect(src.includes(`'${foreign}`), `${file} mentions ${repo}'s "${foreign}"`).toBe(false)
      }
    }
  })
})
