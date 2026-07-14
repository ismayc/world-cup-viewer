import { useMemo, useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { topScorers, scorerRanks, tournamentTotals } from '../utils/tournamentStats.js'

// Tournament stats: headline totals plus the Golden Boot race. Everything is
// derived from the merged match list — goal scorers come from OpenFootball
// (finished matches) and ESPN (live overlay), so a goal shows here moments
// after it lands on the scoreboard.

export default function StatsView({ matches, hideScores }) {
  const [reveal, setReveal] = useState(false)
  const scorers = useMemo(() => topScorers(matches, { limit: 15 }), [matches])
  const ranks = useMemo(() => scorerRanks(scorers), [scorers])
  const totals = useMemo(() => tournamentTotals(matches), [matches])
  const anyLive = scorers.some((s) => s.live)

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
              </tr>
            </thead>
            <tbody>
              {scorers.map((s, i) => (
                <tr key={`${s.team}|${s.name}`} className={ranks[i] === 1 ? 'boot-leader' : undefined}>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="boot-note">
          Top 15 (ties included). Own goals don’t count. Level scorers share a rank — the official
          award would split them on assists and minutes played, which the feeds don’t carry.
          {anyLive && ' ● marks a tally that includes a goal from a match still in play.'}
        </p>
      </section>
    </div>
  )
}
