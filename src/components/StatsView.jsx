import { useEffect, useMemo, useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { topScorers, scorerRanks, tournamentTotals, applyBootExtras, activeTeams } from '../utils/tournamentStats.js'
import { fetchBootExtras } from '../services/espnStats.js'

// Tournament stats: headline totals plus the Golden Boot race. Goals are
// derived from the merged match list (OpenFootball for finished matches, ESPN
// for live ones), so a goal shows here moments after it lands on the
// scoreboard. Assists and minutes played — the official award tie-breakers —
// come from ESPN's leaders data (best-effort): when they load, the table is
// ordered exactly as the award would be; until then it falls back to goals,
// fewest penalties, name.

export default function StatsView({ matches, hideScores }) {
  const [reveal, setReveal] = useState(false)
  const [extras, setExtras] = useState(null)
  const totals = useMemo(() => tournamentTotals(matches), [matches])

  // Official tie-breaker data, fetched once per view (served from a
  // localStorage cache within its TTL). Best-effort — a failure just leaves
  // the un-enriched ordering in place.
  useEffect(() => {
    const ctrl = new AbortController()
    fetchBootExtras(ctrl.signal)
      .then((e) => e.length && setExtras(e))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  const { scorers, enriched } = useMemo(
    () => applyBootExtras(topScorers(matches, { limit: 15 }), extras),
    [matches, extras],
  )
  const ranks = useMemo(
    () =>
      scorerRanks(
        scorers,
        enriched ? (s) => `${s.goals}|${s.assists ?? ''}|${s.minutes ?? ''}` : (s) => s.goals,
      ),
    [scorers, enriched],
  )
  const anyLive = scorers.some((s) => s.live)
  // Teams with football still to play — their scorers can still add to the
  // tally, so their rows read bold; eliminated players' entries are frozen.
  const active = useMemo(() => activeTeams(matches), [matches])
  const anyActive = scorers.some((s) => active.has(s.team))
  const anyFrozen = scorers.some((s) => !active.has(s.team))

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
      <div className="stats-strip" role="list">
        <div className="stat-tile" role="listitem">
          <span className="stat-num">{totals.played}</span>
          <span className="stat-label">matches played</span>
        </div>
        <div className="stat-tile" role="listitem">
          <span className="stat-num">{totals.goals}</span>
          <span className="stat-label">goals</span>
        </div>
        <div className="stat-tile" role="listitem">
          <span className="stat-num">{totals.perMatch.toFixed(2)}</span>
          <span className="stat-label">goals / match</span>
        </div>
        <div className="stat-tile" role="listitem">
          <span className="stat-num">{totals.et}</span>
          <span className="stat-label">extra-time games</span>
        </div>
        <div className="stat-tile" role="listitem">
          <span className="stat-num">{totals.shootouts}</span>
          <span className="stat-label">shootouts</span>
        </div>
      </div>

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
                    {s.name}
                    {s.live && <span className="boot-live" title="Includes a goal in a match still in play">●</span>}
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
          Top 15 (ties included). Own goals don’t count.{' '}
          {enriched
            ? 'Ranked by the official award criteria: goals, then assists, then fewest minutes played (assists & minutes via ESPN).'
            : 'Level scorers share a rank — the official award would split them on assists and minutes played.'}
          {anyActive && anyFrozen && (
            <>
              {' '}
              <strong>Bold</strong> players are still in the tournament and can add to their tally;
              the rest are final.
            </>
          )}
          {anyLive && ' ● marks a tally that includes a goal from a match still in play.'}
        </p>
      </section>
    </div>
  )
}
