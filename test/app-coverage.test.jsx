import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react'
import App from '../src/App.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { LIVE_SOURCE } from '../src/services/espn.js'
import { RESULTS_SOURCE } from '../src/services/results.js'

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) }))
  window.history.replaceState(null, '', '/')
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// --- ESPN scoreboard payload builders -------------------------------------
function espnEvent({ home, away, date, state, hs, as, goals = [] }) {
  const homeId = '1'
  const awayId = '2'
  const details = goals.map((g) => ({
    scoringPlay: true,
    team: { id: g.side === 'home' ? homeId : awayId },
    clock: { displayValue: `${g.minute}'` },
    athletesInvolved: [{ shortName: g.name }],
  }))
  return {
    id: `${home}-${away}`,
    date,
    competitions: [
      {
        status: { type: { state } },
        competitors: [
          { homeAway: 'home', team: { id: homeId, displayName: home }, score: hs },
          { homeAway: 'away', team: { id: awayId, displayName: away }, score: as },
        ],
        details,
      },
    ],
    status: {
      type: {
        state,
        shortDetail: state === 'in' ? "67'" : state === 'post' ? 'FT' : '',
        description: state === 'in' ? 'In Progress' : state === 'post' ? 'Full Time' : '',
      },
    },
  }
}

function fetchWith(espnEvents) {
  return vi.fn(async (url) => {
    if (typeof url === 'string' && url.startsWith(LIVE_SOURCE.url)) {
      return { ok: true, json: async () => ({ events: espnEvents }) }
    }
    return { ok: true, json: async () => ({ matches: [] }) }
  })
}

