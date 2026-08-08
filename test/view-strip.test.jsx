import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App.jsx'

// jsdom has no IntersectionObserver (the App effect guards on that), so this stub is
// what turns the condensed-strip machinery ON for this file — and hands the observer
// callback to the tests so they can play the view switch scrolling out of / back
// into view.
let ioCb
let ioInstance
class IOStub {
  constructor(cb) {
    ioCb = cb
    ioInstance = this
    this.observe = vi.fn()
    this.disconnect = vi.fn()
  }
}

async function mount() {
  const result = render(<App />)
  await act(async () => {})
  return result
}

const navAway = () => act(() => ioCb([{ isIntersecting: false }]))
const navBack = () => act(() => ioCb([{ isIntersecting: true }]))
const strip = () => document.querySelector('.view-strip')

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [], matches: [] }) }))
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  vi.stubGlobal('IntersectionObserver', IOStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('condensed view strip', () => {
  it('watches the header view switch and appears only once it scrolls away', async () => {
    const { unmount } = await mount()
    expect(ioInstance.observe).toHaveBeenCalledWith(document.querySelector('.view-switch'))
    expect(strip()).toBeNull()

    navAway()
    expect(strip()).not.toBeNull()
    // Collapsed strip: just the current-view toggle, no tab set yet.
    const toggle = within(strip()).getByRole('button', { name: /📋 Schedule/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Views quick switch' })).toBeNull()

    navBack()
    expect(strip()).toBeNull()

    unmount()
    expect(ioInstance.disconnect).toHaveBeenCalled()
  })

  it('expands to the full tab set and switches views from mid-page', async () => {
    await mount()
    navAway()

    const toggle = within(strip()).getByRole('button', { name: /📋 Schedule/ })
    fireEvent.click(toggle)
    const tabs = screen.getByRole('navigation', { name: 'Views quick switch' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(within(tabs).getByRole('button', { name: '📊 Groups' }))
    // Picking a view switches the app and re-collapses the tab set…
    expect(screen.queryByRole('navigation', { name: 'Views quick switch' })).toBeNull()
    // …and both the strip toggle and the header switch now reflect the new view.
    expect(within(strip()).getByRole('button', { name: /📊 Groups/ })).toBeInTheDocument()
    const headerBtn = [...document.querySelectorAll('.view-switch .view-btn')].find(
      (b) => b.textContent === '📊 Groups'
    )
    expect(headerBtn.className).toContain('active')
  })

  it('closes an open tab set when the view switch scrolls back into view', async () => {
    await mount()
    navAway()
    fireEvent.click(within(strip()).getByRole('button', { name: /📋 Schedule/ }))
    expect(screen.getByRole('navigation', { name: 'Views quick switch' })).toBeInTheDocument()

    navBack()
    expect(strip()).toBeNull()

    // Scrolling away again must start collapsed, not resurrect the old open state.
    navAway()
    expect(screen.queryByRole('navigation', { name: 'Views quick switch' })).toBeNull()
  })
})
