// The live-clock badge, shared by every view so in-progress matches look the
// same everywhere. Shows ESPN's real clock (incl. stoppage like "45'+3'") and
// announces itself to screen readers. Renders nothing unless the match is live.
// Spoiler-free mode shows only LIVE: a minute like "90+3'" or an "ET 105'" badge
// says the match went past full time, and a clock that later changes to "ET"
// would give extra time away. The tooltip and screen-reader text drop the clock too.
export default function LiveBadge({ match, className = 'badge-live', hideScores = false }) {
  if (!match.live) return null
  const { clock, detail, delayed, label } = match.live
  // A paused match (delayed/weather or suspended) isn't playing — show it in
  // amber, not the red running clock, so it doesn't read as "in progress".
  if (delayed) {
    const word = label || 'Delayed'
    return (
      <span className="badge-delayed" role="status" aria-label={word} title={detail || word}>
        ⏸ {word}
      </span>
    )
  }
  const shownDetail = hideScores ? '' : detail
  return (
    <span className={className} role="status" aria-label={`Live${shownDetail ? `, ${shownDetail}` : ''}`} title={shownDetail || 'Live'}>
      ● {hideScores ? 'LIVE' : clock || 'LIVE'}
    </span>
  )
}