describe('App coverage', () => {
  it('mounts and shows the header', () => {
    render(<App />)
    expect(screen.getByText(/World Cup 2026/)).toBeInTheDocument()
  })

  it('toggles the global spoiler (hideScores) button and resets day overrides', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Scores shown/ }))
    expect(screen.getByRole('button', { name: /Scores hidden/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Scores hidden/ }))
    expect(screen.getByRole('button', { name: /Scores shown/ })).toBeInTheDocument()
  })

  it('toggles theme (covers toggleTheme writing localStorage + dataset)', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Toggle theme/ }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('wc2026:theme')).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: /Toggle theme/ }))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('opens and closes the calendar modal', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Calendar/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/All 104 matches/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /Close/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('per-day spoiler + collapse toggles work', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      render(<App />)
      const dayBtn = screen.getByRole('button', { name: /July 19, 2026/ })
      const daySection = dayBtn.closest('section.day')
      const spoiler = within(daySection).getByRole('button', { name: /Hide scores|Show scores/ })
      fireEvent.click(spoiler) // toggleDay
      fireEvent.click(spoiler)
      fireEvent.click(dayBtn) // toggleCollapsed
      expect(dayBtn).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(dayBtn)
      expect(dayBtn).toHaveAttribute('aria-expanded', 'true')
    } finally {
      vi.useRealTimers()
    }
  })

  // Pinned mid-tournament: the toggle is only interactive while matches remain
  // (once concluded it renders unticked + disabled — covered below).
  it('toggles auto-refresh checkbox and the manual Refresh button', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      render(<App />)
      const auto = screen.getByRole('checkbox', { name: /auto/i })
      expect(auto).toBeChecked()
      expect(auto).toBeEnabled()
      fireEvent.click(auto)
      expect(auto).not.toBeChecked()
      fireEvent.click(screen.getByRole('button', { name: /Refresh/ }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('disables the auto-refresh toggle once the tournament has concluded', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z')) // after the Final
    try {
      render(<App />)
      const auto = screen.getByRole('checkbox', { name: /auto/i })
      expect(auto).toBeDisabled()
      expect(auto).not.toBeChecked()
    } finally {
      vi.useRealTimers()
    }
  })

  it('hydrates state from the URL (view, tz, hide, filters)', () => {
    window.history.replaceState(
      null,
      '',
      '/?view=bracket&tz=America/New_York&hide=1&q=team:%20Brazil&group=A&mine=0',
    )
    render(<App />)
    expect(screen.getByRole('button', { name: /Bracket/ }).className).toMatch(/active/)
    expect(screen.getByText(/America\/New York/)).toBeInTheDocument()
  })

  it('switches to week, groups, bracket views', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Week/ }))
    expect(screen.getByText(/World Cup 2026/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Groups/ }))
    expect(screen.getByText('Group A')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Bracket/ }))
    expect(screen.getByText(/World Cup 2026/)).toBeInTheDocument()
    // The Radial view renders the circular bracket (RadialBracket).
    fireEvent.click(screen.getByRole('button', { name: /Radial/ }))
    expect(document.querySelector('.bracket-view')).toBeTruthy()
    // Stats is the last nav entry and mounts StatsView in its own main.
    fireEvent.click(screen.getByRole('button', { name: /Stats/ }))
    expect(document.querySelector('.stats-view')).toBeTruthy()
  })

  it('"As it stands" link in Groups jumps to the Bracket and focuses a match', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      // Finished Group A matches so "As it stands" projects matchNum links.
      global.fetch = fetchWith([
        espnEvent({
          home: 'Mexico',
          away: 'South Africa',
          date: '2026-06-11T19:00:00Z',
          state: 'post',
          hs: '2',
          as: '0',
        }),
        espnEvent({
          home: 'South Korea',
          away: 'Czechia',
          date: '2026-06-12T02:00:00Z',
          state: 'post',
          hs: '1',
          as: '1',
        }),
      ])
      render(<App />)
      await vi.waitFor(() => expect(screen.getByText(/with scores/)).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /Groups/ }))
      const link = document.querySelector('button.ais-match-link')
      expect(link).toBeTruthy()
      fireEvent.click(link)
      expect(screen.getByRole('button', { name: /Bracket/ }).className).toMatch(/active/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows empty state when filters match nothing', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Filters & Search/ }))
    fireEvent.click(screen.getByRole('button', { name: /🔍 Search/ }))
    fireEvent.change(screen.getByPlaceholderText(/team: Mexico/), {
      target: { value: 'team: Atlantis' },
    })
    expect(screen.getByText(/No matches match your filters/)).toBeInTheDocument()
  })

  it('clear-all resets filters', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Filters & Search/ }))
    fireEvent.click(screen.getByRole('button', { name: /🔍 Search/ }))
    fireEvent.change(screen.getByPlaceholderText(/team: Mexico/), {
      target: { value: 'team: Brazil' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Clear all/ }))
    expect(screen.queryByRole('button', { name: /Clear all/ })).not.toBeInTheDocument()
  })

  it('My Teams button appears after following and toggles', () => {
    render(
      <FollowProvider>
        <App />
      </FollowProvider>,
    )
    // Past days collapse once the tournament is underway; expand one so a match
    // card (and its Follow buttons) is in the DOM regardless of the current date.
    if (screen.queryAllByRole('button', { name: /^Follow / }).length === 0) {
      const toggle = document.querySelector('.day-toggle')
      if (toggle) fireEvent.click(toggle)
    }
    fireEvent.click(screen.getAllByRole('button', { name: /^Follow / })[0])
    const myTeams = screen.getByRole('button', { name: /My Teams/ })
    fireEvent.click(myTeams)
    expect(myTeams.className).toMatch(/active/)
    fireEvent.click(myTeams)
    expect(myTeams.className).not.toMatch(/active/)
  })

  // --- live / results merge + results bar ---------------------------------
  it('renders live + finished scores, updated time, and live counter', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T19:30:00Z'))
    try {
      const live = espnEvent({
        home: 'Mexico',
        away: 'South Africa',
        date: '2026-06-11T19:00:00Z',
        state: 'in',
        hs: '1',
        as: '0',
        goals: [{ side: 'home', name: 'Jimenez', minute: 23 }],
      })
      const finished = espnEvent({
        home: 'South Korea',
        away: 'Czechia',
        date: '2026-06-12T02:00:00Z',
        state: 'post',
        hs: '2',
        as: '1',
      })
      global.fetch = fetchWith([live, finished])
      render(<App />)
      await vi.waitFor(() => expect(screen.getByText(/live now/)).toBeInTheDocument())
      expect(screen.getByText(/with scores/)).toBeInTheDocument()
      expect(screen.getByText(/updated/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows error state when the OpenFootball feed fails', async () => {
    global.fetch = vi.fn(async (url) => {
      if (typeof url === 'string' && url.startsWith(RESULTS_SOURCE.url)) {
        return { ok: false, status: 500, json: async () => ({}) }
      }
      return { ok: true, json: async () => ({ events: [], matches: [] }) }
    })
    render(<App />)
    await screen.findByText(/Couldn’t reach results feed/)
  })

  it('advances the live poll timer (30s when something is live)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T19:30:00Z'))
    try {
      const live = espnEvent({
        home: 'Mexico',
        away: 'South Africa',
        date: '2026-06-11T19:00:00Z',
        state: 'in',
        hs: '1',
        as: '0',
      })
      global.fetch = fetchWith([live])
      render(<App />)
      await vi.waitFor(() => expect(screen.getByText(/live now/)).toBeInTheDocument())
      const before = global.fetch.mock.calls.length
      await vi.advanceTimersByTimeAsync(31000)
      expect(global.fetch.mock.calls.length).toBeGreaterThan(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops polling once the tournament has concluded', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z')) // after the Final — nothing left to play
    try {
      global.fetch = fetchWith([])
      render(<App />)
      // Let the one-shot mount fetches settle.
      await vi.advanceTimersByTimeAsync(1000)
      const before = global.fetch.mock.calls.length
      // Advance well past the slow (2 min) poll interval: no new fetches, because
      // the auto-refresh interval is never armed once the tournament is over.
      await vi.advanceTimersByTimeAsync(200000)
      expect(global.fetch.mock.calls.length).toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })

  // --- goal alerts --------------------------------------------------------
  // Toasts don't need Notification permission, so enabling never blocks on it.
  it('toggleGoalAlerts: no Notification support -> still enables (toasts-only)', async () => {
    const origNotif = global.Notification
    const origWinNotif = window.Notification
    delete global.Notification
    delete window.Notification
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    try {
      render(<App />)
      const cb = screen.getByRole('checkbox', { name: /goals/ })
      fireEvent.click(cb)
      await waitFor(() => expect(cb).toBeChecked())
      expect(alertSpy).not.toHaveBeenCalled()
    } finally {
      global.Notification = origNotif
      window.Notification = origWinNotif
    }
  })

  it('toggleGoalAlerts: requestPermission rejects -> still enables, no alert', async () => {
    class FakeNotification {
      static permission = 'default'
      static requestPermission = vi.fn(async () => {
        throw new Error('user dismissed')
      })
    }
    global.Notification = FakeNotification
    window.Notification = FakeNotification
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    try {
      render(<App />)
      const cb = screen.getByRole('checkbox', { name: /goals/ })
      fireEvent.click(cb)
      await waitFor(() => expect(cb).toBeChecked())
      expect(FakeNotification.requestPermission).toHaveBeenCalled()
      expect(alertSpy).not.toHaveBeenCalled()
    } finally {
      delete global.Notification
      delete window.Notification
    }
  })

  it('raises an on-page toast with no notification permission, stacks the next goal, and suppresses a desynced flood', async () => {
    // No Notification at all: the on-page toast is the whole point of raising
    // both, because a focused tab is exactly when the OS tends to mute them.
    localStorage.setItem('wc2026:goalAlerts', JSON.stringify({ enabled: true, scope: 'all' }))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T19:00:00Z'))
    try {
      let goals = []
      global.fetch = vi.fn(async (url) => {
        if (typeof url === 'string' && url.startsWith(LIVE_SOURCE.url)) {
          return {
            ok: true,
            json: async () => ({
              events: [
                espnEvent({
                  home: 'Mexico',
                  away: 'South Africa',
                  date: '2026-06-11T19:00:00Z',
                  state: 'in',
                  hs: String(goals.length),
                  as: '0',
                  goals,
                }),
              ],
            }),
          }
        }
        return { ok: true, json: async () => ({ events: [] }) }
      })
      render(<App />)
      await vi.waitFor(() => expect(screen.getByText(/live now/)).toBeInTheDocument())

      goals = [{ side: 'home', name: 'First', minute: 12 }]
      await vi.advanceTimersByTimeAsync(31000)
      const region = () => screen.getByRole('region', { name: /Goal alerts/ })
      await vi.waitFor(() => expect(region().textContent).toMatch(/First/))

      // A second goal arrives while the first toast is still up. Toasts retire
      // after 8s and the live poll is 30s apart, so the only way two share the
      // screen is a manual refresh — which is exactly when the new batch has to
      // be diffed against what is already showing rather than replacing it.
      goals = [...goals, { side: 'home', name: 'Second', minute: 20 }]
      fireEvent.click(document.querySelector('.results-refresh'))
      await vi.advanceTimersByTimeAsync(100)
      await vi.waitFor(() => expect(region().textContent).toMatch(/Second/))
      expect(region().textContent).toMatch(/First/)

      // A feed gap restoring a pile of goals at once is a desync, not six goals
      // in thirty seconds — it is dropped rather than spammed onto the page.
      const before = region().textContent
      goals = [...goals, ...Array.from({ length: 6 }, (_, i) => ({ side: 'home', name: `Flood${i}`, minute: 30 + i }))]
      fireEvent.click(document.querySelector('.results-refresh'))
      await vi.advanceTimersByTimeAsync(100)
      expect(region().textContent).toBe(before)
      expect(region().textContent).not.toMatch(/Flood/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('toggleGoalAlerts: granted -> enables, scope select, toggle scope, disable', async () => {
    class FakeNotification {
      static permission = 'granted'
      static requestPermission = vi.fn(async () => 'granted')
    }
    global.Notification = FakeNotification
    window.Notification = FakeNotification
    try {
      render(<App />)
      const cb = screen.getByRole('checkbox', { name: /goals/ })
      fireEvent.click(cb)
      await waitFor(() => expect(cb).toBeChecked())
      const scope = screen.getByRole('combobox', { name: /Goal-alert scope/ })
      fireEvent.change(scope, { target: { value: 'all' } })
      expect(scope.value).toBe('all')
      fireEvent.click(cb)
      await waitFor(() => expect(cb).not.toBeChecked())
    } finally {
      delete global.Notification
      delete window.Notification
    }
  })

  it('fires goal notifications when a new goal arrives in a live match (scope all)', async () => {
    const fired = []
    class FakeNotification {
      constructor(title, opts) {
        fired.push({ title, opts })
      }
      static permission = 'granted'
      static requestPermission = vi.fn(async () => 'granted')
    }
    global.Notification = FakeNotification
    window.Notification = FakeNotification
    localStorage.setItem('wc2026:goalAlerts', JSON.stringify({ enabled: true, scope: 'all' }))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T19:30:00Z'))
    try {
      let goals = []
      global.fetch = vi.fn(async (url) => {
        if (typeof url === 'string' && url.startsWith(LIVE_SOURCE.url)) {
          return {
            ok: true,
            json: async () => ({
              events: [
                espnEvent({
                  home: 'Mexico',
                  away: 'South Africa',
                  date: '2026-06-11T19:00:00Z',
                  state: 'in',
                  hs: String(goals.length),
                  as: '0',
                  goals,
                }),
              ],
            }),
          }
        }
        return { ok: true, json: async () => ({ matches: [] }) }
      })
      render(<App />)
      await vi.waitFor(() => expect(screen.getByText(/live now/)).toBeInTheDocument())
      goals = [{ side: 'home', name: 'Jimenez', minute: 23 }]
      await vi.advanceTimersByTimeAsync(31000)
      await vi.waitFor(() => expect(fired.length).toBeGreaterThan(0))
      expect(fired[0].title).toMatch(/GOAL/)
      // …and the same goal raises an on-page toast; its ✕ dismisses it. The toast is
      // a separate state update from the Notification, so wait for it rather than
      // assuming both landed in the same flush.
      const toast = await vi.waitFor(() => screen.getByRole('region', { name: /Goal alerts/ }))
      expect(toast.textContent).toMatch(/Jimenez/)
      fireEvent.click(screen.getByLabelText('Dismiss'))
      expect(screen.queryByRole('region', { name: /Goal alerts/ })).toBeNull()
    } finally {
      vi.useRealTimers()
      delete global.Notification
      delete window.Notification
    }
  })

  it('clicking the goal notification focuses the tab and opens that match', async () => {
    // The notification is the way back into the app from another window, so its
    // click has to do three things: raise the tab, open the match that scored,
    // and close itself so it does not linger once acted on.
    const made = []
    class FakeNotification {
      constructor(title, opts) {
        this.title = title
        this.opts = opts
        this.close = vi.fn()
        made.push(this)
      }
      static permission = 'granted'
      static requestPermission = vi.fn(async () => 'granted')
    }
    global.Notification = FakeNotification
    window.Notification = FakeNotification
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    localStorage.setItem('wc2026:goalAlerts', JSON.stringify({ enabled: true, scope: 'all' }))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T19:00:00Z'))
    try {
      let goals = []
      global.fetch = vi.fn(async (url) => {
        if (typeof url === 'string' && url.startsWith(LIVE_SOURCE.url)) {
          return {
            ok: true,
            json: async () => ({
              events: [espnEvent({ home: 'Mexico', away: 'South Africa', date: '2026-06-11T19:00:00Z', state: 'in', hs: String(goals.length), as: '0', goals })],
            }),
          }
        }
        return { ok: true, json: async () => ({ events: [] }) }
      })
      render(<App />)
      await vi.waitFor(() => expect(screen.getByText(/live now/)).toBeInTheDocument())

      goals = [{ side: 'home', name: 'Scorer', minute: 23 }]
      await vi.advanceTimersByTimeAsync(31000)
      await vi.waitFor(() => expect(made.length).toBeGreaterThan(0))

      const note = made[0]
      expect(typeof note.onclick).toBe('function')
      await act(async () => {
        note.onclick()
      })
      expect(focus).toHaveBeenCalled()
      expect(note.close).toHaveBeenCalled()
      // The match that scored is now open in the detail modal.
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
      focus.mockRestore()
      delete global.Notification
      delete window.Notification
    }
  })

  it('goal notification swallows a constructor that throws', async () => {
    class FakeNotification {
      constructor() {
        throw new Error('cannot construct outside SW')
      }
      static permission = 'granted'
      static requestPermission = vi.fn(async () => 'granted')
    }
    global.Notification = FakeNotification
    window.Notification = FakeNotification
    localStorage.setItem('wc2026:goalAlerts', JSON.stringify({ enabled: true, scope: 'all' }))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-11T19:30:00Z'))
    try {
      let goals = []
      global.fetch = vi.fn(async (url) => {
        if (typeof url === 'string' && url.startsWith(LIVE_SOURCE.url)) {
          return {
            ok: true,
            json: async () => ({
              events: [
                espnEvent({
                  home: 'Mexico',
                  away: 'South Africa',
                  date: '2026-06-11T19:00:00Z',
                  state: 'in',
                  hs: String(goals.length),
                  as: '0',
                  goals,
                }),
              ],
            }),
          }
        }
        return { ok: true, json: async () => ({ matches: [] }) }
      })
      render(<App />)
      await vi.waitFor(() => expect(screen.getByText(/live now/)).toBeInTheDocument())
      goals = [{ side: 'home', name: 'Jimenez', minute: 23 }]
      // The throw inside the loop is caught; advancing the poll must not crash.
      await vi.advanceTimersByTimeAsync(31000)
      expect(screen.getByText(/live now/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
      delete global.Notification
      delete window.Notification
    }
  })

  it('toggleTheme swallows a localStorage.setItem failure', () => {
    render(<App />)
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    try {
      fireEvent.click(screen.getByRole('button', { name: /Toggle theme/ }))
      // Theme still flips even though persistence failed.
      expect(document.documentElement.dataset.theme).toBe('light')
    } finally {
      spy.mockRestore()
    }
  })

  it('readGoalAlerts swallows a corrupt localStorage value', () => {
    localStorage.setItem('wc2026:goalAlerts', '{not valid json')
    render(<App />)
    expect(screen.getByRole('checkbox', { name: /goals/ })).not.toBeChecked()
  })

  it('persist-goalAlerts effect swallows a localStorage.setItem failure', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === 'wc2026:goalAlerts') throw new Error('private mode')
    })
    try {
      // The persist effect runs on mount and its setItem throws — must be caught.
      render(<App />)
      expect(screen.getByText(/World Cup 2026/)).toBeInTheDocument()
    } finally {
      spy.mockRestore()
    }
  })

  it('hides and shows past days from the schedule', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: /Hide past days/ }))
      expect(screen.queryByRole('button', { name: /June 11, 2026/ })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Show past days/ }))
      expect(screen.getByRole('button', { name: /June 11, 2026/ })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens detail modal and closes it', () => {
    // Pin mid-tournament so match cards are on the schedule regardless of the
    // real date (post-tournament every day is collapsed/complete).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T16:00:00Z'))
    try {
      render(<App />)
      if (screen.queryAllByRole('button', { name: /Details/ }).length === 0) {
        const toggle = document.querySelector('.day-toggle')
        if (toggle) fireEvent.click(toggle)
      }
      fireEvent.click(screen.getAllByRole('button', { name: /Details/ })[0])
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: /Close/ }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
