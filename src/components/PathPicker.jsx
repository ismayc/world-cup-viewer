import { FLAG_BY_TEAM } from '../data/teams.js'
import { STAGE_LABELS } from '../data/matches.js'
import { knockoutTeams, pathToFinal } from '../utils/bracket.js'
import { useFollow } from '../context/follow.jsx'
import { usePath } from '../context/path.jsx'

// A short human summary of where the selected team stands on its route.
function summarize(path, byNum) {
  if (path.exitNum != null) {
    return { text: `Out — lost in the ${STAGE_LABELS[byNum[path.exitNum].stage]}`, cls: 'out' }
  }
  const lastHere = path.here[path.here.length - 1]
  const m = byNum[lastHere]
  const settled = Array.isArray(m.score) && !m.live && !m.voided
  if (lastHere === 104) {
    return settled ? { text: '🏆 Champions!', cls: 'champ' } : { text: 'In the Final', cls: 'alive' }
  }
  if (m.live) return { text: `Playing now — ${STAGE_LABELS[m.stage]}`, cls: 'alive' }
  if (settled) {
    const next = byNum[path.nums[path.nums.indexOf(lastHere) + 1]]
    return { text: `Through to the ${STAGE_LABELS[next.stage]}`, cls: 'alive' }
  }
  return { text: `Up next — ${STAGE_LABELS[m.stage]}`, cls: 'alive' }
}

// Selector for the "Path to the Final" highlight: a dropdown of every team that
// has reached the Round of 32, plus quick chips for followed teams, and a live
// status line for the current pick. Shared by the Bracket and Radial views.
export default function PathPicker({ byNum }) {
  const { pathTeam, setPathTeam } = usePath()
  const { followed } = useFollow()
  const teams = knockoutTeams(byNum)
  if (!teams.length) return null // no knockout teams resolved yet

  const followedKO = teams.filter((t) => followed.has(t))
  const path = pathTeam ? pathToFinal(pathTeam, byNum) : null
  const status = path ? summarize(path, byNum) : null

  return (
    <div className="path-picker">
      <div className="path-picker-row">
        <label className="path-label" htmlFor="path-team">🧭 Path to the Final</label>
        <select
          id="path-team"
          className="path-select"
          value={pathTeam || ''}
          onChange={(e) => setPathTeam(e.target.value || null)}
        >
          <option value="">Pick a team…</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {FLAG_BY_TEAM[t]} {t}
            </option>
          ))}
        </select>
        {pathTeam && (
          <button type="button" className="path-clear" onClick={() => setPathTeam(null)}>
            ✕ Clear
          </button>
        )}
        {status && (
          <span className={`path-status path-status-${status.cls}`}>
            {FLAG_BY_TEAM[pathTeam]} {pathTeam} · {status.text}
          </span>
        )}
      </div>
      {followedKO.length > 0 && (
        <div className="path-chips">
          <span className="path-chips-label">⭐</span>
          {followedKO.map((t) => (
            <button
              key={t}
              type="button"
              className={`path-chip${pathTeam === t ? ' active' : ''}`}
              onClick={() => setPathTeam(pathTeam === t ? null : t)}
            >
              {FLAG_BY_TEAM[t]} {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
