import { useMemo } from 'react'
import { BRACKET, matchesByNum, pathToFinal } from '../utils/bracket.js'
import { MATCHES, STAGE_LABELS } from '../data/matches.js'
import { FLAG_BY_TEAM } from '../data/teams.js'
import { decideMatch } from '../utils/bracketResolve.js'
import { activeTeams } from '../utils/tournamentStats.js'
import { formatTime, tzAbbrev, dayKey } from '../utils/time.js'
import { useFollow } from '../context/follow.jsx'
import { usePath } from '../context/path.jsx'
import { useDetail } from '../context/detail.js'
import PathPicker from './PathPicker.jsx'

// A circular ("radial") rendering of the knockout bracket: the 32 Round-of-32
// teams sit on the outer ring and each match's winner advances one ring inward,
// round by round, toward the trophy at the centre — so the flags progress along
// the spokes as results land. The third-place play-off sits just below the centre.

// Geometry (SVG user units; viewBox below). Centre at (CX, CY); the trophy lives
// there and the two finalists flank it on the horizontal "final" line.
const CX = 500
const CY = 500
const LEAF_R = 470 // outer ring: the 32 R32 teams
const RING = { R32: 382, R16: 292, QF: 200, SF: 110 } // winner of each round, inward
const SLOTS = 32

// Static feeder map: a knockout match's two source matches, parsed from the
// original "Winner/Loser Match N" labels (resolved matches no longer carry them).
const FEED = /^(?:Winner|Loser) Match (\d+)$/
const STATIC = Object.fromEntries(MATCHES.map((m) => [m.num, m]))
function childMatchNums(num) {
  const m = STATIC[num]
  /* v8 ignore next -- unreachable: every num reaching here comes from the bracket layout, which is built from the same committed schedule STATIC indexes */
  if (!m) return null
  const a = FEED.exec(m.t1)
  const b = FEED.exec(m.t2)
  /* v8 ignore next -- unreachable: only R16/QF/SF nums reach here, and both of their sides are always "Winner Match N" feeders. R32 (whose children are teams) is laid out from its leaf angles instead and never asks. */
  return a && b ? [Number(a[1]), Number(b[1])] : null
}

// Polar → cartesian. Angle in degrees, 90° = top, measured counter-clockwise;
// SVG y grows downward so we subtract the sine.
const toXY = (deg, r) => {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)]
}

// The 32 outer slots, clockwise from just right of top: the right half of the
// bracket top→bottom (each match's t1 then t2), then the left half bottom→top
// (t2 then t1) — so the two finalists meet on the horizontal centre line.
const LEAF_SLOTS = [
  ...BRACKET.right.R32.flatMap((n) => [{ n, side: 0 }, { n, side: 1 }]),
  ...[...BRACKET.left.R32].reverse().flatMap((n) => [{ n, side: 1 }, { n, side: 0 }]),
]
const slotAngle = (i) => 90 - (i + 0.5) * (360 / SLOTS)

// Angle of every match node: an R32 node is the midpoint of its two outer slots;
// each later node is the midpoint of the two it feeds from. (No node straddles
// the bottom seam — the halves only meet at the final, which sits at the centre —
// so plain averaging is safe.)
function buildAngles() {
  const angle = {}
  const leafAngleOf = {}
  LEAF_SLOTS.forEach((s, i) => {
    leafAngleOf[`${s.n}:${s.side}`] = slotAngle(i)
  })
  for (const n of [...BRACKET.left.R32, ...BRACKET.right.R32]) {
    angle[n] = (leafAngleOf[`${n}:0`] + leafAngleOf[`${n}:1`]) / 2
  }
  for (const round of ['R16', 'QF', 'SF']) {
    for (const n of [...BRACKET.left[round], ...BRACKET.right[round]]) {
      const [c1, c2] = childMatchNums(n)
      angle[n] = (angle[c1] + angle[c2]) / 2
    }
  }
  return { angle, leafAngleOf }
}

const ROUND_OF = {} // match num → its winner-ring radius
for (const r of ['R32', 'R16', 'QF', 'SF'])
  for (const n of [...BRACKET.left[r], ...BRACKET.right[r]]) ROUND_OF[n] = RING[r]

