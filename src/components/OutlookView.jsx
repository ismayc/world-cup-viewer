import { useEffect, useMemo, useRef, useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { R32_SLOT_LABELS, countRemaining } from '../utils/outlookEnum.js'

// Above this many remaining games the outcome space (3^N) is too large to walk
// exactly in reasonable time — wait until the field narrows.
const MAX_REMAINING = 14 // 3^14 = 4,782,969

// Reconcile the one-goal enumeration's per-slot "locked" flags with the EXACT
// margin-aware reachability (`aliveSlots`: team -> reachable R32 third slots). The
// enumeration walks only one-goal scorelines, so it both (a) misses margin-
// dependent survivors (Scotland-type, shown 0%) and (b) can pin an already-
// qualified third to a single winner (Ecuador-type) when its Annexe C matchup
// could still shift if the set of qualifying thirds changes. For every team and
// every third slot it can REACHABLY fill but isn't already shown in, we add it as
// a margin-only "<1%" extra; any third slot that gains such an extra is no longer
// truly locked. Winner/runner-up slots are unaffected. Exported for testing.
export function reconcileLocks(result, slotLabels, aliveSlots) {
  const byMatch = {}
  if (result && aliveSlots) {
    for (const team of Object.keys(aliveSlots)) {
      for (const s of aliveSlots[team]) {
        const num = s.matchNum
        const sides = result.perMatch[num]
        const labels = slotLabels[num]
        if (!sides || !labels) continue
        const idx = labels.findIndex((l) => /^3rd/.test(l))
        if (idx < 0) continue
        const side = sides[idx]
        const shown = side.locked
          ? new Set([side.locked])
          : new Set(side.candidates.map((c) => c.team))
        if (!shown.has(team)) (byMatch[num] ||= []).push(team)
      }
    }
  }
  const locked = {}
  if (result) {
    for (const numStr of Object.keys(slotLabels)) {
      const num = Number(numStr)
      const sides = result.perMatch[num]
      if (!sides) {
        locked[num] = []
        continue
      }
      const labels = slotLabels[num]
      locked[num] = sides.map((side, i) => {
        const extras = /^3rd/.test(labels[i]) ? byMatch[num] || [] : []
        return Boolean(side.locked) && extras.length === 0
      })
    }
  }
  return { byMatch, locked }
}

function Side({ dist, slotLabel, extra = [], locked }) {
  const isLocked = locked ?? Boolean(dist.locked)
  if (isLocked) {
    return (
      <div className="bo-side bo-locked">
        <span className="bo-flag">{FLAG_BY_TEAM[dist.locked] || '•'}</span>
        <span className="bo-team">{dist.locked}</span>
        <span className="bo-confirmed" title="Fills this spot in every still-possible outcome">✅</span>
      </div>
    )
  }
  const fmt = (p) => (p >= 0.995 ? '>99' : p < 0.005 ? '<1' : Math.round(p * 100))
  return (
    <div className="bo-side">
      <div className="bo-slot-label">{slotLabel}</div>
      {dist.candidates.length === 0 && extra.length === 0 ? (
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
          {/* Margin-dependent contenders the one-goal model scores at 0% but that
              are NOT eliminated — shown as "<1%" linking to the note below. */}
          {extra.map((team) => (
            <li className="bo-cand bo-cand-alive" key={`alive-${team}`}>
              <span className="bo-cand-flag">{FLAG_BY_TEAM[team] || '•'}</span>
              <span className="bo-cand-name">{team}</span>
              <a
                className="bo-pct bo-pct-alive"
                href="#bo-alive-note"
                title="Possible only via a goal-difference swing beyond the enumerated range — see the note below"
              >
                &lt;1%
              </a>
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
  const [aliveSlots, setAliveSlots] = useState(null)
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
        setAliveSlots(msg.aliveSlots || {})
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

  // Teams that are mathematically still alive (exact check) yet never appear in
  // the one-goal enumeration above — their only paths to the Round of 32 hinge on
  // goal-difference swings the one-goal convention can't represent, so they read
  // as 0% and would otherwise vanish. Surface them explicitly.
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

  // The group-winner side of a third-place match, resolved to a real team when
  // it's already locked, else the "Winner Group X" placeholder.
  const winnerInfo = (matchNum) => {
    const labels = R32_SLOT_LABELS[matchNum] || []
    const idx = labels.findIndex((l) => /^Winner Group/.test(l))
    if (idx < 0) return { label: `Match ${matchNum}` }
    const dist = result?.perMatch?.[matchNum]?.[idx]
    return { team: dist?.locked || null, label: labels[idx] }
  }

  // Reconcile the one-goal "locked" flags with exact reachability: byMatch maps a
  // match to teams that could fill its third slot but aren't shown there, and
  // `effLocked` is the TRUE clinch status. See reconcileLocks above.
  const { byMatch: aliveByMatch, locked: effLocked } = useMemo(
    () => reconcileLocks(result, R32_SLOT_LABELS, aliveSlots),
    [result, aliveSlots],
  )

  // Already-shown thirds whose Annexe C opponent isn't fixed yet — they can still
  // face more than one group winner depending on which eight thirds qualify
  // (Ecuador-type). Listed separately from the hidden survivors.
  const shiftable = useMemo(() => {
    if (!aliveSlots) return []
    const hidden = new Set(hiddenAlive)
    return Object.keys(aliveSlots)
      .filter((t) => !hidden.has(t) && aliveSlots[t].length >= 2)
      .map((t) => ({ team: t, opponents: aliveSlots[t].map((s) => ({ matchNum: s.matchNum, ...winnerInfo(s.matchNum) })) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliveSlots, hiddenAlive, result])

  // The bracket is fully set only if every slot is TRULY locked and nobody is
  // still alive-but-hidden.
  const allLocked =
    result && hiddenAlive.length === 0 && nums.every((n) => (effLocked[n] || []).every(Boolean))

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
              // Margin-dependent teams attach to the third-place side of the match.
              const aliveHere = aliveByMatch[n] || []
              const extra1 = /^3rd/.test(labels[0]) ? aliveHere : []
              const extra2 = /^3rd/.test(labels[1]) ? aliveHere : []
              const lk = effLocked[n] || []
              return (
                <div className="bo-match" key={n}>
                  <div className="bo-match-head">Match {n}</div>
                  <Side dist={s1} slotLabel={labels[0]} extra={extra1} locked={lk[0]} />
                  <div className="bo-vs">vs</div>
                  <Side dist={s2} slotLabel={labels[1]} extra={extra2} locked={lk[1]} />
                </div>
              )
            })}
          </div>

          {(hiddenAlive.length > 0 || shiftable.length > 0) && (
            <div className="bo-alive" id="bo-alive-note">
              <div className="bo-alive-head">Beyond the enumerated margins</div>
              <p className="bo-alive-note">
                The percentages enumerate goal differences up to <strong>±{result.cap}</strong> per
                game. A couple of things that need a bigger swing than that — flagged “&lt;1%” in the
                bracket above:
              </p>
              {hiddenAlive.length > 0 && (
                <>
                  <div className="bo-alive-sub">Still mathematically alive</div>
                  <p className="bo-alive-subnote">
                    Can still reach the Round of 32, but only via a goal-difference swing larger than
                    ±{result.cap} — so they don’t register above. <strong>Not</strong> eliminated.
                  </p>
                  <ul className="bo-alive-list">
                {hiddenAlive.map((team) => {
                  const slots = aliveSlots?.[team] || []
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
                        {slots.length > 0 && (
                          <span className="bo-alive-dest">
                            · would play{' '}
                            {slots.map((s, i) => {
                              const w = winnerInfo(s.matchNum)
                              return (
                                <span key={s.matchNum}>
                                  {i > 0 && ' / '}
                                  <strong>{w.team || w.label}</strong> (M{s.matchNum})
                                </span>
                              )
                            })}
                          </span>
                        )}
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
                </>
              )}
              {shiftable.length > 0 && (
                <>
                  <div className="bo-alive-sub">Matchup not yet fixed</div>
                  <p className="bo-alive-subnote">
                    On course to qualify, but which group winner they meet depends on the full set of
                    eight best thirds (FIFA Annexe C) — so they could still face more than the one
                    winner shown above.
                  </p>
                  <ul className="bo-alive-list">
                    {shiftable.map(({ team, opponents }) => (
                      <li className="bo-alive-team" key={team}>
                        <div className="bo-alive-row">
                          <span className="bo-cand-flag">{FLAG_BY_TEAM[team] || '•'}</span>
                          <span className="bo-cand-name">{team}</span>
                          <span className="bo-alive-dest">
                            · could face{' '}
                            {opponents.map((o, i) => (
                              <span key={o.matchNum}>
                                {i > 0 && ' / '}
                                <strong>{o.team || o.label}</strong> (M{o.matchNum})
                              </span>
                            ))}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
