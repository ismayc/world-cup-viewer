import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees between tests.
afterEach(() => cleanup())

// Default fetch stub so components that load results on mount don't hit the
// network during tests. Individual tests can override global.fetch.
if (!global.fetch) {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) }))
}

// jsdom has no matchMedia. Default to "not matching" (desktop / wide) so layout
// hooks render their wide variant; tests that need the mobile branch override
// window.matchMedia themselves.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}
