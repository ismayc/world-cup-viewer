// Official FINAL group results, verified against multiple independent sources and
// frozen so the standings / tie-breaker engine can't silently drift from the
// real outcome as the group stage completes — a parallel to official-kickoffs.js
// for results instead of kickoff times.
//
// Workflow: add each group here ONCE its six matches are FINAL and cross-checked
// against ≥2 sources (FIFA is the authority; OpenFootball + ESPN corroborate).
// The companion test (test/final-standings.test.js) replays these scores through
// rankGroup and asserts the finishing order matches `order` exactly — so any
// tie-breaker regression is caught against the real tournament.
//
//   scores: { <matchNum>: [t1Goals, t2Goals], … }   final (90-min/ET) result,
//                                                    oriented to the fixture's t1/t2
//   order:  official finishing order 1st → 4th, by team name (teams.js spelling)
//
// 2026 tie-breakers in effect: points → head-to-head → goal difference → goals →
// fair play (cards) → FIFA ranking.

export const FINAL_GROUP_RESULTS = {
  // Switzerland win the group. Canada and Bosnia both finish on 4 points with a
  // 1–1 head-to-head, so 2nd is decided on overall goal difference: Canada +5
  // (the 6–0 win over Qatar) vs Bosnia −1 → Canada 2nd, Bosnia 3rd.
  B: {
    verifiedOn: '2026-06-24',
    sources: ['OpenFootball', 'ESPN'],
    scores: { 3: [1, 1], 5: [1, 1], 26: [4, 1], 27: [6, 0], 49: [2, 1], 50: [3, 1] },
    order: ['Switzerland', 'Canada', 'Bosnia & Herzegovina', 'Qatar'],
  },
  // Brazil and Morocco both finish on 7 points (W2 D1); Brazil wins the group
  // on goal difference (+6 vs +3). Scotland 3rd on 3 pts (GD −3). Haiti winless.
  C: {
    verifiedOn: '2026-06-25',
    sources: ['OpenFootball', 'ESPN'],
    scores: { 6: [1, 1], 7: [0, 1], 30: [0, 1], 31: [3, 0], 51: [0, 3], 52: [4, 2] },
    order: ['Brazil', 'Morocco', 'Scotland', 'Haiti'],
  },
}

// The official Round-of-32 draw, as published by FIFA once the group stage ends:
// match number -> [home, away] (teams.js spelling). This is the cross-group check
// the per-group `order` can't make — which eight thirds advance and which tie each
// lands in (FIFA Annexe C). FILL THIS IN once all twelve groups are locked above;
// the test then asserts our resolved bracket equals it. Left empty until then.
//   e.g. 73: ['Canada', 'Mexico'],
export const OFFICIAL_R32 = {}
