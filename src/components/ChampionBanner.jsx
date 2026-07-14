import { FLAG_BY_TEAM } from '../data/teams.js'
import { decideMatch } from '../utils/bracketResolve.js'
import { useDetail } from '../context/detail.js'

// Celebration strip shown under the header once the Final is FINAL (a live
// score is provisional — decideMatch already enforces that). Hidden in
// spoiler-free mode: the champion is the biggest spoiler of all. The confetti
// is pure CSS and respects prefers-reduced-motion.

const CONFETTI = Array.from({ length: 18 }, (_, i) => i)

export default function ChampionBanner({ match, hideScores }) {
  const openDetail = useDetail()
  const champion = match ? decideMatch(match)?.winner : null
  if (!champion || !FLAG_BY_TEAM[champion] || hideScores) return null
  return (
    <button className="champ-banner" onClick={() => openDetail(match)} title="Open the Final">
      {CONFETTI.map((i) => (
        <span key={i} className="confetti" style={{ '--i': i }} aria-hidden="true" />
      ))}
      <span className="champ-text">
        👑 {FLAG_BY_TEAM[champion]} <strong>{champion}</strong> are the 2026 World Champions! 🏆
      </span>
    </button>
  )
}
