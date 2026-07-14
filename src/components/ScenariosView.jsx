import { useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { computeQualification } from '../utils/qualification.js'
import { computeClinch } from '../utils/clinch.js'
import { projectKnockout } from '../utils/asItStands.js'
import { lockedOpponent, reachableThirdSets } from '../utils/opponentClinch.js'
import { softTiebreaks, TIEBREAK_LABEL } from '../utils/tiebreakNotes.js'
import ScalesIcon from './ScalesIcon.jsx'
import {
  remainingGroupMatches,
  applyScenarioPicks,
  unpickedCount,
  possibleOrderings,
  pickOutcome,
} from '../utils/scenarios.js'

function Stepper({ value, onChange, label }) {
  const v = value ?? 0
  return (
    <span className="sc-stepper">
      <button type="button" className="sc-step" onClick={() => onChange(Math.max(0, v - 1))} disabled={v <= 0} aria-label={`${label} minus`}>−</button>
      <span className="sc-step-val">{v}</span>
      <button type="button" className="sc-step" onClick={() => onChange(v + 1)} aria-label={`${label} plus`}>+</button>
    </span>
  )
}

function FixturePicker({ match, pick, onQuick, onScore }) {
  const outcome = pickOutcome(pick)
  const set = Array.isArray(pick)
  return (
    <div className="sc-fixture">
      <div className="sc-fx-line">
        <span className={`sc-fx-team${outcome === 'home' ? ' sc-win' : ''}`}>
          {FLAG_BY_TEAM[match.t1] || '•'} {match.t1}
        </span>
        <div className="sc-fx-buttons" role="group" aria-label={`${match.t1} vs ${match.t2} result`}>
          <button type="button" className={`sc-pick${outcome === 'home' ? ' active' : ''}`} onClick={() => onQuick(match.num, 'home')} title={`${match.t1} win`}>W</button>
          <button type="button" className={`sc-pick${outcome === 'draw' ? ' active' : ''}`} onClick={() => onQuick(match.num, 'draw')} title="Draw">D</button>
          <button type="button" className={`sc-pick${outcome === 'away' ? ' active' : ''}`} onClick={() => onQuick(match.num, 'away')} title={`${match.t2} win`}>W</button>
        </div>
        <span className={`sc-fx-team sc-fx-right${outcome === 'away' ? ' sc-win' : ''}`}>
          {match.t2} {FLAG_BY_TEAM[match.t2] || '•'}
        </span>
      </div>
      {set && (
        <div className="sc-score">
          <Stepper value={pick[0]} onChange={(n) => onScore(match.num, [n, pick[1]])} label={`${match.t1} goals`} />
          <span className="sc-score-dash">{pick[0]}–{pick[1]}</span>
          <Stepper value={pick[1]} onChange={(n) => onScore(match.num, [pick[0], n])} label={`${match.t2} goals`} />
        </div>
      )}
    </div>
  )
}

function ProjectedTable({ rows, decided, ties }) {
  return (
    <table className="sc-table">
      <thead>
        <tr>
          <th className="col-team">Projected {decided ? 'final' : 'order'}</th>
          <th>P</th><th>GD</th><th className="col-pts">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const tie = ties.get(r.name)
          return (
            <tr key={r.name} className={r.rank <= 2 ? 'qualifies' : ''}>
              <td className="col-team">
                <span className="rank">{r.rank}</span>
                <span className="team-flag">{r.flag}</span>
                <span className="row-team">{r.name}</span>
                {tie && (
                  <span
                    className="sc-tiebreak"
                    title={`Level with ${tie.vs} on points, head-to-head, goal difference and goals — separated by ${TIEBREAK_LABEL[tie.reason]}${tie.reason === 'conduct' ? ' (best-effort card data)' : ''}`}
                    aria-label={`Separated from ${tie.vs} by ${TIEBREAK_LABEL[tie.reason]}`}
                  >
                    <ScalesIcon />
                  </span>
                )}
                {r.rank <= 2 && <span className="sc-tag sc-adv">advances</span>}
                {r.rank === 3 && <span className="sc-tag sc-third">3rd</span>}
              </td>
              <td>{r.P}</td>
              <td>{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
              <td className="col-pts">{r.Pts}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// "As it stands → R32" line for a projected qualifier. `confirmed` is true once
// the matchup is mathematically locked given the results set so far.
function R32Line({ label, dest, confirmed }) {
  if (!dest?.team) return null
  return (
    <li className={`sc-r32-row${confirmed ? ' sc-r32-confirmed' : ''}`}>
      <span className="sc-r32-pos">{label}</span>
      <span className="sc-r32-team">{FLAG_BY_TEAM[dest.team] || ''} {dest.team}</span>
      <span className="sc-r32-vs">vs</span>
      <span className="sc-r32-opp">
        {dest.opponent ? `${FLAG_BY_TEAM[dest.opponent] || ''} ${dest.opponent}` : 'TBD'}
      </span>
      {dest.matchNum && <span className="sc-r32-num">M{dest.matchNum}</span>}
      {confirmed && <span className="sc-r32-lock" title="This matchup is confirmed — it can no longer change" aria-label="Matchup confirmed">✔️</span>}
    </li>
  )
}

const QUICK = { home: [1, 0], draw: [1, 1], away: [0, 1] }

export default function ScenariosView({ matches }) {
  const [picks, setPicks] = useState({})

  // Quick W/D/W: set a representative score, or clear it if that outcome is
  // already selected (toggle off).
  const onQuick = (num, outcome) =>
    setPicks((p) => {
      if (pickOutcome(p[num]) === outcome) {
        const { [num]: _drop, ...rest } = p
        return rest
      }
      return { ...p, [num]: QUICK[outcome] }
    })
  const onScore = (num, score) => setPicks((p) => ({ ...p, [num]: score }))
  const clear = () => setPicks({})

  const remaining = remainingGroupMatches(matches)
  const groupsInPlay = Object.keys(remaining).sort()
  const synthetic = applyScenarioPicks(matches, picks)
  const qual = computeQualification(synthetic)
  const { perGroup } = projectKnockout(synthetic)
  const leftToPick = unpickedCount(matches, picks)
  const pickedAny = Object.keys(picks).length > 0

  // A projected matchup is "confirmed" once it can no longer change given the
  // results set so far. Compute the clinch once; only enumerate the (costlier)
  // reachable third-place sets when a group winner is clinched, since that's the
  // only case whose opponent is a third-place slot.
  const clinch = computeClinch(synthetic)
  // Once every group is decided the whole bracket is fixed, so every matchup is
  // confirmed. Before then, fall back to the exact per-matchup lock check.
  const allComplete = qual.allComplete
  const reachable =
    !allComplete && Object.values(clinch).includes('won-group') ? reachableThirdSets(synthetic) : []
  // `lockedOpponent` only resolves from a group winner / runner-up, so check BOTH
  // sides of the tie — this also confirms a third-placed team's line (resolved via
  // its winner opponent).
  const lockedBetween = (a, b, matchNum) => {
    const l = lockedOpponent(synthetic, a, clinch, reachable)
    return Boolean(l) && l.opponent === b && l.matchNum === matchNum
  }
  const isConfirmed = (dest) => {
    if (!dest?.team || !dest.opponent) return false
    if (allComplete) return true
    return lockedBetween(dest.team, dest.opponent, dest.matchNum) ||
      lockedBetween(dest.opponent, dest.team, dest.matchNum)
  }

  if (!groupsInPlay.length) {
    return (
      <div className="sc-empty">
        <p>🏁 Every group is decided — no scenarios left to explore.</p>
        <p className="sc-empty-sub">Head to the Bracket to see the knockout matchups.</p>
      </div>
    )
  }

  return (
    <div className="scenarios">
      <div className="sc-intro">
        <p>
          Pick the result of each remaining group game to see exactly how the standings and the
          Round of 32 would shake out. Deterministic — no predictions, just the consequences of the
          results you choose.
        </p>
        <div className="sc-intro-bar">
          <span className="sc-left">{leftToPick} game{leftToPick === 1 ? '' : 's'} still open</span>
          {pickedAny && (
            <button className="sc-clear" onClick={clear}>Clear picks</button>
          )}
        </div>
      </div>

      <div className="sc-grid">
        {groupsInPlay.map((g) => {
          const open = remaining[g]
          const allPicked = open.every((m) => Array.isArray(picks[m.num]))
          const proj = perGroup[g] || {}
          // Distinct final standings still reachable given the results set so far.
          const { count, decided } = possibleOrderings(g, synthetic)
          // Placings decided by a soft tie-breaker (cards / FIFA ranking).
          const ties = softTiebreaks(g, synthetic)
          return (
            <div className="sc-card" key={g}>
              <h3 className="group-title">
                Group {g}
                <span className={`sc-card-state${decided ? ' sc-decided' : ''}`}>
                  {count == null
                    ? `${open.filter((m) => !Array.isArray(picks[m.num])).length} to pick`
                    : decided
                      ? 'order decided'
                      : `${count} possible orders`}
                </span>
              </h3>

              <div className="sc-fixtures">
                {open.map((m) => (
                  <FixturePicker key={m.num} match={m} pick={picks[m.num]} onQuick={onQuick} onScore={onScore} />
                ))}
              </div>

              <ProjectedTable rows={qual.groups[g]} decided={allPicked} ties={ties} />

              <div className="sc-r32">
                <div className="sc-r32-title">Projected Round of 32</div>
                <ul className="sc-r32-list">
                  <R32Line label="1st" dest={proj.first} confirmed={isConfirmed(proj.first)} />
                  <R32Line label="2nd" dest={proj.second} confirmed={isConfirmed(proj.second)} />
                  {proj.thirdQualifies ? (
                    <R32Line label="3rd" dest={proj.third} confirmed={isConfirmed(proj.third)} />
                  ) : (
                    proj.thirdTeam && (
                      <li className="sc-r32-row sc-r32-out">
                        <span className="sc-r32-pos">3rd</span>
                        <span className="sc-r32-team">{FLAG_BY_TEAM[proj.thirdTeam] || ''} {proj.thirdTeam}</span>
                        <span className="sc-r32-note">outside the best 8</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      <p className="sc-foot">
        The win/draw/win buttons set a one-goal result; use the − / + steppers to set an exact
        score so goal-difference tie-breakers resolve precisely. “Possible orders” counts the
        distinct final standings still reachable for a group given the results you’ve set.
        Third-place qualification and exact opponents depend on all groups together, so they update
        as you set more results. A <ScalesIcon /> marks a placing decided by a soft tie-breaker — fair-play
        points (cards) or FIFA ranking — once points, head-to-head, goal difference and goals are
        all level (hover it for the decider; card data is best-effort).
      </p>
    </div>
  )
}
