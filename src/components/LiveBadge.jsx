// The live-clock badge, shared by every view so in-progress matches look the
// same everywhere. Shows ESPN's real clock (incl. stoppage like "45'+3'") and
// announces itself to screen readers. Renders nothing unless the match is live.
export default function LiveBadge({ match, className = 'badge-live' }) {
  if (!match.live) return null
  const { clock, detail, delayed } = match.live
  // A delayed (e.g. weather) match is paused, not playing — show it in amber, not
  // the red running clock, so it doesn't read as "in progress".
  if (delayed) {
    return (
      <span className="badge-delayed" role="status" aria-label="Delayed" title={detail || 'Delayed'}>
        ⏸ Delayed
      </span>
    )
  }
  return (
    <span className={className} role="status" aria-label={`Live${detail ? `, ${detail}` : ''}`} title={detail || 'Live'}>
      ● {clock || 'LIVE'}
    </span>
  )
}
