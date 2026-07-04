import { useMemo, useState } from 'react'
import { VENUES } from '../data/venues.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { STAGE_LABELS } from '../data/matches.js'
import { GROUP_COLORS, KNOCKOUT_COLOR, colorForMatch } from '../data/groupColors.js'
import { dayKey, formatTime, statusFlag, teamKickoffTooltip } from '../utils/time.js'
import { weekStartOf, addDays, weekLabel, weekdayHeader } from '../utils/week.js'
import { matchesByNum, feederTeams } from '../utils/bracket.js'
import { useFollow } from '../context/follow.jsx'
import { useDetail } from '../context/detail.js'
import LiveBadge from './LiveBadge.jsx'
import ScoreCheck from './ScoreCheck.jsx'
import FeederPair from './FeederPair.jsx'
import DayMatchesModal from './DayMatchesModal.jsx'

function Legend() {
  return (
    <div className="week-legend">
      {Object.entries(GROUP_COLORS).map(([g, c]) => (
        <span key={g} className="lg-item">
          <span className="lg-sw" style={{ background: c }} /> {g}
        </span>
      ))}
      <span className="lg-item">
        <span className="lg-sw" style={{ background: KNOCKOUT_COLOR }} /> Knockout
      </span>
    </div>
  )
}

function WeekCell({ m, tz, hidden, byNum }) {
  const { isFollowed } = useFollow()
  const openDetail = useDetail()
  const f1 = feederTeams(m.t1, byNum)
  const f2 = feederTeams(m.t2, byNum)
  const venue = VENUES[m.venue]
  const color = colorForMatch(m)
  const label = m.stage === 'Group' ? `Group ${m.group}` : STAGE_LABELS[m.stage]
  const flag = statusFlag(m)
  const voided = flag?.kind === 'voided'
  const awarded = flag?.kind === 'awarded'
  const showScore = Array.isArray(m.score) && !hidden
  const scoreText = showScore
    ? `${m.score[0]}–${m.score[1]}${m.pens ? ` (p ${m.pens[0]}–${m.pens[1]})` : m.aet ? ' AET' : ''}`
    : 'v'
  const cls = (name) => `wc-name${isFollowed(name) ? ' followed' : ''}`
  return (
    <button
      type="button"
      className="week-cell"
      style={{ borderLeftColor: color, background: `${color}1f` }}
      onClick={() => openDetail(m)}
    >
      <div className="wc-time">
        {/* Voided shows a muted pill instead of the kickoff time/live clock. */}
        {voided ? (
          <span className="status-badge" role="status" aria-label={flag.label}>
            {flag.label === 'Abandoned' || flag.label === 'Canceled' ? '⚠' : '⏸'} {flag.label}
          </span>
        ) : (
          <>
            {formatTime(m.ko, tz)}
            {m.live && <LiveBadge match={m} className="wc-live" />}
          </>
        )}
      </div>
      <div className="wc-team" title={f1 ? undefined : teamKickoffTooltip(m.ko, m.t1) || undefined}>
        {f1 ? (
          <FeederPair feeder={f1} />
        ) : (
          <>
            <span className="wc-flag">{FLAG_BY_TEAM[m.t1] || '•'}</span>
            <span className={cls(m.t1)}>{m.t1}</span>
          </>
        )}
      </div>
      <div className="wc-mid">
        {voided && showScore && <span className="status-badge">{flag.label}</span>}
        {scoreText}
        {awarded && showScore && <span className="awarded-note">awarded</span>}
      </div>
      <div className="wc-team" title={f2 ? undefined : teamKickoffTooltip(m.ko, m.t2) || undefined}>
        {f2 ? (
          <FeederPair feeder={f2} />
        ) : (
          <>
            <span className="wc-flag">{FLAG_BY_TEAM[m.t2] || '•'}</span>
            <span className={cls(m.t2)}>{m.t2}</span>
          </>
        )}
      </div>
      <div className="wc-foot">
        <span className="wc-stage" style={{ color }}>{label}</span>
        {showScore && !voided && <ScoreCheck match={m} compact />}
        <span className="wc-venue">{venue.countryFlag} {venue.city}</span>
      </div>
    </button>
  )
}

export default function WeekView({ allMatches, shown, tz, dayHidden }) {
  // Lookup for expanding "Winner Match N" slots into their potential matchup.
  const byNum = useMemo(() => matchesByNum(allMatches), [allMatches])
  // Stable list of weeks (Sundays) that contain any match — drives navigation.
  const weeks = useMemo(() => {
    const set = new Set(allMatches.map((m) => weekStartOf(dayKey(m.ko, tz))))
    return [...set].sort()
  }, [allMatches, tz])

  // Start on the week containing "today" if it has matches, else the first week.
  const [idx, setIdx] = useState(() => {
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    const i = weeks.indexOf(weekStartOf(todayKey))
    return i >= 0 ? i : 0
  })

  const safeIdx = Math.max(0, Math.min(idx, weeks.length - 1))
  const weekStart = weeks[safeIdx]

  const byDay = useMemo(() => {
    const map = {}
    for (const m of shown) {
      const k = dayKey(m.ko, tz)
      ;(map[k] ||= []).push(m)
    }
    for (const k in map) map[k].sort((a, b) => new Date(a.ko) - new Date(b.ko))
    return map
  }, [shown, tz])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const total = days.reduce((n, d) => n + (byDay[d]?.length || 0), 0)

  // The day whose "all matches" pop-up is open: { matches, hidden } or null.
  const [dayModal, setDayModal] = useState(null)

  return (
    <div className="weekview">
      <div className="week-nav">
        <button className="week-arrow" disabled={safeIdx <= 0} onClick={() => setIdx(safeIdx - 1)}>
          ◀ Prev
        </button>
        <div className="week-title">
          {weekLabel(weekStart)}
          <span className="week-count">
            · {total} match{total === 1 ? '' : 'es'}
          </span>
        </div>
        <button
          className="week-arrow"
          disabled={safeIdx >= weeks.length - 1}
          onClick={() => setIdx(safeIdx + 1)}
        >
          Next ▶
        </button>
      </div>

      <Legend />

      <div className="week-grid">
        {days.map((d) => {
          const matches = byDay[d] || []
          const hdr = weekdayHeader(d)
          const hidden = dayHidden ? dayHidden(d) : false
          return (
            <div key={d} className={`week-col${matches.length ? '' : ' empty'}`}>
              <div className="week-col-head">
                <span className="wd">{hdr.wd}</span>
                <span className="dn">{hdr.day}</span>
                {matches.length > 0 && (
                  <button
                    type="button"
                    className="week-day-btn"
                    onClick={() => setDayModal({ matches, hidden })}
                    title={`Show all ${matches.length} match${matches.length === 1 ? '' : 'es'} this day`}
                    aria-label={`Show all ${matches.length} match${matches.length === 1 ? '' : 'es'} on ${hdr.wd} ${hdr.day}`}
                  >
                    ⤢
                  </button>
                )}
              </div>
              <div className="week-col-body">
                {matches.map((m) => (
                  <WeekCell key={m.num} m={m} tz={tz} hidden={hidden} byNum={byNum} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {dayModal && (
        <DayMatchesModal
          matches={dayModal.matches}
          tz={tz}
          hideScores={dayModal.hidden}
          byNum={byNum}
          onClose={() => setDayModal(null)}
        />
      )}
    </div>
  )
}
