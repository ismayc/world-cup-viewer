import { useState } from 'react'
import { VENUES } from '../data/venues.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { STAGE_LABELS } from '../data/matches.js'
import { US_BROADCAST } from '../data/broadcast.js'
import { formatTime, tzAbbrev, liveState, statusFlag, teamKickoffTooltip } from '../utils/time.js'
import { downloadICS } from '../utils/ics.js'
import { useFollow } from '../context/follow.jsx'
import { useDetail } from '../context/detail.js'
import LiveBadge from './LiveBadge.jsx'
import ScoreCheck from './ScoreCheck.jsx'
import { clinchBadge } from '../utils/clinch.js'

// Tooltip describing which Round-of-32 slot this team feeds into, given its
// group's slot map and any clinched status. Returns null when there's no slot
// context (e.g. knockout placeholders).
function slotTooltip(group, slot, clinch) {
  if (!group || !slot) return null
  const r32 = (num) => `Round of 32 · Match ${num}`
  if (clinch === 'won-group') return `Clinched Group ${group} winner → ${r32(slot.win)}`
  if (clinch === 'eliminated') return `Eliminated from Group ${group} — no knockout slot`
  const parts = []
  if (slot.win) parts.push(`1st → ${r32(slot.win)}`)
  if (slot.runnerUp) parts.push(`2nd → ${r32(slot.runnerUp)}`)
  parts.push('3rd → a best-third tie (if it qualifies)')
  return `Group ${group} knockout route:\n${parts.join('\n')}`
}

function Team({ name, ko, clinch, group, slot }) {
  const flag = FLAG_BY_TEAM[name]
  const { isFollowed, toggle } = useFollow()
  const on = Boolean(flag) && isFollowed(name)
  const localKickoff = teamKickoffTooltip(ko, name)
  const badge = clinchBadge(clinch)
  // Bracket slot on the name; kickoff stays on the row (outside the name).
  const nameTitle = slotTooltip(group, slot, clinch) || undefined
  return (
    <div className={`team${on ? ' followed' : ''}`} title={localKickoff || undefined}>
      {flag && (
        <button
          className={`star${on ? ' on' : ''}`}
          onClick={() => toggle(name)}
          aria-pressed={on}
          aria-label={on ? `Unfollow ${name}` : `Follow ${name}`}
          title={on ? `Unfollow ${name}` : `Follow ${name}`}
        >
          {on ? '★' : '☆'}
        </button>
      )}
      <span className="team-flag">{flag || '🏳️'}</span>
      <span className={`team-name${flag ? '' : ' team-tbd'}`} title={nameTitle}>{name}</span>
      {badge && (
        <span className={`clinch-tag ${badge.cls}`} title={badge.title}>
          {badge.label} {badge.text}
        </span>
      )}
    </div>
  )
}