// Zone labels along the clear seam at the top of the circle (the two bracket
// halves only meet at the final, so no spokes or bars cross 90°). Radii are the
// midpoints of each round's connector zone — where its match numbers live, but
// none sits at the seam itself.
const ROUND_RING_LABELS = [
  // The R32 zone is the tightest: the top leaf pair's spokes sit only ~42 SVG
  // units either side of the seam at this radius, so its label stays small.
  { text: 'ROUND OF 32', r: (LEAF_R + RING.R32) / 2, size: 8.5 },
  { text: 'ROUND OF 16', r: (RING.R32 + RING.R16) / 2, size: 9.5 },
  { text: 'QUARTER-FINALS', r: (RING.R16 + RING.QF) / 2, size: 9 },
  { text: 'SEMI-FINALS', r: (RING.QF + RING.SF) / 2, size: 8.5 },
]

function FlagNode({ x, y, team, label, followed, onPath, trail, dimmed, onClick, r = 17 }) {
  const flag = team && FLAG_BY_TEAM[team]
  if (!flag) {
    // No team yet (undecided match / unresolved slot) → a small placeholder dot.
    return <circle className="rb-dot" cx={x} cy={y} r={4} />
  }
  return (
    <g
      className={`rb-node${followed ? ' followed' : ''}${onPath ? ' on-path' : ''}${trail ? ' on-trail' : ''}${dimmed ? ' out' : ''}${onClick ? ' rb-click' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      {/* Every call site supplies a label whenever it supplies a team, and a
          node with no team returned the placeholder dot above — so the fallback
          is unreachable. (A v8-ignore inside a JSX expression never reaches the
          compiled output, so it is removed rather than annotated.) */}
      <title>{label}</title>
      <circle className="rb-flag-bg" cx={x} cy={y} r={r} />
      <text className="rb-flag" x={x} y={y} fontSize={r * 1.3}>
        {flag}
      </text>
    </g>
  )
}

export default function RadialBracket({ matches, tz, hideScores }) {
  const { isFollowed } = useFollow()
  const { pathTeam } = usePath()
  const openDetail = useDetail()
  const byNum = useMemo(() => matchesByNum(matches), [matches])
  const { angle, leafAngleOf } = useMemo(buildAngles, [])
  // The selected team's route: highlight its connectors and flags, dim the rest.
  const path = useMemo(() => {
    const p = pathTeam ? pathToFinal(pathTeam, byNum) : null
    return p ? { ...p, activeSet: new Set(p.active) } : null
  }, [pathTeam, byNum])
  const hasPath = Boolean(path)
  const onPathTeam = (team) => hasPath && team === pathTeam

  // Compact score for a played/live match (penalties or a.e.t. noted), or null.
  const scoreText = (m) => {
    if (!m || !Array.isArray(m.score)) return null
    let s = `${m.score[0]}–${m.score[1]}`
    if (Array.isArray(m.pens)) s += ` p${m.pens[0]}–${m.pens[1]}`
    else if (m.aet) s += ' aet'
    return s
  }

  // One-line summary for a match's hover tooltip — the gist of the detail popout.
  const matchInfo = (m) => {
    const date = new Date(m.ko).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' })
    return `Match ${m.num} · ${STAGE_LABELS[m.stage]} · ${m.t1} vs ${m.t2} · ${date} ${formatTime(m.ko, tz)} ${tzAbbrev(m.ko, tz)}`
  }

  const teamAt = (n, side) => {
    const m = byNum[n]
    if (!m) return null
    return side === 0 ? m.t1 : m.t2
  }
  const winnerOf = (n) => (byNum[n] ? decideMatch(byNum[n])?.winner || null : null)

  // Position lookups.
  const leafPos = (s) => toXY(leafAngleOf[`${s.n}:${s.side}`], LEAF_R)
  const nodePos = (n) => toXY(angle[n], ROUND_OF[n])

  // Each matchup's connector is built as a clickable GROUP: two straight RADIAL
  // spokes (one per participant, inward to the parent ring) joined by a TANGENTIAL
  // bar that hugs the ring through the winner node — the orthogonal "⊐" join that
  // reads as a bracket. The bar is sampled as short straight segments so it stays a
  // polyline of lines and meets the node even where siblings are far apart. The
  // whole group (spokes + bar + the match-number label between the teams) opens the
  // match's detail popout — and shows it on hover.
  const barPoints = (a1, a2, r, n = 12) => {
    const pts = []
    for (let i = 0; i <= n; i++) {
      const [x, y] = toXY(a1 + ((a2 - a1) * i) / n, r)
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return pts.join(' ')
  }
  const matchups = [] // { num, radials:[[p,p]…], bar, label:[x,y] }
  const addBracket = (num, parentR, childR, a1, a2, labelR) => {
    matchups.push({
      num,
      radials: [
        [toXY(a1, childR), toXY(a1, parentR)],
        [toXY(a2, childR), toXY(a2, parentR)],
      ],
      bar: parentR > 0 ? barPoints(a1, a2, parentR) : null,
      label: toXY((a1 + a2) / 2, labelR),
    })
  }
  // R32 winners join their two outer teams.
  for (const n of [...BRACKET.left.R32, ...BRACKET.right.R32]) {
    addBracket(n, RING.R32, LEAF_R, leafAngleOf[`${n}:0`], leafAngleOf[`${n}:1`], (RING.R32 + LEAF_R) / 2)
  }
  // Each later round joins the two it feeds from, at that round's ring.
  const CHILD_RING = { R16: RING.R32, QF: RING.R16, SF: RING.QF }
  for (const round of ['R16', 'QF', 'SF']) {
    for (const n of [...BRACKET.left[round], ...BRACKET.right[round]]) {
      const [c1, c2] = childMatchNums(n)
      addBracket(n, RING[round], CHILD_RING[round], angle[c1], angle[c2], (RING[round] + CHILD_RING[round]) / 2)
    }
  }
  // The final: the two finalists run straight in to the centre. Its number is
  // pinned ABOVE the trophy — the finalists' average angle points straight down,
  // which would otherwise drop the label onto the third-place section below.
  const [SF_A, SF_B] = [BRACKET.left.SF[0], BRACKET.right.SF[0]]
  addBracket(BRACKET.final[0], 0, RING.SF, angle[SF_A], angle[SF_B], 80)
  matchups[matchups.length - 1].label = [CX, CY - 78]

  const champion = winnerOf(BRACKET.final[0])

  // Teams that still have football to play; while any remain, the flags of
  // knocked-out sides fade so who's alive reads at a glance. Once the Final is
  // done the set is empty and nothing dims (the finished bracket stays vivid).
  const active = useMemo(() => activeTeams(matches), [matches])
  const isDimmed = (team) => active.size > 0 && Boolean(team) && !active.has(team)

  // The champion's golden trail: once the Final is decided (and no manual path
  // is selected), light their whole route from the outer ring to the trophy.
  const trailSet = useMemo(() => {
    if (!champion || pathTeam) return null
    const p = pathToFinal(champion, byNum)
    return p ? new Set(p.active) : null
  }, [champion, pathTeam, byNum])
  const onTrailTeam = (team) => Boolean(trailSet) && team === champion

  // Spotlight matches playing TODAY (viewer's tz): a soft pulsing halo behind
  // the match number until the tie is final.
  const todayKey = dayKey(Date.now(), tz)
  const spotlit = (m) => m && dayKey(m.ko, tz) === todayKey && !(Array.isArray(m.score) && !m.live)

  // Third-place play-off, shown just below the trophy.
  const THIRD_NUM = BRACKET.third[0]
  const thirdA = byNum[SF_A] ? decideMatch(byNum[SF_A])?.loser : null
  const thirdB = byNum[SF_B] ? decideMatch(byNum[SF_B])?.loser : null
  const thirdWinner = winnerOf(THIRD_NUM)
  const THIRD_Y = 596

  return (
    <div className={`radial-wrap${hasPath ? ' has-path' : ''}`}>
      <PathPicker byNum={byNum} />
      <svg className="rb-svg" viewBox="0 0 1000 1080" role="img" aria-label="Knockout bracket, circular view">
        {/* Each matchup: the bracket join (spokes + bar) plus its match number,
            grouped into one clickable target that opens the detail popout. */}
        {/* Faint round labels down the top seam, beneath everything else. */}
        {ROUND_RING_LABELS.map(({ text, r, size }) => (
          <text key={text} className="rb-ring-label" x={CX} y={CY - r} fontSize={size}>
            {text}
          </text>
        ))}

        {matchups.map(({ num, radials, bar, label }) => {
          const m = byNum[num]
          const open = m ? () => openDetail(m) : undefined
          const onPath = path?.activeSet.has(num)
          const onTrail = trailSet?.has(num)
          return (
            <g
              key={`mu${num}`}
              className={`rb-matchup${open ? ' rb-click' : ''}${onPath ? ' on-path' : ''}${onTrail ? ' champ-trail' : ''}`}
              onClick={open}
              role={open ? 'button' : undefined}
              tabIndex={open ? 0 : undefined}
              onKeyDown={open ? (e) => (e.key === 'Enter' || e.key === ' ') && open() : undefined}
            >
              {m && <title>{matchInfo(m)}</title>}
              {radials.map(([[x1, y1], [x2, y2]], i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="rb-line" />
              ))}
              {bar && <polyline points={bar} className="rb-line" />}
              {bar && <polyline points={bar} className="rb-hit" />}
              {spotlit(m) && <circle className="rb-halo" cx={label[0]} cy={label[1]} r={17} />}
              {m?.live && <circle className="rb-live-dot" cx={label[0]} cy={label[1] - 11} r={3.4} />}
              <text className="rb-mnum" x={label[0]} y={label[1]} fontSize="11">
                M{num}
              </text>
              {m && !hideScores && scoreText(m) && (
                <text className="rb-score" x={label[0]} y={label[1] + 12} fontSize="9.5">
                  {scoreText(m)}
                </text>
              )}
              {/* Unplayed tie → kickoff time where the score will land. */}
              {m && !m.score && (
                <text className="rb-time" x={label[0]} y={label[1] + 12} fontSize="8.5">
                  {formatTime(m.ko, tz)}
                </text>
              )}
            </g>
          )
        })}

        {/* Centre: trophy (or a crowned champion). */}
        <text className={`rb-trophy${champion ? ' rb-trophy-won' : ''}`} x={CX} y={CY} fontSize="46">🏆</text>
        {champion && (
          <g className="rb-champ">
            <title>Champion: {champion}</title>
            <text className="rb-crown" x={CX} y={CY - 44} fontSize="22">👑</text>
            <text className="rb-champ-name" x={CX} y={CY + 44} fontSize="15">
              {FLAG_BY_TEAM[champion]} {champion} — Champions
            </text>
          </g>
        )}

        {/* Winner of each round, one ring inward (SF winners = the finalists). */}
        {['R32', 'R16', 'QF', 'SF'].flatMap((round) =>
          [...BRACKET.left[round], ...BRACKET.right[round]].map((n) => {
            const [x, y] = nodePos(n)
            const team = winnerOf(n)
            const isChamp = round === 'SF' && team && team === champion
            return (
              <FlagNode
                key={`w${n}`}
                x={x}
                y={y}
                team={team}
                followed={team ? isFollowed(team) || isChamp : false}
                onPath={onPathTeam(team)}
                trail={onTrailTeam(team)}
                dimmed={isDimmed(team)}
                label={team ? `${team} — ${STAGE_LABELS[byNum[n].stage]} winner (Match ${n})` : undefined}
                onClick={byNum[n] ? () => openDetail(byNum[n]) : undefined}
                r={round === 'SF' ? 19 : 16}
              />
            )
          }),
        )}

        {/* Outer ring: the 32 Round-of-32 teams. */}
        {LEAF_SLOTS.map((s, i) => {
          const [x, y] = leafPos(s)
          const team = teamAt(s.n, s.side)
          return (
            <FlagNode
              key={`l${i}`}
              x={x}
              y={y}
              team={team}
              followed={team ? isFollowed(team) : false}
              onPath={onPathTeam(team)}
              trail={onTrailTeam(team)}
              dimmed={isDimmed(team)}
              label={team || undefined}
              onClick={byNum[s.n] ? () => openDetail(byNum[s.n]) : undefined}
              r={18}
            />
          )
        })}

        {/* Third-place play-off, below the trophy. The label carries its match
            number and opens the detail popout (matching the matchup groups). */}
        <g
          className={byNum[THIRD_NUM] ? 'rb-matchup rb-click' : undefined}
          onClick={byNum[THIRD_NUM] ? () => openDetail(byNum[THIRD_NUM]) : undefined}
          role={byNum[THIRD_NUM] ? 'button' : undefined}
          tabIndex={byNum[THIRD_NUM] ? 0 : undefined}
          onKeyDown={byNum[THIRD_NUM] ? (e) => (e.key === 'Enter' || e.key === ' ') && openDetail(byNum[THIRD_NUM]) : undefined}
        >
          {byNum[THIRD_NUM] && <title>{matchInfo(byNum[THIRD_NUM])}</title>}
          <text className="rb-3rd-label" x={CX} y={THIRD_Y - 26} fontSize="15">
            Third place
          </text>
          {/* Match number sits below the matchup, smaller (mirrors the inner
              matchups, where the score tucks just under the number). */}
          <text className="rb-mnum" x={CX} y={THIRD_Y + 22} fontSize="9">
            M{THIRD_NUM}
          </text>
        </g>
        <FlagNode
          x={CX - 28}
          y={THIRD_Y}
          team={thirdA}
          followed={thirdA ? isFollowed(thirdA) || thirdA === thirdWinner : false}
          onPath={onPathTeam(thirdA)}
          dimmed={isDimmed(thirdA)}
          label={thirdA ? `${thirdA}${thirdA === thirdWinner ? ' — 3rd place' : ''}` : undefined}
          onClick={byNum[THIRD_NUM] ? () => openDetail(byNum[THIRD_NUM]) : undefined}
          r={16}
        />
        <text className="rb-3rd-vs" x={CX} y={THIRD_Y} fontSize="12">vs</text>
        <FlagNode
          x={CX + 28}
          y={THIRD_Y}
          team={thirdB}
          followed={thirdB ? isFollowed(thirdB) || thirdB === thirdWinner : false}
          onPath={onPathTeam(thirdB)}
          dimmed={isDimmed(thirdB)}
          label={thirdB ? `${thirdB}${thirdB === thirdWinner ? ' — 3rd place' : ''}` : undefined}
          onClick={byNum[THIRD_NUM] ? () => openDetail(byNum[THIRD_NUM]) : undefined}
          r={16}
        />
        {spotlit(byNum[THIRD_NUM]) && <circle className="rb-halo" cx={CX} cy={THIRD_Y + 22} r={14} />}
        {byNum[THIRD_NUM]?.live && <circle className="rb-live-dot" cx={CX} cy={THIRD_Y - 26} r={3.4} />}
        {!hideScores && scoreText(byNum[THIRD_NUM]) && (
          <text className="rb-score" x={CX} y={THIRD_Y + 34} fontSize="9.5">
            {scoreText(byNum[THIRD_NUM])}
          </text>
        )}
        {byNum[THIRD_NUM] && !byNum[THIRD_NUM].score && (
          <text className="rb-time" x={CX} y={THIRD_Y + 34} fontSize="8.5">
            {formatTime(byNum[THIRD_NUM].ko, tz)}
          </text>
        )}
      </svg>
      <p className="rb-hint">
        Outer ring = Round of 32. Each match’s winner advances one ring inward toward the trophy;
        flags fill in as results land, with the score under each played match (kickoff time until
        then), a blinking red dot on any match in play, and a soft glow on today’s matches.
        Eliminated teams fade while the tournament is on; once it’s decided, the champion’s route
        to the trophy lights up gold. Hover a flag for the country; click a matchup (its bracket
        join or match number) to open the match details.
      </p>
    </div>
  )
}
