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
  // Mexico sweep all three games (9 pts). South Africa edge South Korea on
  // points alone (4 vs 3); no tie-breaker needed. Czechia last with 1 pt.
  A: {
    verifiedOn: '2026-06-25',
    sources: ['OpenFootball', 'Web search (Yahoo Sports, CBS Sports, Bolavip)'],
    scores: { 1: [2, 0], 2: [2, 1], 25: [1, 1], 28: [1, 0], 53: [0, 3], 54: [1, 0] },
    order: ['Mexico', 'South Africa', 'South Korea', 'Czechia'],
  },
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
  // USA wins 6 pts. Australia (4 pts GD 0) edge Paraguay (4 pts GD −2) on
  // overall goal difference after their head-to-head ended 0–0. Türkiye 4th (3 pts).
  D: {
    verifiedOn: '2026-06-26',
    sources: ['OpenFootball', 'Web search (Wikipedia, Yahoo Sports, US Soccer)'],
    scores: { 4: [4, 1], 8: [2, 0], 29: [2, 0], 32: [0, 1], 59: [3, 2], 60: [0, 0] },
    order: ['USA', 'Australia', 'Paraguay', 'Türkiye'],
  },
  // Germany and Ivory Coast both finish on 6 pts; Germany wins the group via
  // head-to-head (2–1 in matchday 2). Ecuador 3rd on 4 pts. Curaçao last (1 pt).
  E: {
    verifiedOn: '2026-06-26',
    sources: ['OpenFootball', 'Web search (Wikipedia, Fox Sports, Bolavip)'],
    scores: { 9: [7, 1], 11: [1, 0], 34: [2, 1], 35: [0, 0], 55: [0, 2], 56: [2, 1] },
    order: ['Germany', 'Ivory Coast', 'Ecuador', 'Curaçao'],
  },
  // Netherlands dominant with 7 pts (W2 D1). Japan 2nd on 5 pts. Sweden 3rd
  // on 4 pts (GD 0), advancing as one of the eight best third-placed teams.
  // Tunisia last with 0 pts (3 losses).
  F: {
    verifiedOn: '2026-06-26',
    sources: ['OpenFootball', 'Web search (Wikipedia, NBC Sports, Yahoo Sports)'],
    scores: { 10: [2, 2], 12: [5, 1], 33: [5, 1], 36: [0, 4], 57: [1, 1], 58: [1, 3] },
    order: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  },
}

// The official Round-of-32 draw, as published by FIFA once the group stage ends:
// match number -> [home, away] (teams.js spelling). This is the cross-group check
// the per-group `order` can't make — which eight thirds advance and which tie each
// lands in (FIFA Annexe C). FILL THIS IN once all twelve groups are locked above;
// the test then asserts our resolved bracket equals it. Left empty until then.
//   e.g. 73: ['Canada', 'Mexico'],
export const OFFICIAL_R32 = {}
