import { useState } from 'react'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { computeQualification } from '../utils/qualification.js'
import { projectKnockout } from '../utils/asItStands.js'
import { remainingGroupMatches, applyScenarioPicks, unpickedCount } from '../utils/scenarios.js'

const PICKS = [
  { key: 'home', side: 't1' },
  { key: 'draw', side: null },
  { key: 'away', side: 't2' },
]

function FixturePicker({ match, pick, onPick }) {
  return (
    <div className="sc-fixture">
      <span className={`sc-fx-team${pick === 'home' ? ' sc-win' : ''}`}>
        {FLAG_BY_TEAM[match.t1] || '•'} {match.t1}
      </span>
      <div className="sc-fx-buttons" role="group" aria-label={`${match.t1} vs ${match.t2} result`}>
        <button
          type="button"
          className={`sc-pick${pick === 'home' ? ' active' : ''}`}
          onClick={() => onPick(match.num, 'home')}
          title={`${match.t1} win`}
        >
          W
        </button>
        <button
          type="button"
          className={`sc-pick${pick === 'draw' ? ' active' : ''}`}
          onClick={() => onPick(match.num, 'draw')}
          title="Draw"
        >
          D
        </button>
        <button
          type="button"
          className={`sc-pick${pick === 'away' ? ' active' : ''}`}
          onClick={() => onPick(match.num, 'away')}
          title={`${match.t2} win`}
        >
          W
        </button>
      </div>
      <span className={`sc-fx-team sc-fx-right${pick === 'away' ? ' sc-win' : ''}`}>
        {match.t2} {FLAG_BY_TEAM[match.t2] || '•'}
      </span>
    </div>
  )
}

function ProjectedTable({ rows, decided }) {
  return (
    <table className="sc-table">
      <thead>
        <tr>
          <th className="col-team">Projected {decided ? 'final' : 'order'}</th>
          <th>P</th><th>GD</th><th className="col-pts">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className={r.rank <= 2 ? 'qualifies' : ''}>
            <td className="col-team">
              <span className="rank">{r.rank}</span>
              <span className="team-flag">{r.flag}</span>
              <span className="row-team">{r.name}</span>
              {r.rank <= 2 && <span className="sc-tag sc-adv">advances</span>}
              {r.rank === 3 && <span className="sc-tag sc-third">3rd</span>}
            </td>
            <td>{r.P}</td>
            <td>{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
            <td className="col-pts">{r.Pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// "As it stands → R32" line for a projected qualifier.
function R32Line({ label, dest }) {
  if (!dest?.team) return null
  return (
    <li className="sc-r32-row">
      <span className="sc-r32-pos">{label}</span>
      <span className="sc-r32-team">{FLAG_BY_TEAM[dest.team] || ''} {dest.team}</span>
      <span className="sc-r32-vs">vs</span>
      <span className="sc-r32-opp">
        {dest.opponent ? `${FLAG_BY_TEAM[dest.opponent] || ''} ${dest.opponent}` : 'TBD'}
      </span>
      {dest.matchNum && <span className="sc-r32-num">M{dest.matchNum}</span>}
    </li>
  )
}

export default function ScenariosView({ matches }) {
  const [picks, setPicks] = useState({})

  const onPick = (num, val) =>
    setPicks((p) => (p[num] === val ? (({ [num]: _drop, ...rest }) => rest)(p) : { ...p, [num]: val }))
  const clear = () => setPicks({})

  const remaining = remainingGroupMatches(matches)
  const groupsInPlay = Object.keys(remaining).sort()
  const synthetic = applyScenarioPicks(matches, picks)
  const qual = computeQualification(synthetic)
  const { perGroup } = projectKnockout(synthetic)
  const leftToPick = unpickedCount(matches, picks)
  const pickedAny = Object.keys(picks).length > 0

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
          const allPicked = open.every((m) => picks[m.num])
          const proj = perGroup[g] || {}
          return (
            <div className="sc-card" key={g}>
              <h3 className="group-title">
                Group {g}
                <span className="sc-card-state">{allPicked ? 'all set' : `${open.filter((m) => !picks[m.num]).length} to pick`}</span>
              </h3>

              <div className="sc-fixtures">
                {open.map((m) => (
                  <FixturePicker key={m.num} match={m} pick={picks[m.num]} onPick={onPick} />
                ))}
              </div>

              <ProjectedTable rows={qual.groups[g]} decided={allPicked} />

              <div className="sc-r32">
                <div className="sc-r32-title">Projected Round of 32</div>
                <ul className="sc-r32-list">
                  <R32Line label="1st" dest={proj.first} />
                  <R32Line label="2nd" dest={proj.second} />
                  {proj.thirdQualifies ? (
                    <R32Line label="3rd" dest={proj.third} />
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
        Third-place qualification and exact opponents depend on all groups together, so they update
        as you set more results. Goal-difference tie-breakers assume a one-goal margin.
      </p>
    </div>
  )
}
