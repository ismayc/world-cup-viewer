import { useState } from 'react'
import { TEAMS } from '../data/teams.js'
import { computeQualification, rowStatus } from '../utils/qualification.js'
import { clinchBadge } from '../utils/clinch.js'
import { projectKnockout } from '../utils/asItStands.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { useFollow } from '../context/follow.jsx'

const GROUPS = Object.keys(TEAMS)

const STATUS_BADGE = {
  in: { cls: 'q-in', label: '✓', title: 'Advances to the Round of 32' },
  best3: { cls: 'q-best3', label: '3⃣', title: 'Provisionally among the 8 best third-placed teams' },
  out3: { cls: 'q-out', label: '·', title: 'Third place, outside the best 8 so far' },
  out: { cls: 'q-out', label: '✕', title: 'Eliminated' },
}

function Star({ name }) {
  const { isFollowed, toggle } = useFollow()
  const on = isFollowed(name)
  return (
    <button className={`star${on ? ' on' : ''}`} onClick={() => toggle(name)} aria-pressed={on}
      aria-label={on ? `Unfollow ${name}` : `Follow ${name}`}
      title={on ? `Unfollow ${name}` : `Follow ${name}`}>
      {on ? '★' : '☆'}
    </button>
  )
}

// "As it stands" projection of where this group's current placings would land in
// the Round of 32. A provisional snapshot — opponents shift as other groups play.
function AsItStands({ proj, onGoToMatch }) {
  if (!proj) return null
  const dest = (label, d, qualifies = true) => {
    if (!qualifies) return null
    const team = d?.team
    const opp = d?.opponent
    if (!team) return null
    return (
      <li className="ais-row" key={label}>
        <span className="ais-pos">{label}</span>
        <span className="ais-team">{FLAG_BY_TEAM[team] || ''} {team}</span>
        <span className="ais-vs">vs</span>
        <span className="ais-opp">
          {opp ? `${FLAG_BY_TEAM[opp] || ''} ${opp}` : 'TBD'}
        </span>
        {d?.matchNum &&
          (onGoToMatch ? (
            <button
              type="button"
              className="ais-match ais-match-link"
              onClick={() => onGoToMatch(d.matchNum)}
              title={`Show Match ${d.matchNum} on the Bracket`}
            >
              M{d.matchNum}
            </button>
          ) : (
            <span className="ais-match">M{d.matchNum}</span>
          ))}
      </li>
    )
  }
  return (
    <div className="as-it-stands">
      <div className="ais-title">As it stands → Round of 32</div>
      <ul className="ais-list">
        {dest('1st', proj.first)}
        {dest('2nd', proj.second)}
        {proj.thirdQualifies
          ? dest('3rd', proj.third)
          : proj.thirdTeam && (
              <li className="ais-row ais-out" key="3rd-out">
                <span className="ais-pos">3rd</span>
                <span className="ais-team">{FLAG_BY_TEAM[proj.thirdTeam] || ''} {proj.thirdTeam}</span>
                <span className="ais-note">outside the best 8</span>
              </li>
            )}
      </ul>
    </div>
  )
}

