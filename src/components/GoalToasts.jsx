import { useEffect } from 'react'
import { goalNotification } from '../services/goalNotify.js'

// On-page goal toasts — the in-app twin of the browser notification. The OS
// often suppresses notifications for the tab you're actively looking at (which
// is exactly when you're watching the match), and they never show at all if
// permission was denied; these do. Same events, same formatting (reuses
// goalNotification), stacked top-right: click opens the match detail, ✕ (or
// ~8s) dismisses. App owns the item list; ids are the notification tag, so a
// goal can't stack twice.

export const TOAST_MS = 8000

function Toast({ item, onOpen, onDismiss }) {
  const { id, ev } = item
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), TOAST_MS)
    return () => clearTimeout(t)
  }, [id, onDismiss])
  const n = goalNotification(ev)
  const [scorer, score] = n.body.split('\n')
  return (
    <div className="goal-toast" role="status">
      <button
        className="toast-body"
        onClick={() => {
          onOpen(ev.match)
          onDismiss(id)
        }}
        title="Open match details"
      >
        <strong className="toast-title">{n.title}</strong>
        <span className="toast-line">{scorer}</span>
        <span className="toast-line toast-score">{score}</span>
      </button>
      <button className="toast-x" onClick={() => onDismiss(id)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}

export default function GoalToasts({ items, onOpen, onDismiss }) {
  if (!items.length) return null
  return (
    <div className="toast-stack" role="region" aria-label="Goal alerts">
      {/* Show the most recent few; a flood beyond that is already suppressed
          upstream, this is just belt-and-braces for quick successive goals. */}
      {items.slice(-4).map((item) => (
        <Toast key={item.id} item={item} onOpen={onOpen} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
