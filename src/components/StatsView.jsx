import { useEffect, useMemo, useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { STAGE_LABELS } from '../data/matches.js'
import {
  topScorers,
  scorerRanks,
  tournamentTotals,
  applyBootExtras,
  activeTeams,
  extraTimeMatches,
  shootoutMatches,
} from '../utils/tournamentStats.js'
import { fetchBootExtras } from '../services/espnStats.js'
import { useDetail } from '../context/detail.js'

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
  // Which tile's match list is open below the strip: null | 'et' | 'pens'.
  const [expanded, setExpanded] = useState(null)
  const openDetail = useDetail()
  const totals = useMemo(() => tournamentTotals(matches), [matches])
  const et = useMemo(() => extraTimeMatches(matches), [matches])
  const pens = useMemo(() => shootoutMatches(matches), [matches])
  const toggle = (key) => setExpanded((cur) => (cur === key ? null : key))

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
