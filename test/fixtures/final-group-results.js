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
  // USA top the group (6 pts). Australia and Paraguay both finish on 4 with a 0–0
  // head-to-head, so 2nd is decided on overall goal difference: Australia 0 vs
  // Paraguay −2 → Australia 2nd, Paraguay 3rd. Türkiye 4th (3 pts).
  D: {
    verifiedOn: '2026-06-26',
    sources: ['OpenFootball', 'independent points/GD/head-to-head recomputation'],
    scores: { 4: [4, 1], 8: [2, 0], 29: [2, 0], 32: [0, 1], 59: [3, 2], 60: [0, 0] },
    order: ['USA', 'Australia', 'Paraguay', 'Türkiye'],
  },
  // Germany and Ivory Coast both finish on 6 points; Germany top the group on the
  // head-to-head (a 2–1 win). Ecuador 3rd (4 pts), Curaçao last (1 pt).
  E: {
    verifiedOn: '2026-06-26',
    sources: ['OpenFootball', 'independent points/GD/head-to-head recomputation'],
    scores: { 9: [7, 1], 11: [1, 0], 34: [2, 1], 35: [0, 0], 55: [0, 2], 56: [2, 1] },
    order: ['Germany', 'Ivory Coast', 'Ecuador', 'Curaçao'],
  },
  // Netherlands win the group (7 pts). Japan 2nd (5), Sweden 3rd (4), Tunisia
  // winless — no tie-breaker needed.
  F: {
    verifiedOn: '2026-06-26',
    sources: ['OpenFootball', 'independent points/GD/head-to-head recomputation'],
    scores: { 10: [2, 2], 12: [5, 1], 33: [5, 1], 36: [0, 4], 57: [1, 1], 58: [1, 3] },
    order: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  },
  // Belgium win the group; Egypt 2nd, Iran 3rd, New Zealand last.
  G: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'resolveBracket cross-check vs official R32 draw (check:bracket, 0 divergence)'],
    scores: { 14: [1, 1], 16: [2, 2], 38: [0, 0], 40: [1, 3], 65: [1, 1], 66: [1, 5] },
    order: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  },
  // Spain top the group; Cape Verde 2nd, Uruguay 3rd, Saudi Arabia last.
  H: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'resolveBracket cross-check vs official R32 draw (check:bracket, 0 divergence)'],
    scores: { 13: [0, 0], 15: [1, 1], 37: [4, 0], 39: [2, 2], 63: [0, 0], 64: [0, 1] },
    order: ['Spain', 'Cape Verde', 'Uruguay', 'Saudi Arabia'],
  },
  // France win the group; Norway 2nd, Senegal 3rd, Iraq last.
  I: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'resolveBracket cross-check vs official R32 draw (check:bracket, 0 divergence)'],
    scores: { 17: [3, 1], 18: [1, 4], 42: [3, 0], 43: [3, 2], 61: [1, 4], 62: [5, 0] },
    order: ['France', 'Norway', 'Senegal', 'Iraq'],
  },
  // Argentina win the group; Austria 2nd, Algeria 3rd, Jordan last.
  J: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'resolveBracket cross-check vs official R32 draw (check:bracket, 0 divergence)'],
    scores: { 19: [3, 0], 20: [3, 1], 41: [2, 0], 44: [1, 2], 71: [3, 3], 72: [1, 3] },
    order: ['Argentina', 'Austria', 'Algeria', 'Jordan'],
  },
  // Colombia win the group; Portugal 2nd, DR Congo 3rd, Uzbekistan last.
  K: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'resolveBracket cross-check vs official R32 draw (check:bracket, 0 divergence)'],
    scores: { 21: [1, 1], 24: [1, 3], 45: [5, 0], 48: [1, 0], 69: [0, 0], 70: [3, 1] },
    order: ['Colombia', 'Portugal', 'DR Congo', 'Uzbekistan'],
  },
  // England win the group; Croatia 2nd, Ghana 3rd, Panama last.
  L: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'resolveBracket cross-check vs official R32 draw (check:bracket, 0 divergence)'],
    scores: { 22: [4, 2], 23: [1, 0], 46: [0, 0], 47: [0, 1], 67: [0, 2], 68: [2, 1] },
    order: ['England', 'Croatia', 'Ghana', 'Panama'],
  },
}

// The official Round-of-32 draw, as published by FIFA once the group stage ends:
// match number -> [home, away] (teams.js spelling). This is the cross-group check
// the per-group `order` can't make — which eight thirds advance and which tie each
// lands in (FIFA Annexe C). The test asserts our resolved bracket equals it.
// Source: OpenFootball worldcup.json, cross-checked by check:bracket (0 divergence).
export const OFFICIAL_R32 = {
  73: ['South Africa', 'Canada'],
  74: ['Germany', 'Paraguay'],
  75: ['Netherlands', 'Morocco'],
  76: ['Brazil', 'Japan'],
  77: ['France', 'Sweden'],
  78: ['Ivory Coast', 'Norway'],
  79: ['Mexico', 'Ecuador'],
  80: ['England', 'DR Congo'],
  81: ['USA', 'Bosnia & Herzegovina'],
  82: ['Belgium', 'Senegal'],
  83: ['Portugal', 'Croatia'],
  84: ['Spain', 'Austria'],
  85: ['Switzerland', 'Algeria'],
  86: ['Argentina', 'Cape Verde'],
  87: ['Colombia', 'Ghana'],
  88: ['Australia', 'Egypt'],
}
