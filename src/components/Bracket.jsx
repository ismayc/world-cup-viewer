import { useEffect } from 'react'
import { STAGE_LABELS } from '../data/matches.js'
import { VENUES } from '../data/venues.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { BRACKET, matchesByNum } from '../utils/bracket.js'
import { formatTime, tzAbbrev, statusFlag, teamKickoffTooltip } from '../utils/time.js'
import { useFollow } from '../context/follow.jsx'
import { useDetail } from '../context/detail.js'
import LiveBadge from './LiveBadge.jsx'
import ScoreCheck from './ScoreCheck.jsx'

// Team names are pre-resolved upstream (clinched "Winner Group X" slots are
// already filled in the match data), so this just renders whatever it's given.
function Side({ name, ko }) {
  const { isFollowed } = useFollow()
  const flag = FLAG_BY_TEAM[name]
  const on = Boolean(flag) && isFollowed(name)
  return (
    <div className={`bx-side${on ? ' followed' : ''}`} title={teamKickoffTooltip(ko, name) || undefined}>
      <span className="bx-flag">{flag || '·'}</span>
      <span className={flag ? 'bx-team' : 'bx-tbd'}>{name}</span>
    </div>
  )
}

function BracketMatch({ num, byNum, tz, hideScores }) {
  const openDetail = useDetail()
  const m = byNum[num]
  if (!m) return null
  const venue = VENUES[m.venue]
  const date = new Date(m.ko).toLocaleDateString('en-US', {
    timeZone: tz,
    month: 'short',
    day: 'numeric',
  })
  const flag = statusFlag(m)
  const voided = flag?.kind === 'voided'
  const awarded = flag?.kind === 'awarded'
  const showScore = m.score && !hideScores
  return (
    <div className="bx-match" id={`bx-m${m.num}`} role="button" tabIndex={0}
      aria-label={`${m.t1} versus ${m.t2}, ${STAGE_LABELS[m.stage]}, Match ${m.num}`}
      onClick={() => openDetail(m)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openDetail(m)}>
      <div className="bx-meta">
        <span>M{m.num}</span>
        {/* Voided (abandoned/postponed/canceled): a muted pill instead of a
            kickoff time. Otherwise the live clock, else the scheduled time. */}
        {voided ? (
          <span className="status-badge" role="status" aria-label={flag.label}>
            {flag.label === 'Abandoned' || flag.label === 'Canceled' ? '⚠' : '⏸'} {flag.label}
          </span>
        ) : m.live ? <LiveBadge match={m} /> : (
          <span>
            {date} · {formatTime(m.ko, tz)} {tzAbbrev(m.ko, tz)}
          </span>
        )}
      </div>
      <Side name={m.t1} ko={m.ko} />
      <Side name={m.t2} ko={m.ko} />
      {showScore && (
        <div className="bx-score">
          {voided && <span className="status-badge">{flag.label}</span>}
          {m.score[0]}–{m.score[1]}
          {m.pens && <span className="bx-pens"> (p {m.pens[0]}–{m.pens[1]})</span>}
          {m.aet && !m.pens && <span className="bx-pens"> AET</span>}
          {awarded && <span className="awarded-note">awarded</span>}
          {!voided && <ScoreCheck match={m} compact />}
        </div>
      )}
      <div className="bx-venue">
        {venue.countryFlag} {venue.city}
      </div>
    </div>
  )
}

function Column({ title, nums, byNum, tz, hideScores }) {
  return (
    <div className="bx-col">
      <div className="bx-col-head">{title}</div>
      <div className="bx-col-body">
        {nums.map((n) => (
          <BracketMatch key={n} num={n} byNum={byNum} tz={tz} hideScores={hideScores} />
        ))}
      </div>
    </div>
  )
}

export default function Bracket({ matches, tz, hideScores, focusMatch, onFocusHandled }) {
  const byNum = matchesByNum(matches)
  const common = { byNum, tz, hideScores }

  // When arriving from an "As it stands" link, scroll the target match into
  // view (the bracket scrolls horizontally) and flash a highlight, then clear.
  useEffect(() => {
    if (focusMatch == null) return
    const el = document.getElementById(`bx-m${focusMatch}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' })
      el.classList.add('bx-focus')
      setTimeout(() => el.classList.remove('bx-focus'), 2200)
    }
    onFocusHandled?.()
  }, [focusMatch, onFocusHandled])

  return (
    <div className="bracket-wrap">
      <p className="bracket-hint">Scroll horizontally to follow the path to the Final →</p>
      <div className="bracket">
        <Column title={STAGE_LABELS.R32} nums={BRACKET.left.R32} {...common} />
        <Column title={STAGE_LABELS.R16} nums={BRACKET.left.R16} {...common} />
        <Column title={STAGE_LABELS.QF} nums={BRACKET.left.QF} {...common} />
        <Column title={STAGE_LABELS.SF} nums={BRACKET.left.SF} {...common} />

        <div className="bx-col bx-col-final">
          <div className="bx-col-head bx-final-head">🏆 {STAGE_LABELS.Final}</div>
          <div className="bx-col-body">
            <BracketMatch num={BRACKET.final[0]} {...common} />
            <div className="bx-third-label">{STAGE_LABELS['3rd']}</div>
            <BracketMatch num={BRACKET.third[0]} {...common} />
          </div>
        </div>

        <Column title={STAGE_LABELS.SF} nums={BRACKET.right.SF} {...common} />
        <Column title={STAGE_LABELS.QF} nums={BRACKET.right.QF} {...common} />
        <Column title={STAGE_LABELS.R16} nums={BRACKET.right.R16} {...common} />
        <Column title={STAGE_LABELS.R32} nums={BRACKET.right.R32} {...common} />
      </div>
    </div>
  )
}
