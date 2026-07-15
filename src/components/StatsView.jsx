import { useEffect, useMemo, useRef, useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { STAGE_LABELS } from '../data/matches.js'
import {
  topScorers,
  scorerRanks,
  tournamentTotals,
  applyBootExtras,
  applyPlayerStatOverrides,
  nameKey,
  activeTeams,
  extraTimeMatches,
  shootoutMatches,
} from '../utils/tournamentStats.js'
import { fetchBootExtras, fetchRecentPlayerStats } from '../services/espnStats.js'

// A match's assists can lag ESPN's season aggregate for a while after the final
// whistle, so we recompute them from live/recent box scores for this long after
// kickoff — comfortably past the lag, then the aggregate is trusted again.
const RECENT_MS = 24 * 60 * 60 * 1000
import { useDetail } from '../context/detail.js'
import PlayerDetail from './PlayerDetail.jsx'

// Tournament stats: headline totals plus the Golden Boot race. Goals are
// derived from the merged match list (OpenFootball for finished matches, ESPN
// for live ones), so a goal shows here moments after it lands on the
// scoreboard. Assists and minutes played — the official award tie-breakers —
// come from ESPN's leaders data (best-effort): when they load, the table is
// ordered exactly as the award would be; until then it falls back to goals,
// fewest penalties, name.

// One row of the tile drill-down: the tie, its decisive score, and how it was
// settled. Clicking opens the full match detail.
function StatMatchRow({ match, onOpen }) {
  return (
    <li>
      <button className="stat-match-row" onClick={() => onOpen(match)}>
        <span className="smr-stage">{STAGE_LABELS[match.stage]}</span>
        <span className="smr-line">
          {FLAG_BY_TEAM[match.t1]} {match.t1} {match.score[0]}–{match.score[1]} {match.t2}{' '}
          {FLAG_BY_TEAM[match.t2]}
        </span>
        <span className="smr-extra">
          {match.pens ? `pens ${match.pens[0]}–${match.pens[1]}` : 'after extra time'}
        </span>
      </button>
    </li>
  )
}

export default function StatsView({ matches, hideScores }) {
  const [reveal, setReveal] = useState(false)
  const [extras, setExtras] = useState(null)
  // Authoritative real-time assists + minutes for scorers in live/recent
  // matches, overriding the lagging (or absent) aggregate figure in `extras`.
  const [statOverrides, setStatOverrides] = useState(null)
  // Which tile's match list is open below the strip: null | 'et' | 'pens'.
  const [expanded, setExpanded] = useState(null)
  // Scorer whose match-by-match popup is open.
  const [player, setPlayer] = useState(null)
  const openDetail = useDetail()
  const totals = useMemo(() => tournamentTotals(matches), [matches])
  const et = useMemo(() => extraTimeMatches(matches), [matches])
  const pens = useMemo(() => shootoutMatches(matches), [matches])
  const toggle = (key) => setExpanded((cur) => (cur === key ? null : key))

  // Official tie-breaker data. Assists + minutes come from ESPN's SEASON
  // aggregate (`extras`), which serves first load from the localStorage cache
  // within its TTL, then tracks the match feed in near-real time: assists can
  // only change when a goal is scored, so any change in the total goal tally
  // forces a fresh fetch, and a slower interval keeps minutes current while a
  // match is in play. The aggregate lags a match by minutes even past the final
  // whistle, though, so `assistOverrides` recomputes the true totals from box
  // scores for players in live/recent matches (below). Both are best-effort: a
  // failure just leaves the un-enriched (or un-overridden) ordering in place.
  const liveNow = matches.some((m) => m.live)
  const goalCount = useMemo(
    () => matches.reduce((n, m) => n + (m.goals?.t1?.length || 0) + (m.goals?.t2?.length || 0), 0),
    [matches],
  )
  // Matches whose assists might still be lagging the aggregate: in play, or
  // finished within RECENT_MS. A stable signature (id + live flag) so the
  // override effect re-fires on real changes, not every poll.
  const recentMatches = useMemo(() => {
    const now = Date.now()
    return matches.filter(
      (m) =>
        m.espnId &&
        (m.live || (m.score && !m.voided && now - new Date(m.ko).getTime() < RECENT_MS)),
    )
  }, [matches])
  const recentKey = useMemo(
    () =>
      recentMatches
        .map((m) => `${m.espnId}${m.live ? '*' : ''}`)
        .sort()
        .join(','),
    [recentMatches],
  )
  const firstLoad = useRef(true)
  useEffect(() => {
    // No goals yet = the feeds haven't loaded (or nobody has scored) — nothing
    // to rank, and skipping avoids a wasted fetch before the first tally lands.
    if (goalCount === 0) return
    const ctrl = new AbortController()
    const force = !firstLoad.current // a goal just landed → skip the cache
    firstLoad.current = false
    fetchBootExtras(ctrl.signal, { force })
      .then((e) => e.length && setExtras(e))
      .catch(() => {})
    return () => ctrl.abort()
  }, [goalCount])
  useEffect(() => {
    if (!liveNow) return
    const id = setInterval(() => {
      fetchBootExtras(undefined, { force: true })
        .then((e) => e.length && setExtras(e))
        .catch(() => {})
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [liveNow])
  const rawScorers = useMemo(() => topScorers(matches, { limit: 10 }), [matches])
  // Real-time tie-breaker overrides: recompute assists + minutes for the shown
  // scorers who played a live/recent match whenever a goal lands or the recent
  // set changes, plus a 60s interval while anything is live. Clear once nothing
  // is recent so the (now caught-up) aggregate stands on its own.
  useEffect(() => {
    if (!recentKey) {
      setStatOverrides(null)
      return
    }
    const ctrl = new AbortController()
    const wantKeys = new Set(rawScorers.map((s) => nameKey(s.name)))
    const run = () =>
      fetchRecentPlayerStats(recentMatches, wantKeys, ctrl.signal)
        .then((a) => setStatOverrides(a.length ? a : null))
        .catch(() => {})
    run()
    const id = recentMatches.some((m) => m.live) ? setInterval(run, 60 * 1000) : null
    return () => {
      ctrl.abort()
      if (id) clearInterval(id)
    }
    // `recentMatches`/`rawScorers` are read fresh inside; recentKey + goalCount
    // capture every change that can move a scorer's tally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentKey, goalCount])

  const bootExtras = useMemo(
    () => applyPlayerStatOverrides(extras, statOverrides),
    [extras, statOverrides],
  )
  const { scorers, enriched } = useMemo(
    () => applyBootExtras(rawScorers, bootExtras),
    [rawScorers, bootExtras],
  )
  const ranks = useMemo(
    () =>
      scorerRanks(
        scorers,
        enriched ? (s) => `${s.goals}|${s.assists ?? ''}|${s.minutes ?? ''}` : (s) => s.goals,
      ),
    [scorers, enriched],
  )
  // Teams with football still to play — their scorers can still add to the
  // tally, so their rows read bold; eliminated players' entries are frozen.
  const active = useMemo(() => activeTeams(matches), [matches])
  const anyActive = scorers.some((s) => active.has(s.team))
  const anyFrozen = scorers.some((s) => !active.has(s.team))
  // Players IN ACTION right now (their team's match is live) get a pulsing dot.
  const liveTeams = useMemo(() => {
    const t = new Set()
    for (const m of matches) {
      if (m.live) {
        t.add(m.t1)
        t.add(m.t2)
      }
    }
    return t
  }, [matches])
  const anyInAction = scorers.some((s) => liveTeams.has(s.team))

  if (hideScores && !reveal) {
    return (
      <div className="stats-hidden">
        <p>Tournament stats are hidden in spoiler-free mode — they give away results.</p>
        <button className="md-reveal" onClick={() => setReveal(true)}>🙈 reveal stats</button>
      </div>
    )
  }

  return (
    <div className="stats-wrap">
      <div className="stats-strip">
        <div className="stat-tile">
          <span className="stat-num">{totals.played}</span>
          <span className="stat-label">matches played</span>
        </div>
        <div className="stat-tile">
          <span className="stat-num">{totals.goals}</span>
          <span className="stat-label">goals</span>
        </div>
        <div className="stat-tile">
          <span className="stat-num">{totals.perMatch.toFixed(2)}</span>
          <span className="stat-label">goals / match</span>
        </div>
        {/* These two drill down: clicking lists the matches behind the number. */}
        <button
          className={`stat-tile stat-tile-btn${expanded === 'et' ? ' open' : ''}`}
          onClick={() => toggle('et')}
          disabled={et.length === 0}
          aria-expanded={expanded === 'et'}
          title={et.length ? 'Show the matches that went to extra time' : undefined}
        >
          <span className="stat-num">{totals.et}</span>
          <span className="stat-label">extra-time games{et.length > 0 && <span className="stat-chev">{expanded === 'et' ? ' ▴' : ' ▾'}</span>}</span>
        </button>
        <button
          className={`stat-tile stat-tile-btn${expanded === 'pens' ? ' open' : ''}`}
          onClick={() => toggle('pens')}
          disabled={pens.length === 0}
          aria-expanded={expanded === 'pens'}
          title={pens.length ? 'Show the matches decided by a shootout' : undefined}
        >
          <span className="stat-num">{totals.shootouts}</span>
          <span className="stat-label">shootouts{pens.length > 0 && <span className="stat-chev">{expanded === 'pens' ? ' ▴' : ' ▾'}</span>}</span>
        </button>
      </div>

      {expanded && (
        <section className="stat-detail">
          <h4>
            {expanded === 'et'
              ? `Went to extra time (${et.length})`
              : `Decided from the spot (${pens.length})`}
          </h4>
          <ul className="stat-match-list">
            {(expanded === 'et' ? et : pens).map((m) => (
              <StatMatchRow key={m.num} match={m} onOpen={openDetail} />
            ))}
          </ul>
          {expanded === 'et' && pens.length > 0 && (
            <p className="stat-detail-note">
              {pens.length} of these went all the way to penalties.
            </p>
          )}
        </section>
      )}

      <section className="boot-section">
        <h3>👟 Golden Boot race</h3>
        {scorers.length === 0 ? (
          <p className="boot-empty">No goals recorded yet.</p>
        ) : (
          <table className="boot-table">
            <thead>
              <tr>
                <th className="boot-rank" aria-label="Rank">#</th>
                <th>Player</th>
                <th>Team</th>
                <th className="boot-goals">Goals</th>
                {enriched && <th className="boot-num" title="Assists">A</th>}
                {enriched && <th className="boot-num" title="Minutes played">Min</th>}
              </tr>
            </thead>
            <tbody>
              {scorers.map((s, i) => (
                <tr
                  key={`${s.team}|${s.name}`}
                  className={
                    [ranks[i] === 1 && 'boot-leader', active.has(s.team) && 'boot-active']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                >
                  <td className="boot-rank">{ranks[i] ?? ''}</td>
                  <td className="boot-player">
                    <button
                      className="boot-player-btn"
                      onClick={() => setPlayer(s)}
                      title={`${s.name} — match by match`}
                    >
                      {s.name}
                    </button>
                    {liveTeams.has(s.team) && (
                      <span className="boot-live" title="In action — playing right now, so this tally can change">●</span>
                    )}
                  </td>
                  <td className="boot-team">
                    <span className="boot-flag">{FLAG_BY_TEAM[s.team] || '•'}</span> {s.team}
                  </td>
                  <td className="boot-goals">
                    {s.goals}
                    {s.pens > 0 && <span className="boot-pens">{s.pens} pen{s.pens === 1 ? '' : 's'}</span>}
                  </td>
                  {enriched && <td className="boot-num">{s.assists ?? '—'}</td>}
                  {enriched && <td className="boot-num">{s.minutes ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="boot-note">
          Top 10 (ties included). Own goals don’t count.{' '}
          {enriched
            ? 'Ranked by the official award criteria: goals, then assists, then fewest minutes played (assists & minutes via ESPN).'
            : 'Level scorers share a rank — the official award would split them on assists and minutes played.'}
          {enriched && liveNow && ' Refreshes with every goal while a match is in play.'}
          {anyActive && anyFrozen && (
            <>
              {' '}
              <strong>Bold</strong> players are still in the tournament and can add to their tally;
              the rest are final.
            </>
          )}
          {anyInAction && ' ● marks a player in action right now — their tally can still change.'}
          {' Click a player for their match-by-match breakdown.'}
        </p>
      </section>

      {player && <PlayerDetail scorer={player} matches={matches} onClose={() => setPlayer(null)} />}
    </div>
  )
}