function GroupTable({ group, rows, qual, clinch, asItStands, onGoToMatch, liveTeams, pausedTeams }) {
  const { isFollowed } = useFollow()
  const played = qual.completion[group] || rows.some((r) => r.P > 0)
  const groupLive = rows.some((r) => liveTeams.has(r.name))
  const pauseRow = rows.find((r) => pausedTeams.has(r.name))
  const pauseLabel = pauseRow ? pausedTeams.get(pauseRow.name) : null
  return (
    <div className="group-card">
      <h3 className="group-title">
        Group {group}
        {groupLive &&
          (pauseLabel ? (
            <span className="group-delayed" title={`A match in this group is ${pauseLabel.toLowerCase()} — standings are provisional`}>
              ⏸ {pauseLabel.toUpperCase()}
            </span>
          ) : (
            <span className="group-live" title="A match in this group is in progress — standings are provisional">
              ● LIVE
            </span>
          ))}
      </h3>
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-team">Team</th>
            <th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th className="col-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // A guaranteed clinch/elimination verdict (if any) is more informative
            // than the post-completion qualification badge, so it wins when present.
            const clinched = clinchBadge(clinch?.[r.name])
            const status = rowStatus(r, group, qual)
            const badge = status && STATUS_BADGE[status]
            return (
              <tr key={r.name} className={r.rank <= 2 ? 'qualifies' : ''}>
                <td className="col-team">
                  <span className="rank">{r.rank}</span>
                  <Star name={r.name} />
                  <span className="team-flag">{r.flag}</span>
                  <span className={`row-team${isFollowed(r.name) ? ' followed' : ''}`}>{r.name}</span>
                  {liveTeams.has(r.name) && (
                    <span
                      className={`row-live-dot${pausedTeams.has(r.name) ? ' delayed' : ''}`}
                      title={pausedTeams.has(r.name) ? `${pausedTeams.get(r.name)} — score is provisional` : 'Playing now — score is provisional'}
                    >
                      ●
                    </span>
                  )}
                  {clinched ? (
                    <span className={`q-badge ${clinched.cls}`} title={clinched.title}>
                      {clinched.label} {clinched.text}
                    </span>
                  ) : (
                    badge && <span className={`q-badge ${badge.cls}`} title={badge.title}>{badge.label}</span>
                  )}
                </td>
                <td>{r.P}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td>
                <td>{r.GF}</td><td>{r.GA}</td>
                <td>{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                <td className="col-pts">{r.Pts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!played && <p className="group-note">No matches played yet</p>}
      {played && <AsItStands proj={asItStands} onGoToMatch={onGoToMatch} />}
    </div>
  )
}

function BestThirds({ qual }) {
  const anyPlayed = qual.thirds.some((t) => t.P > 0)
  if (!anyPlayed) return null
  return (
    <div className="thirds-card">
      <h3 className="group-title">Best third-placed teams</h3>
      <p className="thirds-note">
        The 8 best of the 12 third-placed teams advance (ranked by points, then goal difference,
        then goals scored, then fair play, then FIFA ranking).{' '}
        {qual.allComplete ? '' : 'Provisional — group stage still in progress.'}
      </p>
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-team">Team</th><th>Grp</th>
            <th>P</th><th>GD</th><th>GF</th><th className="col-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {qual.thirds.map((r, i) => (
            <tr key={r.name} className={i < 8 ? 'qualifies' : 'eliminated'}>
              <td className="col-team">
                <span className="rank">{i + 1}</span>
                <span className="team-flag">{r.flag}</span>
                <span className="row-team">{r.name}</span>
              </td>
              <td>{r.group}</td>
              <td>{r.P}</td>
              <td>{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
              <td>{r.GF}</td>
              <td className="col-pts">{r.Pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Standings({ matches, hideScores, clinch, onGoToMatch }) {
  const [revealed, setRevealed] = useState(false)
  // "As it stands" R32 projection is shown by default; this toggle (persisted)
  // hides it for those who just want the tables.
  const [showProjection, setShowProjection] = useState(() => {
    try {
      return localStorage.getItem('wc2026:asItStands') !== '0'
    } catch {
      return true
    }
  })
  const toggleProjection = () =>
    setShowProjection((v) => {
      const next = !v
      try {
        localStorage.setItem('wc2026:asItStands', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })

  if (hideScores && !revealed) {
    return (
      <div className="standings-hidden">
        <p>🙈 Standings are hidden in spoiler-free mode.</p>
        <button className="reveal-btn" onClick={() => setRevealed(true)}>Reveal standings</button>
      </div>
    )
  }

  const qual = computeQualification(matches)
  const { perGroup } = projectKnockout(matches)
  // Teams currently playing a group match — the standings + "As it stands" below
  // reflect their in-progress score, so we blink them to show it's provisional.
  const liveTeams = new Set()
  const pausedTeams = new Map() // team -> 'Delayed' | 'Suspended'
  for (const m of matches) {
    if (m.stage === 'Group' && m.live) {
      liveTeams.add(m.t1)
      liveTeams.add(m.t2)
      if (m.live.delayed) {
        const lbl = m.live.label || 'Delayed'
        pausedTeams.set(m.t1, lbl)
        pausedTeams.set(m.t2, lbl)
      }
    }
  }

  return (
    <>
      <p className="standings-legend">
        <span className="legend-swatch" /> Top two advance · <span className="q-badge q-best3">3⃣</span>{' '}
        best-third spot ·{' '}
        <span
          className="legend-tb"
          tabIndex={0}
          role="note"
          aria-label="Tie-breakers: points, then head-to-head, then goal difference, then goals, then fair play (cards), then FIFA ranking"
          data-tip="Tie-breakers: points → head-to-head → goal difference → goals → fair play (cards) → FIFA ranking"
        >
          tie-breakers
        </span>{' '}
        · <span className="q-badge c-won">🥇 Won group</span> /{' '}
        <span className="q-badge c-in">✅ Through</span> /{' '}
        <span className="q-badge c-out">❌ Out</span> mark mathematically clinched outcomes.
      </p>
      <div className="standings-toolbar">
        <button
          className="ais-toggle"
          onClick={toggleProjection}
          aria-pressed={showProjection}
          title="Show or hide the projected Round-of-32 matchups under each group"
        >
          {showProjection ? '▾ Hide “As it stands”' : '▸ Show “As it stands”'}
        </button>
      </div>
      <div className="standings-grid">
        {GROUPS.map((g) => (
          <GroupTable
            key={g}
            group={g}
            rows={qual.groups[g]}
            qual={qual}
            clinch={clinch}
            asItStands={showProjection ? perGroup[g] : null}
            onGoToMatch={onGoToMatch}
            liveTeams={liveTeams}
            pausedTeams={pausedTeams}
          />
        ))}
      </div>
      <BestThirds qual={qual} />
    </>
  )
}
