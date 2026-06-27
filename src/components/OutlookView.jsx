import { useEffect, useMemo, useRef, useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { R32_SLOT_LABELS, countRemaining, totalOutcomes } from '../utils/outlookEnum.js'

// Above this many remaining games the outcome space (3^N) is too large to walk
// exactly in reasonable time — wait until the field narrows.
const MAX_REMAINING = 14 // 3^14 = 4,782,969

// Reconcile the one-goal enumeration's per-slot "locked" flags with the EXACT
// margin-aware reachability. The enumeration walks only one-goal scorelines, so a
// margin-dependent team (Scotland-type) shows 0% and a third-place slot can read
// "100% / clinched" even though that team could still land there via a goal-swing
// the one-goal model can't represent. Here we (a) map each match to the still-
// alive teams that could fill its third slot, and (b) demote any third slot whose
// one-goal "locked" would otherwise over-claim — so we NEVER show a slot clinched
// while someone can still reach it. Winner/runner-up slots are unaffected (margin-
// dependent survivors are third-placed teams). Exported for testing.
export function reconcileLocks(result, slotLabels, hiddenAlive, aliveSlots) {
  const byMatch = {}
  for (const team of hiddenAlive) {
    for (const s of aliveSlots?.[team] || []) {
      ;(byMatch[s.matchNum] ||= []).push(team)
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
                title="Mathematically alive but margin-dependent — see the note below"
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
  const [errMsg, setErrMsg] = useState('')
  const matchesRef = useRef(matches)
  matchesRef.current = matches

  const remaining = countRemaining(matches)
  const total = totalOutcomes(matches)

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

  // Reconcile the one-goal "locked" flags with exact reachability: byMatch maps a
  // match to the still-alive teams that could fill its third slot, and `effLocked`
  // is the TRUE clinch status (a third slot a margin-dependent team can still
  // reach is no longer shown as clinched). See reconcileLocks above.
  const { byMatch: aliveByMatch, locked: effLocked } = useMemo(
    () => reconcileLocks(result, R32_SLOT_LABELS, hiddenAlive, aliveSlots),
    [result, hiddenAlive, aliveSlots],
  )

  // The bracket is fully set only if every slot is TRULY locked and nobody is
  // still alive-but-hidden.
  const allLocked =
    result && hiddenAlive.length === 0 && nums.every((n) => (effLocked[n] || []).every(Boolean))

  // The group-winner side of a third-place match, resolved to a real team when
  // it's already locked, else the "Winner Group X" placeholder.
  const winnerInfo = (matchNum) => {
    const labels = R32_SLOT_LABELS[matchNum] || []
    const idx = labels.findIndex((l) => /^Winner Group/.test(l))
    if (idx < 0) return { label: `Match ${matchNum}` }
    const dist = result?.perMatch?.[matchNum]?.[idx]
    return { team: dist?.locked || null, label: labels[idx] }
  }

  return (
    <div className="bracket-odds">
      <div className="bo-intro">
        <p>
          For each open Round-of-32 spot, the share of the <strong>remaining outcomes</strong> that
          put each team there — computed by walking <strong>every</strong> still-possible win / draw /
          loss combination of the group games (each weighted equally). Not a forecast: it’s the exact
          proportion of possible scenarios, not a prediction of who’s likely to win. Goal-difference
          ties use a one-goal convention.
        </p>
        <p className="bo-count">
          <strong>{remaining}</strong> group game{remaining === 1 ? '' : 's'} left ·{' '}
          <strong>{total.toLocaleString()}</strong> possible outcome{total === 1 ? '' : 's'}
          {phase === 'done' && ' · all enumerated'}
        </p>
      </div>

      {phase === 'toomany' && (
        <p className="bo-note">
          Too many games remain to enumerate exactly right now ({remaining} left → {total.toLocaleString()} outcomes).
          This view becomes available once the field narrows toward the final matchday (≤ {MAX_REMAINING} games).
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
          {allLocked && <p className="bo-note">✅ Every Round-of-32 matchup is now mathematically set.</p>}
          <div className="bo-bar-row">
            <span className="bo-runs">exact — all {result.total.toLocaleString()} outcomes enumerated</span>
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

          {hiddenAlive.length > 0 && (
            <div className="bo-alive" id="bo-alive-note">
              <div className="bo-alive-head">Still mathematically alive — but margin-dependent</div>
              <p className="bo-alive-note">
                These teams can still reach the Round of 32, but only through goal-difference swings
                (a rival third-placed team finishing well below them via a heavy result). The
                percentages above model each remaining game at a one-goal margin, so those paths
                aren’t counted there and these teams show 0% (tagged “&lt;1%” in the bracket) — they
                are <strong>not</strong> eliminated.
              </p>
              <ul className="bo-alive-list">
                {hiddenAlive.map((team) => {
                  const slots = aliveSlots?.[team] || []
                  return (
                    <li className="bo-alive-team" key={team}>
                      <span className="bo-cand-flag">{FLAG_BY_TEAM[team] || '•'}</span>
                      <span className="bo-cand-name">{team}</span>
                      {slots.length > 0 && (
                        <span className="bo-alive-dest">
                          → if they advance, they’d play{' '}
                          {slots.map((s, i) => {
                            const w = winnerInfo(s.matchNum)
                            return (
                              <span key={s.matchNum}>
                                {i > 0 && ' or '}
                                <strong>{w.team || w.label}</strong> (Match {s.matchNum})
                              </span>
                            )
                          })}
                        </span>
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