function Channels({ feed }) {
  return (
    <div className="feed">
      <div className="feed-lang">{feed.language}</div>
      <div className="feed-detail">
        <span className="feed-label">TV</span>
        {feed.tv.map((c) => (
          <span key={c} className={`chip${c === feed.freeOverTheAir ? ' chip-free' : ''}`}>
            {c}
            {c === feed.freeOverTheAir && <span className="free-tag">free</span>}
          </span>
        ))}
      </div>
      <div className="feed-detail">
        <span className="feed-label">Stream</span>
        {feed.streaming.map((s) => (
          <span key={s} className="chip chip-stream">
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function MatchCard({ match, tz, feed = 'both', hidden = false, clinch, slotMap }) {
  const [showWatch, setShowWatch] = useState(false)
  const [revealScore, setRevealScore] = useState(false)
  const openDetail = useDetail()
  const venue = VENUES[match.venue]
  const status = liveState(match)
  const flag = statusFlag(match)
  const voided = flag?.kind === 'voided'
  const awarded = flag?.kind === 'awarded'
  const viewerTime = formatTime(match.ko, tz)
  const viewerAbbr = tzAbbrev(match.ko, tz)
  const localTime = formatTime(match.ko, venue.tz)
  const localAbbr = tzAbbrev(match.ko, venue.tz)
  const sameClock = viewerTime === localTime && viewerAbbr === localAbbr

  const stageLabel =
    match.stage === 'Group' ? `Group ${match.group}` : STAGE_LABELS[match.stage]

  // A score only exists once a match is recorded. In spoiler-free mode it stays
  // hidden behind a tap-to-reveal pill (per-card override of the day/global setting).
  const hasScore = Array.isArray(match.score)
  const scoreHidden = hasScore && hidden && !revealScore

  return (
    <article className={`card status-${status}`}>
      <div className="card-time">
        {/* Abandoned/postponed/canceled: a muted status pill instead of a
            kickoff time/countdown — it isn't a real result. */}
        {voided ? (
          <span className="status-badge" role="status" aria-label={flag.label}>
            {flag.label === 'Abandoned' || flag.label === 'Canceled' ? '⚠' : '⏸'} {flag.label}
          </span>
        ) : (
          <>
            <div className="kickoff">{viewerTime}</div>
            <div className="kickoff-tz">{viewerAbbr}</div>
            {/* Real in-match status from ESPN (clock/HT) beats the time-based guess;
                a match with a final score reads FT even if still inside the window.
                A paused (delayed/suspended) match shows the LiveBadge, not a countdown. */}
            {match.live ? (
              <LiveBadge match={match} />
            ) : status === 'live' ? (
              <div className="badge-live">● LIVE</div>
            ) : status === 'finished' ? (
              <div className="badge-done" aria-label="Full time">FT</div>
            ) : null}
          </>
        )}
      </div>

      <div className="card-body">
        <div className="card-head">
          <span className={`stage-badge stage-${match.stage}`}>{stageLabel}</span>
          <span className="match-num">Match {match.num}</span>
        </div>

        <div className="matchup">
          <Team name={match.t1} ko={match.ko} clinch={match.stage === 'Group' ? clinch?.[match.t1] : undefined} group={match.group} slot={slotMap?.[match.group]} />
          {hasScore ? (
            scoreHidden ? (
              <button
                className="score score-hidden"
                onClick={() => setRevealScore(true)}
                title="Reveal score"
              >
                🙈 <span className="score-hidden-label">tap to reveal</span>
              </button>
            ) : (
              <span className="score">
                {/* An abandoned match keeps a partial score for display only —
                    label it so it doesn't read as a normal final. */}
                {voided && <span className="status-badge">{flag.label}</span>}
                {match.score[0]}<span className="score-dash">–</span>{match.score[1]}
                {match.pens && (
                  <span className="score-extra">pens {match.pens[0]}–{match.pens[1]}</span>
                )}
                {match.aet && !match.pens && <span className="score-extra">AET</span>}
                {awarded && <span className="awarded-note">awarded</span>}
              </span>
            )
          ) : (
            <span className="vs">v</span>
          )}
          <Team name={match.t2} ko={match.ko} clinch={match.stage === 'Group' ? clinch?.[match.t2] : undefined} group={match.group} slot={slotMap?.[match.group]} />
        </div>

        {/* Cross-source confirmation of the final score (OpenFootball / ESPN /
            TheSportsDB). Hidden in spoiler mode along with the score itself, and
            never shown for a voided match (its score isn't a real result). */}
        {!scoreHidden && !voided && <ScoreCheck match={match} />}

        <div className="venue">
          <span className="venue-flag">{venue.countryFlag}</span>
          <span className="venue-stadium">{venue.name}</span>
          <span className="venue-city">
            {venue.city}, {venue.country}
          </span>
          {!sameClock && (
            <span className="venue-local">
              · {localTime} {localAbbr} local
            </span>
          )}
        </div>

        <div className="card-actions">
          <button
            className="watch-toggle"
            onClick={() => setShowWatch((s) => !s)}
            aria-expanded={showWatch}
          >
            📺 How to watch (US) {showWatch ? '▲' : '▼'}
          </button>
          <button
            className="cal-btn"
            onClick={() => downloadICS(match)}
            title="Download .ics calendar file"
          >
            ＋ Add to calendar
          </button>
          <button className="cal-btn" onClick={() => openDetail(match)}>
            ℹ Details
          </button>
        </div>
        {showWatch && (
          <div className="watch">
            {feed !== 'spanish' && <Channels feed={US_BROADCAST.english} />}
            {feed !== 'english' && <Channels feed={US_BROADCAST.spanish} />}
          </div>
        )}
      </div>
    </article>
  )
}
