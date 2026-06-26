import { useEffect, useRef, useState } from 'react'
import { MATCHES } from '../data/matches.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { fetchResults, applyResults, RESULTS_SOURCE } from '../services/results.js'
import { R32_SLOT_LABELS, countRemaining, totalOutcomes } from '../utils/outlookEnum.js'

// Above this many remaining games, the outcome space (3^N) is too large to walk
// exactly in a reasonable time — the page waits until the field narrows.
const MAX_REMAINING = 14 // 3^14 = 4,782,969

const MAX_SHOWN = 6

function Side({ dist, slotLabel }) {
  if (dist.locked) {
    return (
      <div className="bo-side bo-locked">
        <span className="bo-flag">{FLAG_BY_TEAM[dist.locked] || '•'}</span>
        <span className="bo-team">{dist.locked}</span>
        <span className="bo-confirmed" title="Fills this spot in 100% of remaining outcomes">✅</span>
      </div>
    )
  }
  const shown = dist.candidates.slice(0, MAX_SHOWN)
  const rest = dist.candidates.slice(MAX_SHOWN)
  const restPct = rest.reduce((s, c) => s + c.pct, 0)
  const fmt = (p) => (p >= 0.995 ? '>99' : p < 0.005 ? '<1' : Math.round(p * 100))
  return (
    <div className="bo-side">
      <div className="bo-slot-label">{slotLabel}</div>
      {dist.candidates.length === 0 ? (
        <div className="bo-cand bo-tbd">To be determined</div>
      ) : (
        <ul className="bo-cands">
          {shown.map((c) => (
            <li className="bo-cand" key={c.team}>
              <span className="bo-bar" style={{ width: `${Math.max(3, c.pct * 100)}%` }} aria-hidden="true" />
              <span className="bo-cand-flag">{FLAG_BY_TEAM[c.team] || '•'}</span>
              <span className="bo-cand-name">{c.team}</span>
              <span className="bo-pct">{fmt(c.pct)}%</span>
            </li>
          ))}
          {restPct > 0.005 && (
            <li className="bo-cand bo-rest">
              <span className="bo-cand-name">+{rest.length} more</span>
              <span className="bo-pct">{fmt(restPct)}%</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function Outlook() {
  const [matches, setMatches] = useState(null)
  const [feedError, setFeedError] = useState(false)
  const [phase, setPhase] = useState('loading') // loading | counting | enumerating | done | error | toomany
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [errMsg, setErrMsg] = useState('')
  const [nonce, setNonce] = useState(0)
  const workerRef = useRef(null)

  // Load the current results so we know which group games are still open.
  useEffect(() => {
    let alive = true
    setPhase('loading')
    fetchResults()
      .then((map) => alive && setMatches(applyResults(MATCHES, map)))
      .catch(() => {
        if (!alive) return
        setFeedError(true)
        setMatches(MATCHES) // schedule only; likely "too many" until results land
      })
    return () => {
      alive = false
    }
  }, [nonce])

  // Spawn the worker once we have a feasible number of remaining games.
  useEffect(() => {
    if (!matches) return
    const remaining = countRemaining(matches)
    if (remaining > MAX_REMAINING) {
      setPhase('toomany')
      return
    }
    setPhase('enumerating')
    setProgress(0)
    setResult(null)
    const worker = new Worker(new URL('../workers/outlook.worker.js', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') setProgress(msg.done / msg.total)
      else if (msg.type === 'done') {
        setResult(msg.result)
        setPhase('done')
        worker.terminate()
      } else if (msg.type === 'error') {
        setErrMsg(msg.message)
        setPhase('error')
        worker.terminate()
      }
    }
    worker.postMessage(matches)
    return () => worker.terminate()
  }, [matches])

  const remaining = matches ? countRemaining(matches) : null
  const total = matches ? totalOutcomes(matches) : null
  const nums = Object.keys(R32_SLOT_LABELS)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="app outlook-page">
      <header className="app-header">
        <div className="title-block">
          <h1><span className="trophy">🏆</span> R32 Outlook</h1>
          <p className="subtitle">
            Exact enumeration of every remaining group-stage outcome ·{' '}
            <a href="./index.html">← back to the schedule</a>
          </p>
        </div>
      </header>

      <div className="bo-intro">
        <p>
          For each open Round-of-32 spot, the share of the <strong>remaining outcomes</strong> that
          put each team there — computed by walking <strong>every</strong> still-possible win / draw /
          loss combination of the group games (each weighted equally). This is not a forecast: it’s
          the exact proportion of possible scenarios, not a prediction of who’s likely to win.
          Goal-difference ties use a one-goal convention.
        </p>
        {remaining != null && (
          <p className="bo-count">
            <strong>{remaining}</strong> group game{remaining === 1 ? '' : 's'} left ·{' '}
            <strong>{total.toLocaleString()}</strong> possible outcome{total === 1 ? '' : 's'}
            {phase === 'done' && ' · all enumerated'}
          </p>
        )}
        {feedError && (
          <p className="bo-note">
            Couldn’t reach the results feed ({RESULTS_SOURCE.name}); showing the schedule only.
          </p>
        )}
      </div>

      {phase === 'loading' && <p className="bo-note">Loading current results…</p>}

      {phase === 'toomany' && (
        <p className="bo-note">
          Too many games remain to enumerate exactly right now ({remaining} left → {total.toLocaleString()} outcomes).
          This page becomes available once the field narrows toward the final matchday (≤ {MAX_REMAINING} games).
        </p>
      )}

      {phase === 'error' && <p className="bo-note">Enumeration failed: {errMsg}</p>}

      {phase === 'enumerating' && (
        <div className="bo-progress">
          <div className="bo-progress-label">Enumerating {total.toLocaleString()} outcomes… {Math.round(progress * 100)}%</div>
          <div className="bo-progress-track"><div className="bo-progress-fill" style={{ width: `${progress * 100}%` }} /></div>
        </div>
      )}

      {phase === 'done' && result && (
        <>
          <div className="bo-bar-row">
            <span className="bo-runs">exact — all {result.total.toLocaleString()} outcomes enumerated</span>
            <button className="bo-recompute" onClick={() => setNonce((n) => n + 1)}>⟳ Refresh results &amp; re-run</button>
          </div>
          <div className="bo-grid">
            {nums.map((n) => {
              const [s1, s2] = result.perMatch[n]
              const labels = R32_SLOT_LABELS[n]
              return (
                <div className="bo-match" key={n}>
                  <div className="bo-match-head">Match {n}</div>
                  <Side dist={s1} slotLabel={labels[0]} />
                  <div className="bo-vs">vs</div>
                  <Side dist={s2} slotLabel={labels[1]} />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
