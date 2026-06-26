import { useEffect, useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { simulateR32, R32_SLOT_LABELS } from '../utils/bracketOdds.js'

const RUNS = 10000
const MAX_SHOWN = 5 // candidate teams listed per open spot

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
  const restPct = dist.candidates.slice(MAX_SHOWN).reduce((s, c) => s + c.pct, 0)
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
              <span className="bo-pct">{c.pct >= 0.995 ? '>99' : c.pct < 0.005 ? '<1' : Math.round(c.pct * 100)}%</span>
            </li>
          ))}
          {restPct > 0.005 && (
            <li className="bo-cand bo-rest">
              <span className="bo-cand-name">+{dist.candidates.length - shown.length} more</span>
              <span className="bo-pct">{Math.round(restPct * 100)}%</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function BracketOddsView({ matches }) {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    setBusy(true)
    // Defer so the "Simulating…" state paints before the (synchronous) run.
    const id = setTimeout(() => {
      setResult(simulateR32(matches, { runs: RUNS }))
      setBusy(false)
    }, 30)
    return () => clearTimeout(id)
  }, [matches, nonce])

  const nums = Object.keys(R32_SLOT_LABELS)
    .map(Number)
    .sort((a, b) => a - b)
  const anyOpen =
    result && nums.some((n) => result.perMatch[n].some((s) => !s.locked && s.candidates.length))
  const allLocked =
    result && nums.every((n) => result.perMatch[n].every((s) => s.locked))

  return (
    <div className="bracket-odds">
      <div className="bo-intro">
        <p>
          For each open Round-of-32 spot, the share of the <strong>remaining outcomes</strong> that
          put each team there — every still-to-play group result weighted equally (a coin-flip among
          win / draw / loss). Not a prediction: it’s the proportion of possible scenarios, not a
          forecast of who’s likely to win.
        </p>
        <div className="bo-bar-row">
          <span className="bo-runs">
            {busy ? 'Simulating remaining outcomes…' : `from ${result.runs.toLocaleString()} equally-weighted outcomes`}
          </span>
          <button className="bo-recompute" onClick={() => setNonce((n) => n + 1)} disabled={busy}>
            ⟳ Re-run
          </button>
        </div>
      </div>

      {allLocked && (
        <p className="bo-note">✅ Every Round-of-32 matchup is now mathematically set.</p>
      )}
      {result && !anyOpen && !allLocked && (
        <p className="bo-note">No open spots have candidates yet — check back once group games are played.</p>
      )}

      {result && (
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
      )}
    </div>
  )
}
