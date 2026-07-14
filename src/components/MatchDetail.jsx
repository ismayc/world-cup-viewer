import { useState } from 'react'
import { VENUES } from '../data/venues.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { STAGE_LABELS } from '../data/matches.js'
import { US_BROADCAST } from '../data/broadcast.js'
import { FIFA_RANK } from '../data/fifaRanking.js'
import { teamRecord } from '../utils/tournamentStats.js'
import { formatTime, formatDateLong, tzAbbrev, liveState, statusFlag, teamKickoffTooltip } from '../utils/time.js'
import { downloadICS } from '../utils/ics.js'
import { useFollow } from '../context/follow.jsx'
import { useModalA11y } from '../hooks/useModalA11y.js'
import LiveBadge from './LiveBadge.jsx'
import ScoreCheck from './ScoreCheck.jsx'

// Minute label including stoppage time, e.g. "45+3'".
const minuteLabel = (e) => (e.minute != null ? `${e.minute}${e.extra ? `+${e.extra}` : ''}'` : '')

function FollowStar({ name }) {
  const { isFollowed, toggle } = useFollow()
  if (!FLAG_BY_TEAM[name]) return null
  const on = isFollowed(name)
  return (
    <button
      className={`star${on ? ' on' : ''}`}
      onClick={() => toggle(name)}
      aria-label={on ? `Unfollow ${name}` : `Follow ${name}`}
      title={on ? `Unfollow ${name}` : `Follow ${name}`}
      aria-pressed={on}
    >
      {on ? '★' : '☆'}
    </button>
  )
}

function Timeline({ match }) {
  const events = []
  const collect = (list, side, type) => (list || []).forEach((x) => events.push({ ...x, side, type }))
  collect(match.goals?.t1, 't1', 'goal')
  collect(match.goals?.t2, 't2', 'goal')
  collect(match.cards?.t1, 't1', 'card')
  collect(match.cards?.t2, 't2', 'card')
  collect(match.subs?.t1, 't1', 'sub')
  collect(match.subs?.t2, 't2', 'sub')
  if (!events.length) return <p className="md-nogoals">No events yet.</p>
  events.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || (a.extra ?? 0) - (b.extra ?? 0))
  const icon = (e) => (e.type === 'card' ? (e.color === 'red' ? '🟥' : '🟨') : e.type === 'sub' ? '🔁' : '⚽')
  return (
    <ul className="timeline">
      {events.map((e, i) => (
        <li key={i} className={`tl-${e.side}`}>
          <span className="tl-min">{minuteLabel(e)}</span>
          <span className="tl-ball">{icon(e)}</span>
          <span className="tl-name">
            {e.type === 'sub' ? (e.names || []).join(' / ') : e.name}
            {e.type === 'goal' && e.penalty && <em> (pen)</em>}
            {e.type === 'goal' && e.og && <em> (OG)</em>}
          </span>
        </li>
      ))}
    </ul>
  )
}

