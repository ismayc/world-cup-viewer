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
  // Belgium and Egypt both finish on 5 pts (W1 D2 L0 each); 1–1 head-to-head, so
  // decided by overall GD: Belgium +4 vs Egypt +2 → Belgium 1st. Iran 3rd (3 pts
  // from 3 draws). New Zealand last (1 pt, GD −6).
  G: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'Web search (Yahoo Sports, ESPN, CBS Sports)'],
    scores: { 14: [1, 1], 16: [2, 2], 38: [0, 0], 40: [1, 3], 65: [1, 1], 66: [1, 5] },
    order: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  },
  // Spain win with 7 pts (W2 D1). Cape Verde surprise runners-up on 3 pts (D3).
  // Uruguay and Saudi Arabia both on 2 pts; 1–1 H2H, so decided by overall GD:
  // Uruguay −1 > Saudi Arabia −4 → Uruguay 3rd.
  H: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'Web search (Al Jazeera, Sky Sports, Bolavip)'],
    scores: { 13: [0, 0], 15: [1, 1], 37: [4, 0], 39: [2, 2], 63: [0, 0], 64: [0, 1] },
    order: ['Spain', 'Cape Verde', 'Uruguay', 'Saudi Arabia'],
  },
  // France dominate with 9 pts (W3). Norway 2nd (6 pts). Senegal 3rd (3 pts,
  // carried by a 5–0 win over Iraq). Iraq winless on 0 pts.
  I: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'Web search (ESPN, FIFA.com, Yahoo Sports)'],
    scores: { 17: [3, 1], 18: [1, 4], 42: [3, 0], 43: [3, 2], 61: [1, 4], 62: [5, 0] },
    order: ['France', 'Norway', 'Senegal', 'Iraq'],
  },
  // Argentina win with 9 pts (W3). Austria and Algeria both on 4 pts; 3–3 H2H
  // draw, so decided by overall GD: Austria 0 vs Algeria −2 → Austria 2nd. Jordan
  // winless on 0 pts.
  J: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'Web search (ESPN, Yahoo Sports, FOX Sports)'],
    scores: { 19: [3, 0], 20: [3, 1], 41: [2, 0], 44: [1, 2], 71: [3, 3], 72: [1, 3] },
    order: ['Argentina', 'Austria', 'Algeria', 'Jordan'],
  },
  // Colombia top the group with 7 pts (W2 D1). Portugal 2nd (5 pts). DR Congo 3rd
  // (4 pts, qualifying as one of the 8 best third-placed teams). Uzbekistan last
  // on 0 pts.
  K: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'Web search (ESPN, FIFA.com, CBS Sports)'],
    scores: { 21: [1, 1], 24: [1, 3], 45: [5, 0], 48: [1, 0], 69: [0, 0], 70: [3, 1] },
    order: ['Colombia', 'Portugal', 'DR Congo', 'Uzbekistan'],
  },
  // England win with 7 pts (W2 D1). Croatia 2nd (6 pts, W2 L1). Ghana 3rd (4 pts,
  // qualifying as one of the 8 best third-placed teams). Panama last on 0 pts.
  L: {
    verifiedOn: '2026-06-28',
    sources: ['OpenFootball', 'Web search (NBC Sports, Yahoo Sports, Bolavip)'],
    scores: { 22: [4, 2], 23: [1, 0], 46: [0, 0], 47: [0, 1], 67: [0, 2], 68: [2, 1] },
    order: ['England', 'Croatia', 'Ghana', 'Panama'],
  },
}

// The official Round-of-32 draw, as published by FIFA once the group stage ends:
// match number -> [home, away] (teams.js spelling). This is the cross-group check
// the per-group `order` can't make — which eight thirds advance and which tie each
// lands in (FIFA Annexe C). FILL THIS IN once all twelve groups are locked above;
// the test then asserts our resolved bracket equals it. Left empty until then.
//   e.g. 73: ['Canada', 'Mexico'],
export const OFFICIAL_R32 = {
  // June 28
  73: ['South Africa', 'Canada'],
  // June 29
  74: ['Germany', 'Paraguay'],
  76: ['Brazil', 'Japan'],
  75: ['Netherlands', 'Morocco'],
  // June 30
  78: ['Ivory Coast', 'Norway'],
  77: ['France', 'Sweden'],
  79: ['Mexico', 'Ecuador'],
  // July 1
  80: ['England', 'DR Congo'],
  82: ['Belgium', 'Senegal'],
  81: ['USA', 'Bosnia & Herzegovina'],
  // July 2
  84: ['Spain', 'Austria'],
  83: ['Portugal', 'Croatia'],
  85: ['Switzerland', 'Algeria'],
  // July 3
  88: ['Australia', 'Egypt'],
  86: ['Argentina', 'Cape Verde'],
  87: ['Colombia', 'Ghana'],
}
