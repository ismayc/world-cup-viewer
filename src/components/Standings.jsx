import { useState } from 'react'
import { TEAMS } from '../data/teams.js'
import { computeQualification, rowStatus } from '../utils/qualification.js'
import { clinchBadge } from '../utils/clinch.js'
import { projectKnockout } from '../utils/asItStands.js'
import { lockedOpponent } from '../utils/opponentClinch.js'
import { softTiebreaks, softThirdTiebreaks, TIEBREAK_LABEL } from '../utils/tiebreakNotes.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { FIFA_RANK } from '../data/fifaRanking.js'
import { useFollow } from '../context/follow.jsx'
import GroupGamesModal from './GroupGamesModal.jsx'
import ScalesIcon from './ScalesIcon.jsx'

const GROUPS = Object.keys(TEAMS)

const STATUS_BADGE = {
  in: { cls: 'q-in', label: '✓', title: 'Advances to the Round of 32\n(if current match status holds)' },
  best3: { cls: 'q-best3', label: 'Provisional 3rd', title: 'Provisionally among the 8 best third-placed teams — NOT clinched; depends on the other groups still to finish' },
  out3: { cls: 'q-out', label: '·', title: 'Third place, outside the best 8 so far' },
  out: { cls: 'q-out', label: '✕', title: 'Eliminated' },
}

function Star({ name }) {
  const { isFollowed, toggle } = useFollow()
  const on = isFollowed(name)
  return (
    <button className={`star${on ? ' on' : ''}`} onClick={() => toggle(name)} aria-pressed={on}
      aria-label={on ? `Unfollow ${name}` : `Follow ${name}`}
      title={on ? `Unfollow ${name}` : `Follow ${name}`}>
      {on ? '★' : '☆'}
    </button>
  )
}

// "As it stands" projection of where this group's current placings would land in
// the Round of 32. A provisional snapshot — opponents shift as other groups play.
function AsItStands({ proj, onGoToMatch }) {
  if (!proj) return null
  const dest = (label, d, qualifies = true) => {
    /* v8 ignore next -- unreachable here: both call sites below pass two arguments, so `qualifies` is always the default */
    if (!qualifies) return null
    const team = d?.team
    const opp = d?.opponent
    /* v8 ignore next -- unreachable in this edition: every group has both a winner and a runner-up entry slot, so projectKnockout fills both destinations before this renders */
    if (!team) return null
    return (
      <li className="ais-row" key={label}>
        <span className="ais-pos">{label}</span>
        {/* Both names come out of the group tables, so they are committed members
            of this edition and always have a flag. The opponent is the one that
            can be missing: a knockout tie whose other side is not a group slot
            leaves it unprojected. */}
        <span className="ais-team">{FLAG_BY_TEAM[team]} {team}</span>
        <span className="ais-vs">vs</span>
        <span className="ais-opp">
          {opp ? `${FLAG_BY_TEAM[opp]} ${opp}` : 'TBD'}
        </span>
        {d?.matchNum &&
          (onGoToMatch ? (
            <button
              type="button"
              className="ais-match ais-match-link"
              onClick={() => onGoToMatch(d.matchNum)}
              title={`Show Match ${d.matchNum} on the Bracket`}
            >
              M{d.matchNum}
            </button>
          ) : (
            <span className="ais-match">M{d.matchNum}</span>
          ))}
      </li>
    )
  }
  return (
    <div className="as-it-stands">
      <div className="ais-title">As it stands → Round of 32</div>
      <ul className="ais-list">
        {dest('1st', proj.first)}
        {dest('2nd', proj.second)}
        {proj.thirdQualifies
          ? dest('3rd', proj.third)
          : proj.thirdTeam && (
              <li className="ais-row ais-out" key="3rd-out">
                <span className="ais-pos">3rd</span>
                {/* thirdTeam is the third row of a ranked group table, which
                    rankGroup seeds from the committed group — so it is always a
                    member of this edition and always has a flag. */}
                <span className="ais-team">{FLAG_BY_TEAM[proj.thirdTeam]} {proj.thirdTeam}</span>
                <span className="ais-note">outside the best 8</span>
              </li>
            )}
      </ul>
    </div>
  )
}

