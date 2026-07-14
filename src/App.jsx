import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MATCHES } from './data/matches.js'
import { VENUES } from './data/venues.js'
import Filters from './components/Filters.jsx'
import MatchCard from './components/MatchCard.jsx'
import Bracket from './components/Bracket.jsx'
import RadialBracket from './components/RadialBracket.jsx'
import Standings from './components/Standings.jsx'
import ScenariosView from './components/ScenariosView.jsx'
import OutlookView from './components/OutlookView.jsx'
import WeekView from './components/WeekView.jsx'
import StatsView from './components/StatsView.jsx'
import ChampionBanner from './components/ChampionBanner.jsx'
import NextMatch from './components/NextMatch.jsx'
import MatchDetail from './components/MatchDetail.jsx'
import CalendarModal from './components/CalendarModal.jsx'
import { groupStageArchived, stageArchived } from './utils/scenarios.js'
import { detectTimezone, formatDateLong, dayKey, liveState } from './utils/time.js'
import { readState, writeState } from './utils/urlState.js'
import { parseQuery, matchesSearch } from './utils/search.js'
import { fetchResults, applyResults, RESULTS_SOURCE, openFootballFinalScore } from './services/results.js'
import { fetchLive, applyLive, LIVE_SOURCE, espnFinalScore, historyDates } from './services/espn.js'
import { fetchBackup, BACKUP_SOURCE, sdbFinalScore } from './services/thesportsdb.js'
import { annotateScoreChecks } from './services/reconcile.js'
import { computeClinch } from './utils/clinch.js'
import { resolveBracket } from './utils/bracketResolve.js'
import { groupSlotMap, matchesByNum } from './utils/bracket.js'
import { detectGoals, goalNotification } from './services/goalNotify.js'
import { useFollow } from './context/follow.jsx'
import { DetailContext } from './context/detail.js'

const REFRESH_MS = 120000 // auto-refresh every 2 minutes when nothing is live
const LIVE_REFRESH_MS = 30000 // poll every 30s while a match is in progress

const VIEWS = [
  { id: 'schedule', label: '📋 Schedule' },
  { id: 'week', label: '📆 Week' },
  { id: 'groups', label: '📊 Groups' },
  // Scenarios + R32 Outlook are group-stage tools; they're hidden once the group
  // stage is in the rear-view (see `groupStageArchived`). The nav wraps to a
  // second row on mobile after Groups.
  { id: 'scenarios', label: '🧮 Scenarios', groupStageOnly: true },
  { id: 'outlook', label: '🔮 R32 Outlook', groupStageOnly: true },
  { id: 'bracket', label: '🏆 Bracket' },
  { id: 'radial', label: '🎯 Radial' },
  { id: 'stats', label: '👟 Stats' },
]

// Stages that collapse out of the Schedule once every one of their games is final,
// so the list stays focused on what's still to come. Each can be brought back via
// the stage filter (the schedule note's "Show …" button). Ordered earliest-first;
// the Final and third-place play-off are deliberately never auto-hidden.
const HIDEABLE_STAGES = [
  { stage: 'Group', title: 'Group stage', noun: 'group game' },
  { stage: 'R32', title: 'Round of 32', noun: 'Round-of-32 game' },
  { stage: 'R16', title: 'Round of 16', noun: 'Round-of-16 game' },
  { stage: 'QF', title: 'Quarter-finals', noun: 'quarter-final' },
  { stage: 'SF', title: 'Semi-finals', noun: 'semi-final' },
]

const INITIAL_FILTERS = {
  search: '',
  stages: [],
  group: 'all',
  team: 'all',
  country: 'all',
  region: 'all',
  venue: 'all',
  timeframe: 'all',
  feed: 'both',
  myTeams: false,
}

// Goal-alert preferences, persisted to localStorage. `enabled` is only honoured
// if the browser still grants Notification permission (it may have been revoked
// since), so the toggle reflects reality rather than a stale "on".
const GOAL_ALERTS_KEY = 'wc2026:goalAlerts'
function readGoalAlerts() {
  try {
    const v = JSON.parse(localStorage.getItem(GOAL_ALERTS_KEY) || '{}')
    const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted'
    return { enabled: Boolean(v.enabled) && granted, scope: v.scope === 'all' ? 'all' : 'followed' }
  } catch {
    return { enabled: false, scope: 'followed' }
  }
}

