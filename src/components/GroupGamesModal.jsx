import { useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { VENUES } from '../data/venues.js'
import { formatTime, tzAbbrev, liveState, statusFlag } from '../utils/time.js'
import { useModalA11y } from '../hooks/useModalA11y.js'
import { useDetail } from '../context/detail.js'
import LiveBadge from './LiveBadge.jsx'

// Compact date for the fixture list, e.g. "Thu, Jun 11".
function shortDate(iso, tz) {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function TeamSide({ name, highlight }) {
  return (
    <span className={`gg-team${highlight ? ' gg-team-sel' : ''}`}>
      <span className="gg-flag">{FLAG_BY_TEAM[name] || '•'}</span>
      <span className="gg-name">{name}</span>
    </span>
  )
}

function FixtureRow({ match, tz, team, scoreHidden, onOpen }) {
  const state = liveState(match)
  const flag = statusFlag(match)
  const voided = flag?.kind === 'voided'
  const hasScore = Array.isArray(match.score)
  const showScore = hasScore && !scoreHidden
  return (
    <li>
      <button type="button" className="gg-fixture" onClick={() => onOpen(match)} title="Open match details">
        <span className="gg-when">
          {shortDate(match.ko, tz)} · {formatTime(match.ko, tz)} {tzAbbrev(match.ko, tz)}
        </span>
        <span className="gg-matchup">
          <TeamSide name={match.t1} highlight={match.t1 === team} />
          <span className="gg-result">
            {showScore ? (
              <span className="gg-score">
                {match.score[0]}–{match.score[1]}
                {match.pens && <span className="gg-pens"> (pens {match.pens[0]}–{match.pens[1]})</span>}
              </span>
            ) : hasScore ? (
              <span className="gg-score gg-score-hidden">•–•</span>
            ) : (
              <span className="gg-vs">vs</span>
            )}
          </span>
          <TeamSide name={match.t2} highlight={match.t2 === team} />
        </span>
        <span className="gg-status">
          {match.live ? (
            <LiveBadge match={match} />
          ) : voided ? (
            <span className="gg-badge gg-voided">{flag.label}</span>
          ) : state === 'finished' ? (
            <span className="gg-badge gg-final">FT</span>
          ) : (
            <span className="gg-badge gg-upcoming">Upcoming</span>
          )}
        </span>
      </button>
    </li>
  )
}

// Pop-up for a single group: every fixture, split into games already played
// (results) and games still to come. Opened by clicking a team in the standings.
export default function GroupGamesModal({ group, team, matches, tz, hideScores, onClose }) {
  const cardRef = useModalA11y(onClose)
  const openDetail = useDetail()
  const [revealed, setRevealed] = useState(false)
  const scoreHidden = hideScores && !revealed

  const fixtures = matches
    .filter((m) => m.stage === 'Group' && m.group === group)
    .sort((a, b) => a.num - b.num)

  // A game counts as "played" once it has a result or is in progress; everything
  // else is still to come.
  const played = fixtures.filter((m) => m.live || liveState(m) !== 'upcoming')
  const upcoming = fixtures.filter((m) => !m.live && liveState(m) === 'upcoming')

  const openMatch = (m) => {
    onClose()
    openDetail(m)
  }

  return (
    <div className="md-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="md-card gg-modal" ref={cardRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="md-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="md-head">
          <span className="md-stage">Group {group}</span>
          {team && (
            <span className="gg-head-team">
              {FLAG_BY_TEAM[team] || ''} {team}
            </span>
          )}
        </div>

        {hideScores && (
          <div className="gg-spoiler-bar">
            <span>🙈 Scores hidden in spoiler-free mode.</span>
            {!revealed && (
              <button className="gg-reveal" onClick={() => setRevealed(true)}>Reveal scores</button>
            )}
          </div>
        )}

        <div className="md-section">
          <h4>Results <span className="gg-count">{played.length}</span></h4>
          {played.length ? (
            <ul className="gg-list">
              {played.map((m) => (
                <FixtureRow key={m.num} match={m} tz={tz} team={team} scoreHidden={scoreHidden} onOpen={openMatch} />
              ))}
            </ul>
          ) : (
            <p className="gg-empty">No games played yet.</p>
          )}
        </div>

        <div className="md-section">
          <h4>Still to play <span className="gg-count">{upcoming.length}</span></h4>
          {upcoming.length ? (
            <ul className="gg-list">
              {upcoming.map((m) => (
                <FixtureRow key={m.num} match={m} tz={tz} team={team} scoreHidden={scoreHidden} onOpen={openMatch} />
              ))}
            </ul>
          ) : (
            <p className="gg-empty">All group games have been played.</p>
          )}
        </div>
      </div>
    </div>
  )
}