// "Tale of the tape" for a knockout tie: the two teams' tournament records side
// by side, computed from the merged match list. Only rendered once both slots
// hold real teams (a "Winner Match N" placeholder has no record to show).
// Records are AS OF this match's kickoff, so a past game shows what each team
// had done going into it — not their record today.
function TaleOfTheTape({ match, allMatches, label }) {
  const a = teamRecord(allMatches, match.t1, { before: match.ko })
  const b = teamRecord(allMatches, match.t2, { before: match.ko })
  if (!a.played || !b.played) return null
  const gd = (v) => (v > 0 ? `+${v}` : `${v}`)
  const record = (r) => `${r.w}–${r.d}–${r.l}${r.pensWon ? ` (${r.pensWon} on pens)` : ''}`
  const cards = (r) => `🟨 ${r.yellow} · 🟥 ${r.red}`
  const rank = (t) => (FIFA_RANK[t] ? `#${FIFA_RANK[t]}` : '—')
  const anyCards = a.hasCardData || b.hasCardData
  const rows = [
    ['W–D–L', record(a), record(b)],
    ['Goals scored', a.gf, b.gf],
    ['Goals conceded', a.ga, b.ga],
    ['Goal difference', gd(a.gd), gd(b.gd)],
    ['Clean sheets', a.cleanSheets, b.cleanSheets],
    ...(anyCards ? [['Cards', cards(a), cards(b)]] : []),
    ['FIFA ranking', rank(match.t1), rank(match.t2)],
  ]
  return (
    <div className="md-section">
      <h4>{label}</h4>
      <table className="md-tape">
        <tbody>
          {rows.map(([label, va, vb]) => (
            <tr key={label}>
              <td className="tape-a">{va}</td>
              <th className="tape-label">{label}</th>
              <td className="tape-b">{vb}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {anyCards && <p className="tape-note">Cards are best-effort (ESPN event feed).</p>}
    </div>
  )
}

export default function MatchDetail({ match, tz, hideScores, allMatches, onClose }) {
  const [reveal, setReveal] = useState(false)
  const [revealStats, setRevealStats] = useState(false)
  const cardRef = useModalA11y(onClose)

  if (!match) return null
  const venue = VENUES[match.venue]
  const stage = match.stage === 'Group' ? `Group ${match.group}` : STAGE_LABELS[match.stage]
  const status = liveState(match)
  const flag = statusFlag(match)
  const voided = flag?.kind === 'voided'
  const awarded = flag?.kind === 'awarded'
  const hasScore = Array.isArray(match.score)
  const scoreHidden = hasScore && hideScores && !reveal

  return (
    <div className="md-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="md-card" ref={cardRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="md-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="md-head">
          <span className="md-stage">{stage} · Match {match.num}</span>
          {voided ? (
            <span className="status-badge" role="status" aria-label={flag.label}>
              {flag.label === 'Abandoned' || flag.label === 'Canceled' ? '⚠' : '⏸'} {flag.label}
            </span>
          ) : match.live ? (
            <LiveBadge match={match} className="md-live" />
          ) : (
            // In-window but ESPN isn't ticking yet → delayed, not live.
            status === 'live' && <span className="badge-delayed" role="status">⏸ Delayed</span>
          )}
        </div>

        <div className="md-teams">
          <div className="md-team" title={teamKickoffTooltip(match.ko, match.t1) || undefined}>
            <span className="md-flag">{FLAG_BY_TEAM[match.t1] || '•'}</span>
            <span className="md-name">{match.t1}</span>
            <FollowStar name={match.t1} />
          </div>
          <div className="md-score">
            {hasScore ? (
              scoreHidden ? (
                <button className="md-reveal" onClick={() => setReveal(true)}>🙈 reveal</button>
              ) : (
                <>
                  {/* Abandoned keeps a partial score for display only — label it
                      and skip the source-confirmation badge; it's not a result. */}
                  {voided && <span className="status-badge">{flag.label}</span>}
                  {match.score[0]}–{match.score[1]}
                  {match.pens && <div className="md-extra">pens {match.pens[0]}–{match.pens[1]}</div>}
                  {match.aet && !match.pens && <div className="md-extra">after extra time</div>}
                  {awarded && <span className="awarded-note">awarded</span>}
                  {!voided && <ScoreCheck match={match} />}
                </>
              )
            ) : (
              <span className="md-vs">vs</span>
            )}
          </div>
          <div className="md-team" title={teamKickoffTooltip(match.ko, match.t2) || undefined}>
            <span className="md-flag">{FLAG_BY_TEAM[match.t2] || '•'}</span>
            <span className="md-name">{match.t2}</span>
            <FollowStar name={match.t2} />
          </div>
        </div>

        <div className="md-meta">
          <div><strong>When</strong> {formatDateLong(match.ko, tz)} · {formatTime(match.ko, tz)} {tzAbbrev(match.ko, tz)}</div>
          <div><strong>Stadium local</strong> {formatTime(match.ko, venue.tz)} {tzAbbrev(match.ko, venue.tz)}</div>
          <div><strong>Venue</strong> {venue.countryFlag} {venue.name}, {venue.city}, {venue.country}</div>
        </div>

        {hasScore && !scoreHidden && (
          <div className="md-section">
            <h4>Match events</h4>
            <Timeline match={match} />
          </div>
        )}

        {/* Knockout tale of the tape. A team's aggregate record reveals results,
            so spoiler-free mode keeps it behind its own reveal. A played match
            shows the records the teams took INTO it; an upcoming one, so far. */}
        {match.stage !== 'Group' &&
          allMatches &&
          FLAG_BY_TEAM[match.t1] &&
          FLAG_BY_TEAM[match.t2] &&
          (hideScores && !revealStats ? (
            <div className="md-section">
              <h4>{hasScore ? 'Going into this match' : 'Tournament so far'}</h4>
              <button className="md-reveal" onClick={() => setRevealStats(true)}>
                🙈 reveal team records
              </button>
            </div>
          ) : (
            <TaleOfTheTape
              match={match}
              allMatches={allMatches}
              label={hasScore ? 'Going into this match' : 'Tournament so far'}
            />
          ))}

        <div className="md-section">
          <h4>How to watch (US)</h4>
          <div className="md-watch">
            <div><span className="md-lang">English</span> {US_BROADCAST.english.tv.join(' / ')} · {US_BROADCAST.english.streaming.join(', ')}</div>
            <div><span className="md-lang">Spanish</span> {US_BROADCAST.spanish.tv.join(' / ')} · {US_BROADCAST.spanish.streaming.join(', ')}</div>
          </div>
        </div>

        <button className="md-cal" onClick={() => downloadICS(match)}>＋ Add to calendar</button>
      </div>
    </div>
  )
}