// ⚖️ shown when a placing was decided by a soft tie-breaker (cards / FIFA rank).
function TieMark({ tie }) {
  if (!tie) return null
  return (
    <span
      className="tiebreak-mark"
      title={`Level with ${tie.vs} on points, goal difference and goals — separated by ${TIEBREAK_LABEL[tie.reason]}${tie.reason === 'conduct' ? ' (best-effort card data)' : ''}`}
      aria-label={`Separated from ${tie.vs} by ${TIEBREAK_LABEL[tie.reason]}`}
    >
      <ScalesIcon />
    </span>
  )
}

function GroupTable({ group, rows, qual, clinch, asItStands, onGoToMatch, onSelectTeam, ties, liveTeams, pausedTeams }) {
  const { isFollowed } = useFollow()
  const played = qual.completion[group] || rows.some((r) => r.P > 0)
  const groupLive = rows.some((r) => liveTeams.has(r.name))
  const pauseRow = rows.find((r) => pausedTeams.has(r.name))
  const pauseLabel = pauseRow ? pausedTeams.get(pauseRow.name) : null
  return (
    <div className="group-card">
      <h3 className="group-title">
        <button
          type="button"
          className="group-title-btn"
          onClick={() => onSelectTeam(group, null)}
          title={`Show all Group ${group} fixtures & results`}
        >
          Group {group}
        </button>
        {groupLive &&
          (pauseLabel ? (
            <span className="group-delayed" title={`A match in this group is ${pauseLabel.toLowerCase()} — standings are provisional`}>
              ⏸ {pauseLabel.toUpperCase()}
            </span>
          ) : (
            <span className="group-live" title="A match in this group is in progress — standings are provisional">
              ● LIVE
            </span>
          ))}
      </h3>
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-team">Team</th>
            <th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th className="col-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // A guaranteed clinch/elimination verdict (if any) is more informative
            // than the post-completion qualification badge, so it wins when present.
            const clinched = clinchBadge(clinch?.[r.name])
            const status = rowStatus(r, group, qual)
            const badge = status && STATUS_BADGE[status]
            // Row tint mirrors the badge scale: green = advancing (top two or a
            // clinched best-third), yellow = provisional best-third (on the
            // bubble), red = mathematically eliminated. Plain = still undecided.
            const c = clinch?.[r.name]
            const advancing =
              status === 'in' || c === 'won-group' || c === 'runner-up' || c === 'top2' || c === 'third'
            const rowCls = c === 'eliminated' ? 'eliminated' : advancing ? 'qualifies' : status === 'best3' ? 'provisional' : ''
            return (
              <tr key={r.name} className={rowCls}>
                <td className="col-team">
                  <span className="rank">{r.rank}</span>
                  <Star name={r.name} />
                  <span className="team-flag">{r.flag}</span>
                  <button
                    type="button"
                    className={`row-team row-team-btn${isFollowed(r.name) ? ' followed' : ''}`}
                    onClick={() => onSelectTeam(group, r.name)}
                    title={`Show Group ${group} fixtures & results`}
                  >
                    {r.name}
                  </button>
                  <TieMark tie={ties?.get(r.name)} />
                  {liveTeams.has(r.name) && (
                    <span
                      className={`row-live-dot${pausedTeams.has(r.name) ? ' delayed' : ''}`}
                      title={pausedTeams.has(r.name) ? `${pausedTeams.get(r.name)} — score is provisional` : 'Playing now — score is provisional'}
                    >
                      ●
                    </span>
                  )}
                  {clinched ? (
                    // Wide text verdicts drop to their own line below the name
                    // (q-wide) so they don't wrap raggedly beside it in the
                    // narrow 3-across layout. Single-glyph marks stay inline.
                    <span className={`q-badge q-wide ${clinched.cls}`} title={clinched.title}>
                      {clinched.label} {clinched.text}
                    </span>
                  ) : (
                    badge && (
                      <span
                        className={`q-badge ${badge.cls}${status === 'best3' ? ' q-wide' : ''}`}
                        title={badge.title}
                      >
                        {badge.label}
                      </span>
                    )
                  )}
                </td>
                <td>{r.P}</td><td>{r.W}</td><td>{r.D}</td><td>{r.L}</td>
                <td>{r.GF}</td><td>{r.GA}</td>
                <td>{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                <td className="col-pts">{r.Pts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!played && <p className="group-note">No matches played yet</p>}
      {played && <AsItStands proj={asItStands} onGoToMatch={onGoToMatch} />}
    </div>
  )
}

// A small marker showing whether a third-placed line is settled ('final' — every
// group game played), still in progress ('live' — a group match is on right now,
// so the score and thus the position are provisional), or not yet decided
// ('toplay' — games still to come).
function ThirdStatus({ state }) {
  if (state === 'live')
    return (
      <span className="third-status third-live" title="A group match is in play now — this position can still change">
        in play
      </span>
    )
  if (state === 'final')
    return (
      <span className="third-status third-final" title="All group games played — this third-place line is final">
        final
      </span>
    )
  return (
    <span className="third-status third-toplay" title="Group games still to come — this position is provisional and can still change">
      to play
    </span>
  )
}

// The blinking red dot used on rows whose score is live (mirrors the group
// tables), going gold for a delayed/suspended match.
function LiveDot({ name, liveTeams, pausedTeams }) {
  if (!liveTeams.has(name)) return null
  const paused = pausedTeams.get(name)
  return (
    <span
      className={`row-live-dot${paused ? ' delayed' : ''}`}
      title={paused ? `${paused} — score is provisional` : 'Playing now — score is provisional'}
    >
      ●
    </span>
  )
}

// Spells out, below the table, every adjacent pair of third-placed teams that
// finished level on points, goal difference AND goals scored — so the order came
// down to a tie-breaker whose value isn't in the table (fair-play conduct, then
// FIFA ranking). Shows both teams' deciding values so e.g. "Ghana above Ecuador"
// is explained rather than just marked with a ⚖️. Driven entirely off the ranked
// `thirds`, so it reflects whatever the live data produces.
function ThirdTieNotes({ thirds }) {
  const gd = (v) => (v > 0 ? `+${v}` : `${v}`)
  const pairs = []
  for (let k = 0; k + 1 < thirds.length; k++) {
    const a = thirds[k]
    const b = thirds[k + 1]
    if (a.Pts === b.Pts && a.GD === b.GD && a.GF === b.GF) pairs.push([a, b])
  }
  if (!pairs.length) return null
  return (
    <div className="thirds-tie-note">
      <h4 className="thirds-tie-head"><ScalesIcon /> Tie-breakers among the thirds</h4>
      <ul>
        {pairs.map(([a, b]) => {
          // conduct decides before FIFA ranking; they're only separated by FIFA if
          // their (best-effort) conduct scores are equal.
          const byConduct = a.conduct !== b.conduct
          return (
            <li key={a.name}>
              <strong>
                {a.flag} {a.name}
              </strong>{' '}
              finished above{' '}
              <strong>
                {b.flag} {b.name}
              </strong>{' '}
              despite both being level on points ({a.Pts}), goal difference ({gd(a.GD)}) and goals
              scored ({a.GF}). The tie was broken by{' '}
              {byConduct ? (
                <>
                  <strong>fair-play points</strong> (disciplinary cards): {a.name} {a.conduct} vs{' '}
                  {b.name} {b.conduct}{' '}
                  <span className="thirds-tie-fine">
                    — closer to 0 is cleaner (−1 per yellow, −4 per red; best-effort card data)
                  </span>
                </>
              ) : (
                <>
                  {/* Every one of the 48 qualified teams carries a FIFA ranking,
                      and these two names are rows of ranked group tables, so
                      there is always a number to print. (A v8-ignore inside a
                      JSX expression never reaches the compiled output, so the
                      dead placeholder is removed rather than annotated.) */}
                  <strong>FIFA ranking</strong>: {a.name} #{FIFA_RANK[a.name]} vs {b.name} #
                  {FIFA_RANK[b.name]}{' '}
                  <span className="thirds-tie-fine">— a lower number ranks higher</span>
                </>
              )}
              .
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function BestThirds({ qual, clinch, groupState, liveTeams, pausedTeams }) {
  const anyPlayed = qual.thirds.some((t) => t.P > 0)
  if (!anyPlayed) return null
  const ties = softThirdTiebreaks(qual.thirds)

  // Teams not currently 3rd but still able to climb into a third-place spot: the
  // current 4th-placed team of any group not yet finished, as long as it's not
  // yet mathematically eliminated. The static 12-row table shows only the
  // CURRENT thirds, so a side sitting 4th with a live shot (Uzbekistan-type)
  // would otherwise be invisible here.
  const shown = new Set(qual.thirds.map((t) => t.name))
  const contenders = []
  for (const g of GROUPS) {
    if (groupState[g] === 'final') continue // group done → its third is settled
    /* v8 ignore next -- unreachable: computeQualification ranks every group of the committed table, so `qual.groups[g]` is always an array */
    const rows = qual.groups[g] || []
    if (!rows.some((r) => r.P > 0)) continue // group hasn't kicked off → not meaningful yet
    const fourth = rows[3]
    if (fourth && !shown.has(fourth.name) && clinch?.[fourth.name] !== 'eliminated') {
      contenders.push(fourth)
    }
  }

  const gd = (v) => (v > 0 ? `+${v}` : v)
  const allFinal = GROUPS.every((g) => groupState[g] === 'final')

  return (
    <div className="thirds-card">
      <h3 className="group-title">Best third-placed teams</h3>
      <p className="thirds-note">
        The 8 best of the 12 third-placed teams advance (ranked by points, then goal difference,
        then goals scored, then fair play, then FIFA ranking).{' '}
        {allFinal ? (
          ''
        ) : (
          <>
            Provisional — group stage still in progress. “final” = all group games played; “in play”
            = a match is live now; “to play” = games still to come.
          </>
        )}
      </p>
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-team">Team</th><th>Grp</th>
            <th>P</th><th>GD</th><th>GF</th><th className="col-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {qual.thirds.map((r, i) => {
            // Match the group-table scale, per team. A clinched best-third is
            // green; a mathematically eliminated team is red. Otherwise the cut
            // is still provisional: top 8 are on the bubble (yellow), the rest
            // merely outside it for now (plain, not red). Once every group is
            // done, clinch resolves every third to 'third' or 'eliminated', so
            // this naturally lands on green for the 8 and red for the other 4.
            const c = clinch?.[r.name]
            const rowCls = c === 'third' ? 'qualifies' : c === 'eliminated' ? 'eliminated' : i < 8 ? 'provisional' : ''
            return (
            <tr key={r.name} className={rowCls}>
              <td className="col-team">
                <span className="rank">{i + 1}</span>
                <span className="team-flag">{r.flag}</span>
                <span className="row-team">{r.name}</span>
                <ThirdStatus state={groupState[r.group]} />
                <LiveDot name={r.name} liveTeams={liveTeams} pausedTeams={pausedTeams} />
                <TieMark tie={ties.get(r.name)} />
              </td>
              <td>{r.group}</td>
              <td>{r.P}</td>
              <td>{gd(r.GD)}</td>
              <td>{r.GF}</td>
              <td className="col-pts">{r.Pts}</td>
            </tr>
            )
          })}
          {contenders.length > 0 && (
            <>
              <tr className="thirds-divider">
                <td colSpan={6}>Still in contention — currently 4th but can still climb into 3rd</td>
              </tr>
              {contenders.map((r) => (
                <tr key={r.name} className="contender">
                  <td className="col-team">
                    <span className="rank rank-dash" aria-hidden="true">–</span>
                    <span className="team-flag">{r.flag}</span>
                    <span className="row-team">{r.name}</span>
                    <ThirdStatus state={groupState[r.group]} />
                    <LiveDot name={r.name} liveTeams={liveTeams} pausedTeams={pausedTeams} />
                  </td>
                  <td>{r.group}</td>
                  <td>{r.P}</td>
                  <td>{gd(r.GD)}</td>
                  <td>{r.GF}</td>
                  <td className="col-pts">{r.Pts}</td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
      <ThirdTieNotes thirds={qual.thirds} />
    </div>
  )
}

export default function Standings({ matches, tz, hideScores, clinch, onGoToMatch }) {
  const [revealed, setRevealed] = useState(false)
  // The group whose fixtures pop-up is open (set by clicking a team name).
  const [groupGames, setGroupGames] = useState(null)
  const onSelectTeam = (group, team) => setGroupGames({ group, team })
  // "As it stands" R32 projection is shown by default; this toggle (persisted)
  // hides it for those who just want the tables.
  const [showProjection, setShowProjection] = useState(() => {
    try {
      return localStorage.getItem('wc2026:asItStands') !== '0'
    } catch {
      return true
    }
  })
  const toggleProjection = () =>
    setShowProjection((v) => {
      const next = !v
      try {
        localStorage.setItem('wc2026:asItStands', next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })

  if (hideScores && !revealed) {
    return (
      <div className="standings-hidden">
        <p>🙈 Standings are hidden in spoiler-free mode.</p>
        <button className="reveal-btn" onClick={() => setRevealed(true)}>Reveal standings</button>
      </div>
    )
  }

  const qual = computeQualification(matches)
  const { perGroup } = projectKnockout(matches)

  // For a team that has CLINCHED a Round-of-32 place, its projected knockout
  // matchup (opponent + match number), pulled from the same projection that
  // powers "As it stands". null unless the team is mathematically through —
  // we only promise a knockout opponent once a team has actually made it.
  const teamKnockout = (group, team) => {
    if (!team) return null
    const status = clinch?.[team]
    const through =
      status === 'won-group' || status === 'runner-up' || status === 'top2' || status === 'third'
    if (!through) return null
    /* v8 ignore next -- unreachable: computeQualification ranks every group of the committed table, so `qual.groups[group]` is always an array */
    const row = (qual.groups[group] || []).find((r) => r.name === team)
    /* v8 ignore next -- unreachable: the group/team pair comes from a rendered standings row, so the team is always among that group's computed rows */
    if (!row) return null
    /* v8 ignore next -- unreachable: projectKnockout seeds an entry for every group, so `perGroup[group]` is always there */
    const proj = perGroup[group] || {}
    // A 'won-group'/'runner-up' verdict pins the exact finishing position, so use
    // it directly; otherwise (top2 not yet split, or a best third) fall back to
    // the current standings position for the provisional projection.
    const dest =
      status === 'won-group'
        ? proj.first
        : status === 'runner-up'
          ? proj.second
          : row.rank === 1
            ? proj.first
            : row.rank === 2
              ? proj.second
              : row.rank === 3
                ? proj.third
                : null
    // A mathematically locked opponent (invariant across every remaining outcome)
    // is authoritative; otherwise fall back to the provisional "as it stands"
    // projection. `settled` drives whether the pop-up drops the provisional note.
    const locked = lockedOpponent(matches, team, clinch)
    return {
      status,
      opponent: locked?.opponent || dest?.opponent || null,
      matchNum: locked?.matchNum || dest?.matchNum || null,
      settled: Boolean(locked),
    }
  }

  // Teams currently playing a group match — the standings + "As it stands" below
  // reflect their in-progress score, so we blink them to show it's provisional.
  const liveTeams = new Set()
  const pausedTeams = new Map() // team -> 'Delayed' | 'Suspended'
  for (const m of matches) {
    if (m.stage === 'Group' && m.live) {
      liveTeams.add(m.t1)
      liveTeams.add(m.t2)
      if (m.live.delayed) {
        const lbl = m.live.label || 'Delayed'
        pausedTeams.set(m.t1, lbl)
        pausedTeams.set(m.t2, lbl)
      }
    }
  }

  // Per-group play state for the best-thirds markers: 'live' (a match is on now,
  // so positions are provisional — NOT final, even though a live score makes the
  // group look "complete"), 'final' (all six games truly final), else 'toplay'.
  const GROUP_MATCH_COUNT = 6 // 4 teams => 6 matches per group
  const groupState = {}
  for (const g of GROUPS) {
    const gm = matches.filter((m) => m.stage === 'Group' && m.group === g)
    if (gm.some((m) => m.live)) groupState[g] = 'live'
    else if (gm.filter((m) => m.score && !m.live && !m.voided).length >= GROUP_MATCH_COUNT)
      groupState[g] = 'final'
    else groupState[g] = 'toplay'
  }

  return (
    <>
      <p className="standings-tip">
        💡 Tip: click a <strong>team name</strong> to see that team’s three group
        matches — played and upcoming — or a <strong>group title</strong> for the
        whole group’s schedule.
      </p>
      <p className="standings-legend">
        <span className="legend-swatch" /> Top two advance ·{' '}
        <span className="q-badge q-best3">Provisional 3rd</span> best-third spot, not yet clinched ·{' '}
        <span
          className="legend-tb"
          tabIndex={0}
          role="note"
          aria-label="Tie-breakers: points, then head-to-head, then goal difference, then goals, then fair play (cards), then FIFA ranking"
          data-tip="Tie-breakers: points → head-to-head → goal difference → goals → fair play (cards) → FIFA ranking"
        >
          tie-breakers
        </span>{' '}
        · <span className="q-badge c-won">🥇 Won group</span> /{' '}
        <span className="q-badge c-silver">🥈 Group runner-up</span> /{' '}
        <span className="q-badge c-in">✅ Through</span> /{' '}
        <span className="q-badge c-out">❌ Out</span> mark mathematically clinched outcomes.
      </p>
      <div className="standings-toolbar">
        <button
          className="ais-toggle"
          onClick={toggleProjection}
          aria-pressed={showProjection}
          title="Show or hide the projected Round-of-32 matchups under each group"
        >
          {showProjection ? '▾ Hide “As it stands”' : '▸ Show “As it stands”'}
        </button>
      </div>
      <div className="standings-grid">
        {GROUPS.map((g) => (
          <GroupTable
            key={g}
            group={g}
            rows={qual.groups[g]}
            qual={qual}
            clinch={clinch}
            asItStands={showProjection ? perGroup[g] : null}
            onGoToMatch={onGoToMatch}
            onSelectTeam={onSelectTeam}
            ties={softTiebreaks(g, matches)}
            liveTeams={liveTeams}
            pausedTeams={pausedTeams}
          />
        ))}
      </div>
      <BestThirds
        qual={qual}
        clinch={clinch}
        groupState={groupState}
        liveTeams={liveTeams}
        pausedTeams={pausedTeams}
      />
      {groupGames && (
        <GroupGamesModal
          group={groupGames.group}
          team={groupGames.team}
          matches={matches}
          tz={tz}
          hideScores={hideScores}
          knockout={teamKnockout(groupGames.group, groupGames.team)}
          onClose={() => setGroupGames(null)}
        />
      )}
    </>
  )
}
