// World Cup Today — an Übersicht (https://tracesof.net/uebersicht/) widget that
// lists TODAY's 2026 FIFA World Cup matches with Mountain-time kickoffs, read
// from the maintained calendar feed (resolved teams + live scores).
//
// Install: copy this folder ("world-cup-today.widget") into Übersicht's widgets
// folder (Übersicht menu → "Open Widgets Folder"), then refresh.

// How often to re-pull the feed.
export const refreshFrequency = 10 * 60 * 1000 // 10 minutes

// The feed is fetched with a shell `curl` so there are no browser CORS limits.
export const command =
  "curl -s --max-time 15 'https://world-cup-viewer.netlify.app/calendar.ics'"

// Arizona Mountain Time — fixed MST year-round (no daylight saving). The feed
// stores kickoffs in UTC, so this localizes them. For Mountain Time WITH daylight
// saving (Denver etc., shows MDT in summer), use 'America/Denver' instead.
const TZ = 'America/Phoenix'

const fmtTime = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
})
// YYYY-MM-DD for the given instant *in TZ*, so "today" is the Mountain calendar day.
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)
const tzAbbrev = (d) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'short' })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value || 'MT'

function parseICSDate(v) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec((v || '').trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
}

function parseEvents(ics) {
  if (!ics) return []
  // Unfold RFC 5545 line continuations, then split into VEVENT blocks.
  const text = ics.replace(/\r?\n[ \t]/g, '')
  const blocks = text.split('BEGIN:VEVENT').slice(1)
  const out = []
  for (const b of blocks) {
    const body = b.split('END:VEVENT')[0]
    const get = (k) => {
      const mm = new RegExp('(?:^|\\n)' + k + ':(.*)').exec(body)
      return mm ? mm[1].trim() : ''
    }
    const start = parseICSDate(get('DTSTART'))
    if (!start) continue
    const summary = get('SUMMARY').replace(/^World Cup:\s*/, '')
    const location = get('LOCATION')
    const desc = get('DESCRIPTION')
    const stage = (desc.split('\\n')[0] || '').split(' · ')[0]
    const city = location.split(',')[1]?.trim() || location
    out.push({ start, summary, stage, city })
  }
  return out
}

export const render = ({ output }) => {
  if (!output || !output.includes('BEGIN:VEVENT')) {
    return (
      <div>
        <div className="hdr">🏆 World Cup — Today</div>
        <div className="empty">Couldn’t load the schedule.</div>
      </div>
    )
  }
  const now = new Date()
  const today = dayKey(now)
  const todays = parseEvents(output)
    .filter((e) => dayKey(e.start) === today)
    .sort((a, b) => a.start - b.start)

  return (
    <div>
      <div className="hdr">
        🏆 World Cup — Today <span className="tz">· times {tzAbbrev(now)}</span>
      </div>
      {todays.length === 0 ? (
        <div className="empty">No matches today.</div>
      ) : (
        todays.map((e, i) => {
          const live = now >= e.start && now - e.start < 135 * 60 * 1000
          return (
            <div className="row" key={i}>
              <div className="time">{fmtTime.format(e.start)}</div>
              <div className="match">
                <div className="teams">
                  {e.summary}
                  {live && <span className="live"> ● LIVE</span>}
                </div>
                <div className="meta">{[e.stage, e.city].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export const className = `
  top: 60px;
  right: 30px;
  width: 330px;
  /* Don't let a ⌘-drag turn into a text selection — lets you move the widget. */
  -webkit-user-select: none;
  user-select: none;
  cursor: default;
  font-family: -apple-system, 'SF Pro Text', Helvetica, Arial, sans-serif;
  color: #e8edf6;
  background: rgba(18, 22, 32, 0.82);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.40);

  .hdr {
    font-size: 12px; font-weight: 800; letter-spacing: 0.04em;
    color: #00c2a8; text-transform: uppercase; margin-bottom: 10px;
  }
  .hdr .tz { color: #6b7689; font-weight: 600; text-transform: none; letter-spacing: 0; }
  .empty { font-size: 13px; color: #97a3b8; }
  .row {
    display: flex; gap: 10px; align-items: baseline;
    padding: 7px 0; border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .row:nth-child(2) { border-top: none; }
  .time {
    font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px;
    min-width: 62px; color: #f4c542;
  }
  .teams { font-size: 13px; font-weight: 600; line-height: 1.3; }
  .teams .live { color: #ff4757; font-weight: 800; font-size: 11px; }
  .meta { font-size: 11px; color: #6b7689; margin-top: 1px; }
`
