import { useEffect, useMemo, useState } from 'react'
import { VENUES } from '../data/venues.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { STAGE_LABELS } from '../data/matches.js'
import { dayKey, formatTime, tzAbbrev, liveState, teamKickoffTooltip } from '../utils/time.js'
import { useFollow } from '../context/follow.jsx'

function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  }
}

export default function NextMatch({ matches, tz }) {
  const { isFollowed, count } = useFollow()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { match, live, followed } = useMemo(() => {
    const involvesFollowed = (m) => isFollowed(m.t1) || isFollowed(m.t2)
    // A live followed match wins; else any live match; else next upcoming
    // (preferring a followed team's next game).
    const liveMatches = matches.filter((m) => liveState(m, now) === 'live')
    const live = liveMatches.find(involvesFollowed) || liveMatches[0]
    if (live) return { match: live, live: true, followed: involvesFollowed(live) }

    const upcoming = matches
      .filter((m) => new Date(m.ko).getTime() > now)
      .sort((a, b) => new Date(a.ko) - new Date(b.ko))
    const next = (count > 0 && upcoming.find(involvesFollowed)) || upcoming[0]
    return { match: next, live: false, followed: next ? involvesFollowed(next) : false }
  }, [matches, now, isFollowed, count])

  if (!match) {
    return (
      <div className="nextmatch done">🏆 The tournament has concluded — champions crowned!</div>
    )
  }

  const venue = VENUES[match.venue]
  const stage = match.stage === 'Group' ? `Group ${match.group}` : STAGE_LABELS[match.stage]
  const t = parts(new Date(match.ko).getTime() - now)

  const jump = () => {
    const el = document.getElementById(`day-${dayKey(match.ko, tz)}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={`nextmatch${live ? ' is-live' : ''}`}>
      <div className="nm-label">
        {live ? (match.live?.delayed ? '⏸ Delayed' : '🔴 Live now') : followed ? '⭐ Your next match' : '⏱ Next match'}
        <span className="nm-stage">{stage}</span>
      </div>

      <div className="nm-teams">
        <span className="nm-flag">{FLAG_BY_TEAM[match.t1] || '•'}</span>
        <span className="nm-name" title={teamKickoffTooltip(match.ko, match.t1) || undefined}>{match.t1}</span>
        <span className="nm-v">vs</span>
        <span className="nm-name nm-name-right" title={teamKickoffTooltip(match.ko, match.t2) || undefined}>{match.t2}</span>
        <span className="nm-flag">{FLAG_BY_TEAM[match.t2] || '•'}</span>
      </div>

      <div className="nm-bottom">
        {live ? (
          match.live?.delayed ? (
            <span className="nm-countdown delayed">⏸ Delayed</span>
          ) : (
            <span className="nm-countdown live">● in progress</span>
          )
        ) : (
          <span className="nm-countdown" aria-label="time until kickoff">
            {t.d > 0 && <b>{t.d}<small>d</small></b>}
            <b>{t.h}<small>h</small></b>
            <b>{t.m}<small>m</small></b>
            <b>{t.s}<small>s</small></b>
          </span>
        )}
        <span className="nm-when">
          {formatTime(match.ko, tz)} {tzAbbrev(match.ko, tz)} · {venue.city}
        </span>
        <button className="nm-jump" onClick={jump}>
          Jump to it ↓
        </button>
      </div>
    </div>
  )
}
