import { useEffect, useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { STAGE_LABELS } from '../data/matches.js'
import { nameKey } from '../utils/tournamentStats.js'
import { fetchMatchLines } from '../services/espnMatchStats.js'
import { useModalA11y } from '../hooks/useModalA11y.js'
import { useDetail } from '../context/detail.js'

// Golden Boot player popup: match by match, when they scored and against whom
// (from the merged goal feeds — instant), plus their assists and minutes for
// each match (from ESPN's per-match summaries — fetched on open, cached once a
// match is final). Minutes are derived from starter/substitution events, so
// they're labelled approximate.

const minuteLabel = (g) => `${g.minute != null ? g.minute : '?'}${g.extra ? `+${g.extra}` : ''}’`

export default function PlayerDetail({ scorer, matches, onClose }) {
  const cardRef = useModalA11y(onClose)
  const openDetail = useDetail()
  const [lines, setLines] = useState({}) // match num -> line | 'error'

  const key = nameKey(scorer.name)
  // Every match the player's team has contested (finished or in play), oldest first.
  const teamMatches = matches
    .filter((m) => (m.t1 === scorer.team || m.t2 === scorer.team) && Array.isArray(m.score) && !m.voided)
    .sort((a, b) => new Date(a.ko) - new Date(b.ko))

  useEffect(() => {
    const ctrl = new AbortController()
    for (const m of teamMatches) {
      if (!m.espnId) {
        setLines((s) => ({ ...s, [m.num]: 'error' }))
        continue
      }
      fetchMatchLines(m.espnId, { final: !m.live, signal: ctrl.signal })
        .then(({ byName }) =>
          setLines((s) => ({ ...s, [m.num]: byName[key] || { played: false, minutes: 0, assists: 0 } })),
        )
        .catch((e) => {
          // An abort means this effect run was superseded (unmount/re-run) —
          // not a data failure; let the successor's results land instead.
          if (e?.name === 'AbortError') return
          setLines((s) => ({ ...s, [m.num]: 'error' }))
        })
    }
    return () => ctrl.abort()
    // teamMatches derives from matches+scorer; key both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scorer.name, scorer.team, matches])

  const totalKnown = teamMatches.every((m) => lines[m.num] && lines[m.num] !== 'error')

  return (
    <div className="md-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${scorer.name} — match by match`}>
      <div className="md-card pd-card" ref={cardRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="md-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="pd-head">
          <span className="pd-flag">{FLAG_BY_TEAM[scorer.team] || '•'}</span>
          <div>
            <h3 className="pd-name">{scorer.name}</h3>
            <div className="pd-sub">
              {scorer.team} · ⚽ {scorer.goals}
              {scorer.pens > 0 && ` (${scorer.pens} pen${scorer.pens === 1 ? '' : 's'})`}
              {scorer.assists != null && ` · ${scorer.assists} assist${scorer.assists === 1 ? '' : 's'}`}
              {scorer.minutes != null && ` · ${scorer.minutes}′ played`}
            </div>
          </div>
        </div>

        <table className="pd-table">
          <thead>
            <tr>
              <th>Match</th>
              <th className="pd-result">Result</th>
              <th>Goals</th>
              <th className="pd-num" title="Assists in this match">A</th>
              <th className="pd-num" title="Minutes played (approximate)">Min</th>
            </tr>
          </thead>
          <tbody>
            {teamMatches.map((m) => {
              const side = m.t1 === scorer.team ? 't1' : 't2'
              const opp = side === 't1' ? m.t2 : m.t1
              const [gf, ga] = side === 't1' ? m.score : [m.score[1], m.score[0]]
              let res = gf > ga ? 'W' : gf < ga ? 'L' : 'D'
              if (res === 'D' && m.pens) {
                const [pf, pa] = side === 't1' ? m.pens : [m.pens[1], m.pens[0]]
                if (pf !== pa) res = pf > pa ? 'W' : 'L'
              }
              const goals = (m.goals?.[side] || []).filter((g) => !g.og && nameKey(g.name || '') === key)
              const line = lines[m.num]
              return (
                <tr key={m.num} className={line && line !== 'error' && !line.played ? 'pd-benched' : undefined}>
                  <td className="pd-match">
                    <button className="pd-match-btn" onClick={() => openDetail(m)} title="Open match details">
                      <span className="pd-stage">{m.stage === 'Group' ? `Group ${m.group}` : STAGE_LABELS[m.stage]}</span>
                      <span className="pd-opp">vs {FLAG_BY_TEAM[opp] || ''} {opp}</span>
                    </button>
                  </td>
                  <td className={`pd-result pd-${res.toLowerCase()}`}>
                    {res} {gf}–{ga}
                    {m.pens && <span className="pd-pens"> p{side === 't1' ? `${m.pens[0]}–${m.pens[1]}` : `${m.pens[1]}–${m.pens[0]}`}</span>}
                    {m.live && <span className="boot-live" title="In play">●</span>}
                  </td>
                  <td className="pd-goals">
                    {goals.length
                      ? goals.map((g, i) => (
                          <span key={i} className="pd-goal">
                            ⚽ {minuteLabel(g)}
                            {g.penalty && <em> pen</em>}
                          </span>
                        ))
                      : '—'}
                  </td>
                  <td className="pd-num">{line === 'error' ? '—' : line ? line.assists : '…'}</td>
                  <td className="pd-num">
                    {line === 'error'
                      ? '—'
                      : !line
                        ? '…'
                        : !line.played
                          ? 'DNP'
                          : m.live
                            ? '—' // still in play — final minutes unknowable
                            : `${line.minutes}′`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="pd-note">
          Goals from the live score feeds. Assists and minutes per match via ESPN
          {totalKnown ? '' : ' (loading…)'} — minutes are approximate (derived from starts and
          substitutions). DNP = in the squad but didn’t play. Click a match for its full detail.
        </p>
      </div>
    </div>
  )
}
