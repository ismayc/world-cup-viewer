import { FLAG_BY_TEAM } from '../data/teams.js'
import { useFollow } from '../context/follow.jsx'

// Renders an unresolved knockout slot as its potential matchup — the two candidate
// teams of the tie feeding it, joined by a slash ("🇲🇽 Mexico / 🇨🇦 Canada") — the
// same read the Bracket gives. `feeder` comes from `feederTeams()` in utils/bracket.
// Followed candidates are highlighted; used on the Schedule and Week cards.
export default function FeederPair({ feeder }) {
  const { isFollowed } = useFollow()
  const Cand = ({ name }) => (
    <span className={`feeder-cand${isFollowed(name) ? ' followed' : ''}`}>
      <span className="feeder-flag">{FLAG_BY_TEAM[name] || '•'}</span>
      <span className="feeder-name">{name}</span>
    </span>
  )
  return (
    <span className="feeder-pair" title={`${feeder.kind} of Match ${feeder.num}: ${feeder.a} or ${feeder.b}`}>
      <Cand name={feeder.a} />
      <span className="feeder-slash" aria-hidden="true">/</span>
      <Cand name={feeder.b} />
    </span>
  )
}
