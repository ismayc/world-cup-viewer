// Web Worker: runs the full R32 outcome enumeration off the main thread so the
// page stays responsive while millions of combinations are walked. Posts
// progress updates and a final result.

import { enumerateOutlook } from '../utils/outlookEnum.js'
import { survivingTeams, allAdvancementRequirements } from '../utils/eliminationCheck.js'

self.onmessage = (e) => {
  const matches = e.data
  try {
    const result = enumerateOutlook(matches, (done, total) => {
      self.postMessage({ type: 'progress', done, total })
    })
    // Exact "still alive" set — separate from the one-goal enumeration, so a
    // bubble team whose survival needs goal-difference swings (and thus shows 0%
    // above) is still reported rather than silently vanishing.
    const survivors = survivingTeams(matches)
    // For each survivor, the goal-difference conditions it needs to advance — the
    // "needs N of these" checklist shown under the still-alive (beyond-cap) net.
    const requirements = allAdvancementRequirements(matches, survivors)
    self.postMessage({ type: 'done', result, survivors, requirements })
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err?.message || err) })
  }
}
