// Web Worker: runs the full R32 outcome enumeration off the main thread so the
// page stays responsive while millions of combinations are walked. Posts
// progress updates and a final result.

import { enumerateOutlook } from '../utils/outlookEnum.js'

self.onmessage = (e) => {
  const matches = e.data
  try {
    const result = enumerateOutlook(matches, (done, total) => {
      self.postMessage({ type: 'progress', done, total })
    })
    self.postMessage({ type: 'done', result })
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err?.message || err) })
  }
}