// How many filters are actively narrowing the results (ignores tz & feed view).
function countActiveFilters(f) {
  let n = 0
  if (f.search.trim()) n++
  if (f.myTeams) n++
  n += f.stages.length
  for (const k of ['group', 'team', 'country', 'region', 'venue', 'timeframe']) {
    if (f[k] !== 'all') n++
  }
  return n
}

export default function App() {
  const detectedTz = useMemo(detectTimezone, [])
  const initial = useMemo(() => readState(detectedTz), [detectedTz])
  const { followed, count: followCount } = useFollow()

  const [theme, setTheme] = useState(
    () => (typeof document !== 'undefined' && document.documentElement.dataset.theme) || 'dark',
  )
  const toggleTheme = () =>
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem('wc2026:theme', next)
      } catch {
        /* ignore */
      }
      return next
    })

  const [detailMatch, setDetailMatch] = useState(null)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [view, setView] = useState(initial.view)
  // A match number to focus in the bracket (set when an "As it stands" link is
  // clicked); the Bracket scrolls to and highlights it, then clears this.
  const [focusMatch, setFocusMatch] = useState(null)
  const goToBracketMatch = (num) => {
    setFocusMatch(num)
    setView('bracket')
  }
  const [tz, setTz] = useState(initial.tz)
  const [filters, setFilters] = useState(initial.filters)
  const [hideScores, setHideScores] = useState(initial.hideScores)
  // Filter panel is collapsed by default; opens automatically if a shared URL
  // arrives with filters already applied.
  const [filtersOpen, setFiltersOpen] = useState(() => countActiveFilters(initial.filters) > 0)
  // Per-day spoiler overrides: dayKey -> bool. Undefined means "follow global".
  const [dayOverrides, setDayOverrides] = useState({})
  // Per-day fold overrides: dayKey -> bool. Undefined means "follow default"
  // (past days collapsed, today + future expanded).
  const [collapsedDays, setCollapsedDays] = useState({})
  // Past days show by default (as collapsed headers); the button drops them
  // from the schedule entirely for a phone-clean view that opens on today.
  const [showPast, setShowPast] = useState(true)

  // Results merged into the static schedule from three independent sources:
  //   • OpenFootball (`results`) — source of record (post-match final scores).
  //   • ESPN (`live`) — best-effort live overlay (running score + clock).
  //   • TheSportsDB (`backup`) — best-effort backup + final-score cross-check.
  const [results, setResults] = useState(null)
  const [live, setLive] = useState(null)
  const [history, setHistory] = useState(null)
  const [backup, setBackup] = useState(null)
  const [resultsState, setResultsState] = useState('loading') // loading | ok | error
  const [updatedAt, setUpdatedAt] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [goalAlerts, setGoalAlerts] = useState(readGoalAlerts)
  const abortRef = useRef(null)
  // Last seen goal-key snapshot (match num -> Set), for diffing new goals.
  const goalSnapRef = useRef(null)

  const loadResults = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setResultsState((s) => (s === 'ok' ? 'ok' : 'loading'))
    // Fetch all three together; only OpenFootball gates the status bar — ESPN and
    // TheSportsDB are best-effort and never fail it.
    const [of, espn, sdb] = await Promise.allSettled([
      fetchResults(ctrl.signal),
      fetchLive(ctrl.signal),
      fetchBackup(ctrl.signal),
    ])
    if (espn.status === 'fulfilled') setLive(espn.value)
    if (sdb.status === 'fulfilled') setBackup(sdb.value)
    if (of.status === 'fulfilled') {
      setResults(of.value)
      setResultsState('ok')
      setUpdatedAt(Date.now())
    } else if (of.reason?.name !== 'AbortError') {
      setResultsState('error')
    }
  }, [])

  useEffect(() => {
    loadResults()
    return () => abortRef.current?.abort()
  }, [loadResults])

  // Backfill cards/subs for matches that finished before the live window. ESPN
  // drops them from the rolling scoreboard after a couple of days, so without an
  // explicit by-date fetch their detail timelines lose their 🟨🟥. This data is
  // static once a match ends, so we fetch it once (no polling) and overlay it
  // beneath the live window, which still wins for anything recent.
  useEffect(() => {
    const ctrl = new AbortController()
    fetchLive(ctrl.signal, historyDates(MATCHES))
      .then((map) => map.size && setHistory(map))
      .catch(() => {}) // best-effort; live + OpenFootball still render
    return () => ctrl.abort()
  }, [])

  // Merge into the schedule (immutably): OpenFootball first (source of record),
  // overlay ESPN's live/just-finished scores where OpenFootball has none, then
  // annotate each final with how many independent sources confirm it.
  const matches = useMemo(() => {
    const merged = applyLive(applyLive(applyResults(MATCHES, results), history), live)
    const sources = [
      results && { name: RESULTS_SOURCE.name, score: (m) => openFootballFinalScore(m, results) },
      // ESPN confirms via the live window OR the by-date backfill — otherwise a
      // finished match silently drops to "1 source" once it ages out of ESPN's
      // rolling 3-day scoreboard, even though ESPN still has the final.
      (live || history) && {
        name: LIVE_SOURCE.name,
        score: (m) => (live && espnFinalScore(m, live)) || (history && espnFinalScore(m, history)),
      },
      backup && { name: BACKUP_SOURCE.name, score: (m) => sdbFinalScore(m, backup) },
    ].filter(Boolean)
    return annotateScoreChecks(merged, sources)
  }, [results, live, history, backup])
  const finishedCount = useMemo(() => matches.filter((m) => m.score).length, [matches])
  const liveCount = useMemo(() => matches.filter((m) => m.live).length, [matches])
  // The group-stage tools (Scenarios, R32 Outlook) drop out of the nav a day
  // after the last group game, once the knockouts take over.
  const archived = useMemo(() => groupStageArchived(matches), [matches])
  const visibleViews = useMemo(
    () => VIEWS.filter((v) => !(v.groupStageOnly && archived)),
    [archived],
  )
  const showAnalysisTabs = !archived
  // If the active view just got hidden (group stage archived while on it), fall
  // back to the Bracket.
  useEffect(() => {
    if (!visibleViews.some((v) => v.id === view)) setView('bracket')
  }, [visibleViews, view])
  // Guaranteed clinch/elimination status per team (see utils/clinch.js).
  const clinch = useMemo(() => computeClinch(matches), [matches])
  // Group → Round-of-32 slot each finishing position feeds into.
  const slotMap = useMemo(() => groupSlotMap(MATCHES), [])
  // Resolve every settled knockout placeholder into the real team — group
  // winners + runners-up, third-place qualifiers (once the group stage is done),
  // and knockout-match winners/losers as each round plays — so the resolved team
  // reaches every view consistently (schedule, week, bracket, detail modal,
  // calendar), not just the bracket's own rendering.
  const displayMatches = useMemo(() => resolveBracket(matches, clinch), [matches, clinch])
  // Lookup for expanding "Winner Match N" slots into their potential matchup on
  // the Schedule/Week cards (same as the Bracket).
  const byNum = useMemo(() => matchesByNum(displayMatches), [displayMatches])

  // Auto-refresh: poll fast (30s) while a match is live so the score and clock
  // track ESPN closely, and slow (2 min) otherwise to go easy on the feeds.
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(loadResults, liveCount > 0 ? LIVE_REFRESH_MS : REFRESH_MS)
    return () => clearInterval(id)
  }, [autoRefresh, loadResults, liveCount])

  // Persist goal-alert preferences.
  useEffect(() => {
    try {
      localStorage.setItem(GOAL_ALERTS_KEY, JSON.stringify(goalAlerts))
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [goalAlerts])

  // Goal alerts: diff each merged snapshot against the last and raise a browser
  // notification for any new goal in a live match within scope. The snapshot is
  // always advanced (even when alerts are off) so enabling mid-match doesn't
  // replay the goals already on the board. Fires only while this tab is open —
  // the static site has no backend for true background push.
  useEffect(() => {
    const { next, events } = detectGoals(goalSnapRef.current, matches, {
      scope: goalAlerts.scope,
      followed,
    })
    goalSnapRef.current = next
    if (!goalAlerts.enabled) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    // Defense-in-depth: a healthy poll yields at most a couple of new goals. A
    // large batch means the snapshot desynced (e.g. a feed gap restoring many
    // matches at once) — suppress rather than spam. The snapshot is already
    // advanced above, so these stay silent and won't re-fire.
    if (events.length > 5) return
    const icon = `${import.meta.env.BASE_URL}icon-192.png`
    for (const ev of events) {
      const n = goalNotification(ev)
      try {
        new Notification(n.title, { body: n.body, tag: n.tag, icon, renotify: true })
      } catch {
        /* some browsers throw if constructed outside a SW; ignore */
      }
    }
  }, [matches, goalAlerts, followed])

  // Turn goal alerts on/off. Enabling needs Notification permission, which must be
  // requested from a user gesture (this click) — if denied, the toggle stays off.
  const toggleGoalAlerts = useCallback(async () => {
    if (goalAlerts.enabled) {
      setGoalAlerts((s) => ({ ...s, enabled: false }))
      return
    }
    if (typeof Notification === 'undefined') {
      alert('This browser does not support notifications.')
      return
    }
    let perm = Notification.permission
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission()
      } catch {
        perm = 'denied'
      }
    }
    if (perm === 'granted') setGoalAlerts((s) => ({ ...s, enabled: true }))
    else alert('Notifications are blocked. Allow them for this site in your browser settings.')
  }, [goalAlerts.enabled])

  // Keep the URL in sync with shareable state.
  useEffect(() => {
    writeState({ view, tz, hideScores, filters }, detectedTz)
  }, [view, tz, hideScores, filters, detectedTz])

  const dayHidden = (key) =>
    dayOverrides[key] !== undefined ? dayOverrides[key] : hideScores

  const toggleDay = (key) =>
    setDayOverrides((o) => ({ ...o, [key]: !dayHidden(key) }))

  // Today's dayKey in the viewer's timezone — days before it are "past" and
  // fold closed by default so the schedule opens on what's still to come.
  const todayKey = useMemo(() => dayKey(Date.now(), tz), [tz])
  const dayCollapsed = (key) =>
    collapsedDays[key] !== undefined ? collapsedDays[key] : key < todayKey
  const toggleCollapsed = (key) =>
    setCollapsedDays((c) => ({ ...c, [key]: !dayCollapsed(key) }))

  const activeCount = useMemo(() => countActiveFilters(filters), [filters])

  const filtered = useMemo(() => {
    const parsed = parseQuery(filters.search)
    return displayMatches.filter((m) => {
      const venue = VENUES[m.venue]
      if (filters.myTeams && followed.size && !(followed.has(m.t1) || followed.has(m.t2)))
        return false
      if (filters.stages.length && !filters.stages.includes(m.stage)) return false
      if (filters.group !== 'all' && m.group !== filters.group) return false
      if (filters.team !== 'all' && m.t1 !== filters.team && m.t2 !== filters.team) return false
      if (filters.country !== 'all' && venue.country !== filters.country) return false
      if (filters.region !== 'all' && venue.region !== filters.region) return false
      if (filters.venue !== 'all' && m.venue !== filters.venue) return false
      // liveState prefers real feed data: a scored match reads "finished" even
      // inside the time window, and only m.live (or a scoreless time-window
      // match) reads "live" — so "Live now" never shows a finished game.
      if (filters.timeframe !== 'all' && liveState(m) !== filters.timeframe) return false
      if (!matchesSearch(m, venue, parsed)) return false
      return true
    })
  }, [filters, displayMatches, followed])

  // Once a stage is fully played it drops out of the Schedule by default, so the
  // list opens on what's still to come — unless the user picks that stage's filter
  // to bring it back. Scoped to the Schedule list only (Week still shows all of
  // `filtered`). Applies as each round finishes (group stage, then Round of 32, …).
  const hiddenStages = useMemo(
    () => HIDEABLE_STAGES.filter((s) => stageArchived(matches, s.stage) && !filters.stages.includes(s.stage)),
    [matches, filters.stages],
  )
  const scheduleMatches = useMemo(() => {
    if (!hiddenStages.length) return filtered
    const hide = new Set(hiddenStages.map((s) => s.stage))
    return filtered.filter((m) => !hide.has(m.stage))
  }, [filtered, hiddenStages])
  // How many games each hidden stage is holding back (from the otherwise-filtered
  // set), for the "N … hidden" note. A stage with 0 (filtered out anyway) shows no note.
  const hiddenStageNotes = useMemo(
    () =>
      hiddenStages
        .map((s) => ({ ...s, count: filtered.filter((m) => m.stage === s.stage).length }))
        .filter((s) => s.count > 0),
    [hiddenStages, filtered],
  )

  const days = useMemo(() => {
    const map = new Map()
    for (const m of scheduleMatches) {
      const key = dayKey(m.ko, tz)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(m)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [scheduleMatches, tz])

  // Past days render as collapsed sections by default (and expand per-day as
  // usual); "Hide past days" drops them from the schedule entirely.
  const pastDayKeys = useMemo(
    () => days.map(([k]) => k).filter((k) => k < todayKey),
    [days, todayKey],
  )
  const visibleDays = showPast ? days : days.filter(([k]) => k >= todayKey)

  return (
    <DetailContext.Provider value={setDetailMatch}>
    <div className="app">
      <header className="app-header">
        <div className="title-block">
          <h1>
            <span className="trophy">🏆</span> World Cup 2026
          </h1>
          <p className="subtitle">
            All 104 matches · USA · Canada · Mexico · shown in{' '}
            <strong>{tz.replace(/_/g, ' ')}</strong>
          </p>
        </div>
        <div className="view-bar">
          <div className="view-switch">
            {visibleViews.map((v) => (
              <Fragment key={v.id}>
                <button
                  className={`view-btn${view === v.id ? ' active' : ''}`}
                  onClick={() => setView(v.id)}
                >
                  {v.label}
                </button>
                {/* Force a second row after Groups on mobile (only when the
                    analysis tabs are present). */}
                {v.id === 'groups' && showAnalysisTabs && <span className="view-break" aria-hidden="true" />}
              </Fragment>
            ))}
          </div>
          <div className="bar-actions">
            <button
              className={`spoiler-btn${hideScores ? ' active' : ''}`}
              onClick={() => {
                setHideScores((h) => !h)
                setDayOverrides({}) // global change resets per-day overrides
              }}
              title="Toggle spoiler-free mode for all scores"
            >
              {hideScores ? '🙈 Scores hidden' : '👁 Scores shown'}
            </button>
            <button className="icon-btn" onClick={() => setCalendarOpen(true)} title="Calendar subscribe & export">
              📤 Calendar
            </button>
            <button
              className="icon-btn"
              onClick={toggleTheme}
              title="Toggle light / dark theme"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? '🌙' : '🌞'}
            </button>
          </div>
        </div>
      </header>

      {/* Once the Final is FINAL, the champion gets their banner (hidden in
          spoiler-free mode — it's the ultimate spoiler). */}
      <ChampionBanner
        match={displayMatches.find((m) => m.num === 104)}
        hideScores={hideScores}
      />

      <div className={`results-bar results-${resultsState}`}>
        <span className="results-dot" />
        <span className="results-text">
          {resultsState === 'loading' && 'Loading live results…'}
          {resultsState === 'error' && 'Couldn’t reach results feed — showing schedule only.'}
          {resultsState === 'ok' && finishedCount > 0 && `${finishedCount} match${finishedCount === 1 ? '' : 'es'} with scores`}
          {resultsState === 'ok' && finishedCount === 0 && 'No results yet — kickoff is June 11, 2026'}
        </span>
        {liveCount > 0 && (
          <span className="results-live">● {liveCount} live now</span>
        )}
        {updatedAt && resultsState === 'ok' && (
          <span className="results-updated">
            updated{' '}
            {new Date(updatedAt).toLocaleTimeString('en-US', {
              timeZone: tz,
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        )}
        <span className="results-source">
          scores via{' '}
          <a href={RESULTS_SOURCE.homepage} target="_blank" rel="noopener noreferrer">
            {RESULTS_SOURCE.name}
          </a>
          {' · live via '}
          <a href={LIVE_SOURCE.homepage} target="_blank" rel="noopener noreferrer">
            {LIVE_SOURCE.name}
          </a>
          {' · checked vs '}
          <a href={BACKUP_SOURCE.homepage} target="_blank" rel="noopener noreferrer">
            {BACKUP_SOURCE.name}
          </a>
        </span>
        <label className="results-auto">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          auto
        </label>
        <label
          className="results-alerts"
          title="Browser notification when a goal is scored (while this tab is open)"
        >
          <input type="checkbox" checked={goalAlerts.enabled} onChange={toggleGoalAlerts} />
          🔔 goals
        </label>
        {goalAlerts.enabled && (
          <select
            className="results-alert-scope"
            value={goalAlerts.scope}
            onChange={(e) => setGoalAlerts((s) => ({ ...s, scope: e.target.value }))}
            title="Which matches trigger a goal alert"
            aria-label="Goal-alert scope"
          >
            <option value="followed">⭐ my teams</option>
            <option value="all">all matches</option>
          </select>
        )}
        <button className="results-refresh" onClick={loadResults} disabled={resultsState === 'loading'}>
          ⟳ Refresh
        </button>
      </div>

      {(view === 'schedule' || view === 'week') && (
        <>
          <div className="controls-bar">
            <button
              className={`filters-toggle${filtersOpen ? ' open' : ''}`}
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              ⚙ Filters &amp; Search
              {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
              <span className="chev">{filtersOpen ? '▲' : '▼'}</span>
            </button>
            {followCount > 0 && (
              <button
                className={`myteams-btn${filters.myTeams ? ' active' : ''}`}
                onClick={() => setFilters((f) => ({ ...f, myTeams: !f.myTeams }))}
                title="Show only matches with teams you follow"
              >
                ⭐ My Teams <span className="myteams-count">{followCount}</span>
              </button>
            )}
            {view === 'schedule' && pastDayKeys.length > 0 && (
              <button
                className="pastdays-btn"
                onClick={() => setShowPast((s) => !s)}
                title={showPast ? 'Hide past days from the schedule' : 'Show past days'}
              >
                <span className="chev" aria-hidden="true">{showPast ? '▾' : '▸'}</span>
                {showPast ? 'Hide past days' : 'Show past days'}
                <span className="myteams-count">{pastDayKeys.length}</span>
              </button>
            )}
            {activeCount > 0 && (
              <button className="clear-mini" onClick={() => setFilters(INITIAL_FILTERS)}>
                Clear all
              </button>
            )}
          </div>
          {filtersOpen && (
            <Filters
              filters={filters}
              setFilters={setFilters}
              tz={tz}
              setTz={setTz}
              detectedTz={detectedTz}
              resultCount={filtered.length}
            />
          )}
        </>
      )}

      {view === 'week' && (
        <main className="week-view">
          <WeekView allMatches={displayMatches} shown={filtered} tz={tz} dayHidden={dayHidden} />
        </main>
      )}

      {view === 'schedule' && (
        <>
          <NextMatch matches={displayMatches} tz={tz} />
          {hiddenStageNotes.map((s) => (
            <p key={s.stage} className="schedule-note">
              {s.title} complete — {s.count} {s.noun}
              {s.count === 1 ? '' : 's'} hidden.{' '}
              <button
                className="linklike"
                onClick={() => setFilters((f) => ({ ...f, stages: [...new Set([...f.stages, s.stage])] }))}
              >
                Show {s.noun}s
              </button>
            </p>
          ))}
          <main className="schedule">
            {days.length === 0 && (
              <div className="empty">
                <p>No matches match your filters.</p>
              </div>
            )}
            {visibleDays.map(([key, matches]) => {
              const hidden = dayHidden(key)
              const collapsed = dayCollapsed(key)
              return (
                <section key={key} id={`day-${key}`} className={`day${collapsed ? ' collapsed' : ''}`}>
                  <div className="day-header">
                    <button
                      className="day-toggle"
                      onClick={() => toggleCollapsed(key)}
                      aria-expanded={!collapsed}
                    >
                      <span className="day-chev" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
                      <h2>{formatDateLong(matches[0].ko, tz)}</h2>
                      <span className="day-count">
                        {matches.length} match{matches.length === 1 ? '' : 'es'}
                      </span>
                    </button>
                    {!collapsed && (
                      <button className="day-spoiler" onClick={() => toggleDay(key)}>
                        {hidden ? '🙈 Show scores' : '👁 Hide scores'}
                      </button>
                    )}
                  </div>
                  {!collapsed && (
                    <div className="day-matches">
                      {matches.map((m) => (
                        <MatchCard key={m.num} match={m} tz={tz} feed={filters.feed} hidden={hidden} clinch={clinch} slotMap={slotMap} byNum={byNum} />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </main>
        </>
      )}

      {view === 'groups' && (
        <main className="groups-view">
          <Standings matches={matches} tz={tz} hideScores={hideScores} clinch={clinch} onGoToMatch={goToBracketMatch} />
        </main>
      )}

      {view === 'scenarios' && (
        <main className="scenarios-view">
          <ScenariosView matches={matches} />
        </main>
      )}

      {view === 'outlook' && (
        <main className="outlook-view">
          <OutlookView matches={matches} />
        </main>
      )}

      {view === 'bracket' && (
        <main className="bracket-view">
          <Bracket
            matches={displayMatches}
            tz={tz}
            hideScores={hideScores}
            focusMatch={focusMatch}
            onFocusHandled={() => setFocusMatch(null)}
          />
        </main>
      )}

      {view === 'radial' && (
        <main className="bracket-view">
          <RadialBracket matches={displayMatches} tz={tz} hideScores={hideScores} />
        </main>
      )}

      {view === 'stats' && (
        <main className="stats-view">
          <StatsView matches={displayMatches} hideScores={hideScores} />
        </main>
      )}

      <footer className="app-footer">
        <p>
          Kickoff times convert automatically to your selected timezone. Broadcast info is for the
          United States — FOX &amp; Telemundo are free over the air. Schedule per the FIFA Final
          Draw (Dec 5, 2025); kickoff times are cross-checked daily against FIFA&rsquo;s official
          schedule. Filters, timezone &amp; view are saved to the URL — bookmark or share it.
        </p>
        <p className="disclaimer">
          An unofficial fan-made project. Not affiliated with, endorsed by, or sponsored by FIFA.
          “World Cup”, team, broadcaster, and tournament names are trademarks of their respective
          owners. Schedule &amp; results data via{' '}
          <a href={RESULTS_SOURCE.homepage} target="_blank" rel="noopener noreferrer">OpenFootball</a>{' '}
          (public domain); live in-match scores via{' '}
          <a href={LIVE_SOURCE.homepage} target="_blank" rel="noopener noreferrer">ESPN</a>; final
          scores cross-checked against{' '}
          <a href={BACKUP_SOURCE.homepage} target="_blank" rel="noopener noreferrer">TheSportsDB</a>.
        </p>
        <p className="credit">
          Created by{' '}
          <a href="https://chester.rbind.io" target="_blank" rel="noopener noreferrer">
            Chester Ismay
          </a>{' '}
          ·{' '}
          <a
            href="https://github.com/ismayc/world-cup-viewer"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source on GitHub
          </a>
        </p>
      </footer>

      {detailMatch && (
        <MatchDetail
          match={detailMatch}
          tz={tz}
          hideScores={hideScores}
          allMatches={displayMatches}
          onClose={() => setDetailMatch(null)}
        />
      )}
      {calendarOpen && (
        <CalendarModal
          matches={displayMatches}
          filtered={filtered}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
    </DetailContext.Provider>
  )
}
