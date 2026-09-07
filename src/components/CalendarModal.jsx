import { useState } from 'react'
import { downloadICSCollection, webcalUrl, googleCalendarUrl } from '../utils/ics.js'
import { useFollow } from '../context/follow.jsx'
import { useModalA11y } from '../hooks/useModalA11y.js'
import { LEAGUE } from '../config/league.js'

// Subscriptions must point at the deployed feed (a localhost URL can't be
// subscribed to), so links always use the production origin.
const PROD = LEAGUE.feedHost
const FEED = `${PROD}/calendar.ics`

function SubRow({ label, httpsUrl }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="cal-row">
      <span className="cal-row-label">{label}</span>
      <div className="cal-row-actions">
        <a className="cal-btn-primary" href={webcalUrl(httpsUrl)}>Subscribe</a>
        <a className="cal-btn-ghost" href={googleCalendarUrl(httpsUrl)} target="_blank" rel="noopener noreferrer">Google</a>
        <button className="cal-btn-ghost" onClick={copy}>{copied ? 'Copied!' : 'Copy URL'}</button>
      </div>
    </div>
  )
}

export default function CalendarModal({ matches, filtered, onClose }) {
  const { followed, count } = useFollow()
  const cardRef = useModalA11y(onClose)

  const teamsParam = [...followed].map(encodeURIComponent).join(',')
  const myFeed = `${FEED}?teams=${teamsParam}`
  const myMatches = matches.filter((m) => followed.has(m.t1) || followed.has(m.t2))

  return (
    <div className="md-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="md-card cal-modal" ref={cardRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="md-close" onClick={onClose} aria-label="Close">✕</button>
        <h3 className="cal-title">📅 Calendar</h3>

        <div className="md-section">
          <h4>Subscribe <span className="cal-hint">auto-updates as teams &amp; scores resolve</span></h4>
          <SubRow label="All 104 matches" httpsUrl={FEED} />
          {count > 0 && <SubRow label={`My teams (${count})`} httpsUrl={myFeed} />}
          <p className="cal-note">
            “Subscribe” opens your default calendar app. On Google, use the Google button. The feed
            refreshes roughly every couple of hours.
          </p>
        </div>

        <div className="md-section">
          <h4>One-time download <span className="cal-hint">snapshot, won’t update</span></h4>
          <div className="cal-downloads">
            <button onClick={() => downloadICSCollection(matches, 'worldcup-2026-all.ics')}>
              All matches ({matches.length})
            </button>
            <button onClick={() => downloadICSCollection(filtered, 'worldcup-2026-filtered.ics')}>
              Current filter ({filtered.length})
            </button>
            {count > 0 && (
              <button onClick={() => downloadICSCollection(myMatches, 'worldcup-2026-my-teams.ics', 'World Cup 2026 — My Teams')}>
                My teams ({myMatches.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
