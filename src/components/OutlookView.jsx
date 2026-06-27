import { useEffect, useMemo, useRef, useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { R32_SLOT_LABELS, countRemaining } from '../utils/outlookEnum.js'

// Above this many remaining games the outcome space (3^N) is too large to walk
// exactly in reasonable time — wait until the field narrows.
const MAX_REMAINING = 14 // 3^14 = 4,782,969

function Side({ dist, slotLabel }) {
  if (dist.locked) {
    return (
      <div className="bo-side bo-locked">
        <span className="bo-flag">{FLAG_BY_TEAM[dist.locked] || '•'}</span>
        <span className="bo-team">{dist.locked}</span>
        <span className="bo-confirmed" title="Fills this spot in every enumerated outcome (margins to ±cap)">✅</span>
      </div>
    )
  }
  const fmt = (p) => (p >= 0.995 ? '>99' : p < 0.005 ? '<1' : Math.round(p * 100))
  return (
    <div className="bo-side">
      <div className="bo-slot-label">{slotLabel}</div>
      {dist.candidates.length === 0 ? (
        <div className="bo-cand bo-tbd">To be determined</div>
      ) : (
        <ul className="bo-cands">
          {/* Every team that can fill this spot, with its exact share. */}
          {dist.candidates.map((c) => (
            <li className="bo-cand" key={c.team}>
              <span className="bo-bar" style={{ width: `${Math.max(3, c.pct * 100)}%` }} aria-hidden="true" />
              <span className="bo-cand-flag">{FLAG_BY_TEAM[c.team] || '•'}</span>
              <span className="bo-cand-name">{c.team}</span>
              <span className="bo-pct">{fmt(c.pct)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function OutlookView({ matches }) {
  const [phase, setPhase] = useState('idle') // idle | enumerating | done | error | toomany
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [survivors, setSurvivors] = useState(null)
  const [requirements, setRequirements] = useState(null)
  const [errMsg, setErrMsg] = useState('')
  const matchesRef = useRef(matches)
  matchesRef.current = matches

  const remaining = countRemaining(matches)

  // Signature of the final group results — the enumeration only depends on these,
  // so a live-score poll that doesn't settle a group game won't restart it.
  const resultsKey = useMemo(
    () =>
      matches
        .filter((m) => m.stage === 'Group' && Array.isArray(m.score) && !m.live)
        .map((m) => `${m.num}:${m.score.join('-')}`)
        .sort()
        .join('|'),
    [matches],
  )

  useEffect(() => {
    if (remaining > MAX_REMAINING) {
      setPhase('toomany')
      return
    }
    setPhase('enumerating')
    setProgress(0)
    setResult(null)
    const worker = new Worker(new URL('../workers/outlook.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') setProgress(msg.done / msg.total)
      else if (msg.type === 'done') {
        setResult(msg.result)
        setSurvivors(msg.survivors || [])
        setRequirements(msg.requirements || {})
        setPhase('done')
        worker.terminate()
      } else if (msg.type === 'error') {
        setErrMsg(msg.message)
        setPhase('error')
        worker.terminate()
      }
    }
    worker.postMessage(matchesRef.current)
    return () => worker.terminate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey])

  const nums = Object.keys(R32_SLOT_LABELS)
    .map(Number)
    .sort((a, b) => a - b)

  // Teams the EXACT check (eliminationCheck) says are still alive, yet that never
  // appear in the enumeration above — i.e. their only surviving paths need a goal-
  // difference swing larger than the enumerated ±cap, so they don't register in
  // the grid. Surfaced as a small "still alive beyond the margins" net.
  const hiddenAlive = useMemo(() => {
    if (!result || !survivors) return []
    const shown = new Set()
    for (const n of nums) {
      for (const side of result.perMatch[n]) {
        if (side.locked) shown.add(side.locked)
        for (const c of side.candidates) shown.add(c.team)
      }
    }
    return survivors.filter((t) => !shown.has(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, survivors])

  // The bracket is fully set only if every slot is locked and nobody is alive but
  // unshown (needs a swing beyond the enumerated margins).
  const allLocked =
    result && hiddenAlive.length === 0 && nums.every((n) => result.perMatch[n].every((s) => s.locked))

  return (
    <div className="bracket-odds">
      <div className="bo-intro">
        <p>
          For each open Round-of-32 spot, the share of the <strong>remaining outcomes</strong> that
          put each team there — computed by walking <strong>every</strong> still-possible group result,
          enumerating each remaining game’s <strong>goal difference</strong> (each margin weighted
          equally). Not a forecast: it’s the exact proportion of possible scorelines, not a prediction
          of who’s likely to win.
        </p>
        <p className="bo-count">
          <strong>{remaining}</strong> group game{remaining === 1 ? '' : 's'} left
          {phase === 'done' && result && (
            <>
              {' '}· <strong>{result.total.toLocaleString()}</strong> scoreline
              {result.total === 1 ? '' : 's'} enumerated · margins to ±{result.cap}
            </>
          )}
        </p>
      </div>

      {phase === 'toomany' && (
        <p className="bo-note">
          Too many games remain to enumerate exactly right now ({remaining} left). This view becomes
          available once the field narrows toward the final matchday (≤ {MAX_REMAINING} games).
        </p>
      )}

      {phase === 'error' && <p className="bo-note">Enumeration failed: {errMsg}</p>}

      {phase === 'enumerating' && (
        <div className="bo-progress">
          <div className="bo-progress-label">Enumerating goal-difference outcomes… {Math.round(progress * 100)}%</div>
          <div className="bo-progress-track"><div className="bo-progress-fill" style={{ width: `${progress * 100}%` }} /></div>
        </div>
      )}

      {phase === 'done' && result && (
        <>
          {allLocked && <p className="bo-note">✅ Every Round-of-32 matchup is now mathematically set.</p>}
          <div className="bo-bar-row">
            <span className="bo-runs">
              exact — every group goal-difference outcome enumerated (margins to ±{result.cap})
            </span>
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

          {hiddenAlive.length > 0 && (
            <div className="bo-alive" id="bo-alive-note">
              <div className="bo-alive-head">Still mathematically alive — beyond the enumerated margins</div>
              <p className="bo-alive-note">
                The percentages enumerate goal differences up to <strong>±{result.cap}</strong> per
                game. These teams can still reach the Round of 32, but only via a swing larger than
                that — so they don’t appear in the bracket above. They are <strong>not</strong>{' '}
                eliminated.
              </p>
              <ul className="bo-alive-list">
                {hiddenAlive.map((team) => {
                  const req = requirements?.[team]
                  const p = req?.profile
                  const fmtGD = (v) => (v > 0 ? `+${v}` : `${v}`)
                  // The "below them" threshold, stated once per team rather than
                  // repeated on every rival line.
                  const threshold = p
                    ? `under ${p.Pts} pt${p.Pts === 1 ? '' : 's'}, or ${p.Pts} with GD below ${fmtGD(p.GD)}`
                    : null
                  return (
                    <li className="bo-alive-team" key={team}>
                      <div className="bo-alive-row">
                        <span className="bo-cand-flag">{FLAG_BY_TEAM[team] || '•'}</span>
                        <span className="bo-cand-name">{team}</span>
                      </div>
                      {/* Own group finished → exact "needs N of these" checklist. */}
                      {req && req.ownGroupComplete && req.variable.length > 0 && (
                        <div className="bo-req">
                          <div className="bo-req-head">
                            Needs{' '}
                            <strong>
                              {req.needAtLeast} of {req.variable.length}
                            </strong>{' '}
                            rival third{req.variable.length === 1 ? '' : 's'} to finish below them
                            {threshold && <span className="bo-req-thresh"> ({threshold})</span>}:
                          </div>
                          <ul className="bo-req-list">
                            {req.variable.map((v) => (
                              <li key={v.group}>
                                Group {v.group}{' '}
                                <span className="bo-req-cont">({v.contenders.join(' / ')})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* Own group still playing → points/GD aren't fixed yet, so
                          frame it as the two-step goal-difference race. */}
                      {req && !req.ownGroupComplete && (
                        <div className="bo-req">
                          <div className="bo-req-head">
                            Must finish <strong>3rd in Group {req.ownGroup}</strong>, then — as a{' '}
                            {req.thirdPts}-point third — win the goal-difference race with the other{' '}
                            {req.thirdPts}-point thirds for the last spot(s); the bigger the win, the
                            better.
                            {req.unresolvedGroups.length > 0 && (
                              <>
                                {' '}
                                Groups still unresolved that can shift the cut:{' '}
                                <span className="bo-req-cont">{req.unresolvedGroups.join(', ')}</span>.
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
