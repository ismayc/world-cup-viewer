import { useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { VENUES } from '../data/venues.js'
import { STAGE_LABELS } from '../data/matches.js'
import { colorForMatch } from '../data/groupColors.js'
import { formatTime, tzAbbrev, liveState, statusFlag } from '../utils/time.js'
import { feederTeams } from '../utils/bracket.js'
import { useModalA11y } from '../hooks/useModalA11y.js'
import { useDetail } from '../context/detail.js'
import LiveBadge from './LiveBadge.jsx'
import FeederPair from './FeederPair.jsx'

// Full weekday + date for the popup title, e.g. "Saturday, June 27".
function longDate(iso, tz) {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// One compact row per match — kickoff, teams, score/status, stage, venue. Clicking
// opens the existing full match-detail modal.
function DayRow({ match, tz, scoreHidden, onOpen, byNum }) {
  const venue = VENUES[match.venue]
  const f1 = feederTeams(match.t1, byNum)
  const f2 = feederTeams(match.t2, byNum)
  const stage = match.stage === 'Group' ? `Group ${match.group}` : STAGE_LABELS[match.stage]
  const color = colorForMatch(match)
  const state = liveState(match)
  const flag = statusFlag(match)
  const voided = flag?.kind === 'voided'
  const hasScore = Array.isArray(match.score)
  const showScore = hasScore && !scoreHidden
  return (
    <li>
      <button type="button" className="dm-row" onClick={() => onOpen(match)} title="Open match details">
        <span className="dm-time">
          {formatTime(match.ko, tz)} <span className="dm-tz">{tzAbbrev(match.ko, tz)}</span>
        </span>
        <span className="dm-matchup">
          <span className="dm-team">
            {f1 ? (
              <FeederPair feeder={f1} />
            ) : (
              <>
                <span className="gg-flag">{FLAG_BY_TEAM[match.t1] || '•'}</span>
                <span className="gg-name">{match.t1}</span>
              </>
            )}
          </span>
          <span className="dm-result">
            {showScore ? (
              <span className="gg-score">
                {match.score[0]}–{match.score[1]}
                {match.pens && <span className="gg-pens"> (p {match.pens[0]}–{match.pens[1]})</span>}
              </span>
            ) : hasScore ? (
              <span className="gg-score gg-score-hidden">•–•</span>
            ) : (
              <span className="gg-vs">vs</span>
            )}
          </span>
          <span className="dm-team">
            {f2 ? (
              <FeederPair feeder={f2} />
            ) : (
              <>
                <span className="gg-flag">{FLAG_BY_TEAM[match.t2] || '•'}</span>
                <span className="gg-name">{match.t2}</span>
              </>
            )}
          </span>
        </span>
        <span className="dm-meta">
          <span className="dm-stage" style={{ color }}>{stage}</span>
          <span className="dm-venue">{venue.countryFlag} {venue.city}</span>
        </span>
        <span className="dm-status">
          {match.live ? (
            <LiveBadge match={match} />
          ) : voided ? (
            <span className="gg-badge gg-voided">{flag.label}</span>
          ) : state === 'finished' ? (
            <span className="gg-badge gg-final">FT</span>
          ) : state === 'live' ? (
            <span className="gg-badge gg-delayed">Delayed</span>
          ) : (
            <span className="gg-badge gg-upcoming">Upcoming</span>
          )}
        </span>
      </button>
    </li>
  )
}

// Pop-up listing every match scheduled on one day, opened from the Week-view date
// header. Each row drills into the full match-detail modal.
export default function DayMatchesModal({ matches, tz, hideScores, byNum, onClose }) {
  const cardRef = useModalA11y(onClose)
  const openDetail = useDetail()
  const [revealed, setRevealed] = useState(false)
  const scoreHidden = hideScores && !revealed

  const fixtures = [...matches].sort((a, b) => new Date(a.ko) - new Date(b.ko))
  const openMatch = (m) => {
    onClose()
    openDetail(m)
  }

  return (
    <div className="md-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="md-card gg-modal" ref={cardRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="md-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="md-head">
          <span className="md-stage">{fixtures.length ? longDate(fixtures[0].ko, tz) : 'Schedule'}</span>
          <span className="gg-head-team">
            {fixtures.length} match{fixtures.length === 1 ? '' : 'es'}
          </span>
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
          <ul className="gg-list dm-list">
            {fixtures.map((m) => (
              <DayRow key={m.num} match={m} tz={tz} scoreHidden={scoreHidden} onOpen={openMatch} byNum={byNum} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
