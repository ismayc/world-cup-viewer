// All 104 matches of the 2026 FIFA World Cup.
//
// `ko` is the kickoff instant as an ISO 8601 string with an explicit -04:00
// offset (US Eastern Daylight Time, the timezone all official kickoff times
// are published in). Because the offset is explicit, `new Date(ko)` resolves
// to the correct absolute instant and can be formatted into ANY timezone —
// that is what powers the "in your timezone" display.
//
// For group matches, `t1`/`t2` are real team names. For knockout matches they
// are placeholder labels (e.g. "Winner Group A") until teams are determined.
// `stage` is one of: Group, R32, R16, QF, SF, 3rd, Final.

export const STAGE_LABELS = {
  Group: 'Group Stage',
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarterfinal',
  SF: 'Semifinal',
  '3rd': 'Third-place Match',
  Final: 'Final',
}

export const STAGE_ORDER = ['Group', 'R32', 'R16', 'QF', 'SF', '3rd', 'Final']

export const MATCHES = [
  // ===== GROUP STAGE =====
  // June 11
  { num: 1, stage: 'Group', group: 'A', t1: 'Mexico', t2: 'South Africa', venue: 'azteca', ko: '2026-06-11T15:00:00-04:00' },
  { num: 2, stage: 'Group', group: 'A', t1: 'South Korea', t2: 'Czechia', venue: 'akron', ko: '2026-06-11T22:00:00-04:00' },
  // June 12
  { num: 3, stage: 'Group', group: 'B', t1: 'Canada', t2: 'Bosnia & Herzegovina', venue: 'bmo', ko: '2026-06-12T15:00:00-04:00' },
  { num: 4, stage: 'Group', group: 'D', t1: 'USA', t2: 'Paraguay', venue: 'sofi', ko: '2026-06-12T21:00:00-04:00' },
  // June 13
  { num: 5, stage: 'Group', group: 'B', t1: 'Qatar', t2: 'Switzerland', venue: 'levis', ko: '2026-06-13T15:00:00-04:00' },
  { num: 6, stage: 'Group', group: 'C', t1: 'Brazil', t2: 'Morocco', venue: 'metlife', ko: '2026-06-13T18:00:00-04:00' },
  { num: 7, stage: 'Group', group: 'C', t1: 'Haiti', t2: 'Scotland', venue: 'gillette', ko: '2026-06-13T21:00:00-04:00' },
  // June 14
  { num: 8, stage: 'Group', group: 'D', t1: 'Australia', t2: 'Türkiye', venue: 'bcplace', ko: '2026-06-14T00:00:00-04:00' },
  { num: 9, stage: 'Group', group: 'E', t1: 'Germany', t2: 'Curaçao', venue: 'nrg', ko: '2026-06-14T13:00:00-04:00' },
  { num: 10, stage: 'Group', group: 'F', t1: 'Netherlands', t2: 'Japan', venue: 'att', ko: '2026-06-14T16:00:00-04:00' },
  { num: 11, stage: 'Group', group: 'E', t1: 'Ivory Coast', t2: 'Ecuador', venue: 'linc', ko: '2026-06-14T19:00:00-04:00' },
  { num: 12, stage: 'Group', group: 'F', t1: 'Sweden', t2: 'Tunisia', venue: 'bbva', ko: '2026-06-14T22:00:00-04:00' },
  // June 15
  { num: 13, stage: 'Group', group: 'H', t1: 'Spain', t2: 'Cape Verde', venue: 'mercedes', ko: '2026-06-15T12:00:00-04:00' },
  { num: 14, stage: 'Group', group: 'G', t1: 'Belgium', t2: 'Egypt', venue: 'lumen', ko: '2026-06-15T15:00:00-04:00' },
  { num: 15, stage: 'Group', group: 'H', t1: 'Saudi Arabia', t2: 'Uruguay', venue: 'hardrock', ko: '2026-06-15T18:00:00-04:00' },
  { num: 16, stage: 'Group', group: 'G', t1: 'Iran', t2: 'New Zealand', venue: 'sofi', ko: '2026-06-15T21:00:00-04:00' },
  // June 16
  { num: 17, stage: 'Group', group: 'I', t1: 'France', t2: 'Senegal', venue: 'metlife', ko: '2026-06-16T15:00:00-04:00' },
  { num: 18, stage: 'Group', group: 'I', t1: 'Iraq', t2: 'Norway', venue: 'gillette', ko: '2026-06-16T18:00:00-04:00' },
  { num: 19, stage: 'Group', group: 'J', t1: 'Argentina', t2: 'Algeria', venue: 'arrowhead', ko: '2026-06-16T21:00:00-04:00' },
  // June 17
  { num: 20, stage: 'Group', group: 'J', t1: 'Austria', t2: 'Jordan', venue: 'levis', ko: '2026-06-17T00:00:00-04:00' },
  { num: 21, stage: 'Group', group: 'K', t1: 'Portugal', t2: 'DR Congo', venue: 'nrg', ko: '2026-06-17T13:00:00-04:00' },
  { num: 22, stage: 'Group', group: 'L', t1: 'England', t2: 'Croatia', venue: 'att', ko: '2026-06-17T16:00:00-04:00' },
  { num: 23, stage: 'Group', group: 'L', t1: 'Ghana', t2: 'Panama', venue: 'bmo', ko: '2026-06-17T19:00:00-04:00' },
  { num: 24, stage: 'Group', group: 'K', t1: 'Uzbekistan', t2: 'Colombia', venue: 'azteca', ko: '2026-06-17T22:00:00-04:00' },
  // June 18
  { num: 25, stage: 'Group', group: 'A', t1: 'Czechia', t2: 'South Africa', venue: 'mercedes', ko: '2026-06-18T12:00:00-04:00' },
  { num: 26, stage: 'Group', group: 'B', t1: 'Switzerland', t2: 'Bosnia & Herzegovina', venue: 'sofi', ko: '2026-06-18T15:00:00-04:00' },
  { num: 27, stage: 'Group', group: 'B', t1: 'Canada', t2: 'Qatar', venue: 'bcplace', ko: '2026-06-18T18:00:00-04:00' },
  { num: 28, stage: 'Group', group: 'A', t1: 'Mexico', t2: 'South Korea', venue: 'akron', ko: '2026-06-18T21:00:00-04:00' },
  // June 19
  { num: 29, stage: 'Group', group: 'D', t1: 'USA', t2: 'Australia', venue: 'lumen', ko: '2026-06-19T15:00:00-04:00' },
  { num: 30, stage: 'Group', group: 'C', t1: 'Scotland', t2: 'Morocco', venue: 'gillette', ko: '2026-06-19T18:00:00-04:00' },
  { num: 31, stage: 'Group', group: 'C', t1: 'Brazil', t2: 'Haiti', venue: 'linc', ko: '2026-06-19T20:30:00-04:00' },
  // June 20
  { num: 32, stage: 'Group', group: 'D', t1: 'Türkiye', t2: 'Paraguay', venue: 'levis', ko: '2026-06-19T23:00:00-04:00' },
  { num: 33, stage: 'Group', group: 'F', t1: 'Netherlands', t2: 'Sweden', venue: 'nrg', ko: '2026-06-20T13:00:00-04:00' },
  { num: 34, stage: 'Group', group: 'E', t1: 'Germany', t2: 'Ivory Coast', venue: 'bmo', ko: '2026-06-20T16:00:00-04:00' },
  { num: 35, stage: 'Group', group: 'E', t1: 'Ecuador', t2: 'Curaçao', venue: 'arrowhead', ko: '2026-06-20T20:00:00-04:00' },
  // June 21
  { num: 36, stage: 'Group', group: 'F', t1: 'Tunisia', t2: 'Japan', venue: 'bbva', ko: '2026-06-21T00:00:00-04:00' },
  { num: 37, stage: 'Group', group: 'H', t1: 'Spain', t2: 'Saudi Arabia', venue: 'mercedes', ko: '2026-06-21T12:00:00-04:00' },
  { num: 38, stage: 'Group', group: 'G', t1: 'Belgium', t2: 'Iran', venue: 'sofi', ko: '2026-06-21T15:00:00-04:00' },
  { num: 39, stage: 'Group', group: 'H', t1: 'Uruguay', t2: 'Cape Verde', venue: 'hardrock', ko: '2026-06-21T18:00:00-04:00' },
  { num: 40, stage: 'Group', group: 'G', t1: 'New Zealand', t2: 'Egypt', venue: 'bcplace', ko: '2026-06-21T21:00:00-04:00' },
  // June 22
  { num: 41, stage: 'Group', group: 'J', t1: 'Argentina', t2: 'Austria', venue: 'att', ko: '2026-06-22T13:00:00-04:00' },
  { num: 42, stage: 'Group', group: 'I', t1: 'France', t2: 'Iraq', venue: 'linc', ko: '2026-06-22T17:00:00-04:00' },
  { num: 43, stage: 'Group', group: 'I', t1: 'Norway', t2: 'Senegal', venue: 'metlife', ko: '2026-06-22T20:00:00-04:00' },
  { num: 44, stage: 'Group', group: 'J', t1: 'Jordan', t2: 'Algeria', venue: 'levis', ko: '2026-06-22T23:00:00-04:00' },
  // June 23
  { num: 45, stage: 'Group', group: 'K', t1: 'Portugal', t2: 'Uzbekistan', venue: 'nrg', ko: '2026-06-23T13:00:00-04:00' },
  { num: 46, stage: 'Group', group: 'L', t1: 'England', t2: 'Ghana', venue: 'gillette', ko: '2026-06-23T16:00:00-04:00' },
  { num: 47, stage: 'Group', group: 'L', t1: 'Panama', t2: 'Croatia', venue: 'bmo', ko: '2026-06-23T19:00:00-04:00' },
  { num: 48, stage: 'Group', group: 'K', t1: 'Colombia', t2: 'DR Congo', venue: 'akron', ko: '2026-06-23T22:00:00-04:00' },
  // June 24
  { num: 49, stage: 'Group', group: 'B', t1: 'Switzerland', t2: 'Canada', venue: 'bcplace', ko: '2026-06-24T15:00:00-04:00' },
  { num: 50, stage: 'Group', group: 'B', t1: 'Bosnia & Herzegovina', t2: 'Qatar', venue: 'lumen', ko: '2026-06-24T15:00:00-04:00' },
  { num: 51, stage: 'Group', group: 'C', t1: 'Scotland', t2: 'Brazil', venue: 'hardrock', ko: '2026-06-24T18:00:00-04:00' },
  { num: 52, stage: 'Group', group: 'C', t1: 'Morocco', t2: 'Haiti', venue: 'mercedes', ko: '2026-06-24T18:00:00-04:00' },
  { num: 53, stage: 'Group', group: 'A', t1: 'Czechia', t2: 'Mexico', venue: 'azteca', ko: '2026-06-24T21:00:00-04:00' },
  { num: 54, stage: 'Group', group: 'A', t1: 'South Africa', t2: 'South Korea', venue: 'bbva', ko: '2026-06-24T21:00:00-04:00' },
  // June 25
  { num: 55, stage: 'Group', group: 'E', t1: 'Curaçao', t2: 'Ivory Coast', venue: 'linc', ko: '2026-06-25T16:00:00-04:00' },
  { num: 56, stage: 'Group', group: 'E', t1: 'Ecuador', t2: 'Germany', venue: 'metlife', ko: '2026-06-25T16:00:00-04:00' },
  { num: 57, stage: 'Group', group: 'F', t1: 'Japan', t2: 'Sweden', venue: 'att', ko: '2026-06-25T19:00:00-04:00' },
  { num: 58, stage: 'Group', group: 'F', t1: 'Tunisia', t2: 'Netherlands', venue: 'arrowhead', ko: '2026-06-25T19:00:00-04:00' },
  { num: 59, stage: 'Group', group: 'D', t1: 'Türkiye', t2: 'USA', venue: 'sofi', ko: '2026-06-25T22:00:00-04:00' },
  { num: 60, stage: 'Group', group: 'D', t1: 'Paraguay', t2: 'Australia', venue: 'levis', ko: '2026-06-25T22:00:00-04:00' },
  // June 26
  { num: 61, stage: 'Group', group: 'I', t1: 'Norway', t2: 'France', venue: 'gillette', ko: '2026-06-26T15:00:00-04:00' },
  { num: 62, stage: 'Group', group: 'I', t1: 'Senegal', t2: 'Iraq', venue: 'bmo', ko: '2026-06-26T15:00:00-04:00' },
  { num: 63, stage: 'Group', group: 'H', t1: 'Cape Verde', t2: 'Saudi Arabia', venue: 'nrg', ko: '2026-06-26T20:00:00-04:00' },
  { num: 64, stage: 'Group', group: 'H', t1: 'Uruguay', t2: 'Spain', venue: 'akron', ko: '2026-06-26T20:00:00-04:00' },
  { num: 65, stage: 'Group', group: 'G', t1: 'Egypt', t2: 'Iran', venue: 'lumen', ko: '2026-06-26T23:00:00-04:00' },
  { num: 66, stage: 'Group', group: 'G', t1: 'New Zealand', t2: 'Belgium', venue: 'bcplace', ko: '2026-06-26T23:00:00-04:00' },
  // June 27
  { num: 67, stage: 'Group', group: 'L', t1: 'Panama', t2: 'England', venue: 'metlife', ko: '2026-06-27T17:00:00-04:00' },
  { num: 68, stage: 'Group', group: 'L', t1: 'Croatia', t2: 'Ghana', venue: 'linc', ko: '2026-06-27T17:00:00-04:00' },
  { num: 69, stage: 'Group', group: 'K', t1: 'Colombia', t2: 'Portugal', venue: 'hardrock', ko: '2026-06-27T19:30:00-04:00' },
  { num: 70, stage: 'Group', group: 'K', t1: 'DR Congo', t2: 'Uzbekistan', venue: 'mercedes', ko: '2026-06-27T19:30:00-04:00' },
  { num: 71, stage: 'Group', group: 'J', t1: 'Algeria', t2: 'Austria', venue: 'arrowhead', ko: '2026-06-27T22:00:00-04:00' },
  { num: 72, stage: 'Group', group: 'J', t1: 'Jordan', t2: 'Argentina', venue: 'att', ko: '2026-06-27T22:00:00-04:00' },

  // ===== ROUND OF 32 =====
  { num: 73, stage: 'R32', t1: 'Runner-up Group A', t2: 'Runner-up Group B', venue: 'sofi', ko: '2026-06-28T15:00:00-04:00' },
  { num: 74, stage: 'R32', t1: 'Winner Group E', t2: '3rd A/B/C/D/F', venue: 'gillette', ko: '2026-06-29T16:30:00-04:00' },
  { num: 76, stage: 'R32', t1: 'Winner Group C', t2: 'Runner-up Group F', venue: 'nrg', ko: '2026-06-29T13:00:00-04:00' },
  { num: 75, stage: 'R32', t1: 'Winner Group F', t2: 'Runner-up Group C', venue: 'bbva', ko: '2026-06-29T21:00:00-04:00' },
  { num: 78, stage: 'R32', t1: 'Runner-up Group E', t2: 'Runner-up Group I', venue: 'att', ko: '2026-06-30T13:00:00-04:00' },
  { num: 77, stage: 'R32', t1: 'Winner Group I', t2: '3rd C/D/F/G/H', venue: 'metlife', ko: '2026-06-30T17:00:00-04:00' },
  { num: 79, stage: 'R32', t1: 'Winner Group A', t2: '3rd C/E/F/H/I', venue: 'azteca', ko: '2026-06-30T22:00:00-04:00', note: 'Delayed start due to weather' },
  { num: 80, stage: 'R32', t1: 'Winner Group L', t2: '3rd E/H/I/J/K', venue: 'mercedes', ko: '2026-07-01T12:00:00-04:00' },
  { num: 82, stage: 'R32', t1: 'Winner Group G', t2: '3rd A/E/H/I/J', venue: 'lumen', ko: '2026-07-01T16:00:00-04:00' },
  { num: 81, stage: 'R32', t1: 'Winner Group D', t2: '3rd B/E/F/I/J', venue: 'levis', ko: '2026-07-01T20:00:00-04:00' },
  { num: 84, stage: 'R32', t1: 'Winner Group H', t2: 'Runner-up Group J', venue: 'sofi', ko: '2026-07-02T15:00:00-04:00' },
  { num: 83, stage: 'R32', t1: 'Runner-up Group K', t2: 'Runner-up Group L', venue: 'bmo', ko: '2026-07-02T19:00:00-04:00' },
  { num: 85, stage: 'R32', t1: 'Winner Group B', t2: '3rd E/F/G/I/J', venue: 'bcplace', ko: '2026-07-02T23:00:00-04:00' },
  { num: 88, stage: 'R32', t1: 'Runner-up Group D', t2: 'Runner-up Group G', venue: 'att', ko: '2026-07-03T14:00:00-04:00' },
  { num: 86, stage: 'R32', t1: 'Winner Group J', t2: 'Runner-up Group H', venue: 'hardrock', ko: '2026-07-03T18:00:00-04:00' },
  { num: 87, stage: 'R32', t1: 'Winner Group K', t2: '3rd D/E/I/J/L', venue: 'arrowhead', ko: '2026-07-03T21:30:00-04:00' },

  // ===== ROUND OF 16 =====
  { num: 90, stage: 'R16', t1: 'Winner Match 73', t2: 'Winner Match 75', venue: 'nrg', ko: '2026-07-04T13:00:00-04:00' },
  { num: 89, stage: 'R16', t1: 'Winner Match 74', t2: 'Winner Match 77', venue: 'linc', ko: '2026-07-04T17:00:00-04:00' },
  { num: 91, stage: 'R16', t1: 'Winner Match 76', t2: 'Winner Match 78', venue: 'metlife', ko: '2026-07-05T16:00:00-04:00' },
  { num: 92, stage: 'R16', t1: 'Winner Match 79', t2: 'Winner Match 80', venue: 'azteca', ko: '2026-07-05T21:00:00-04:00', note: 'Start delayed 1 hour (weather)' },
  { num: 93, stage: 'R16', t1: 'Winner Match 83', t2: 'Winner Match 84', venue: 'att', ko: '2026-07-06T15:00:00-04:00' },
  { num: 94, stage: 'R16', t1: 'Winner Match 81', t2: 'Winner Match 82', venue: 'lumen', ko: '2026-07-06T20:00:00-04:00' },
  { num: 95, stage: 'R16', t1: 'Winner Match 86', t2: 'Winner Match 88', venue: 'mercedes', ko: '2026-07-07T12:00:00-04:00' },
  { num: 96, stage: 'R16', t1: 'Winner Match 85', t2: 'Winner Match 87', venue: 'bcplace', ko: '2026-07-07T16:00:00-04:00' },

  // ===== QUARTERFINALS =====
  { num: 97, stage: 'QF', t1: 'Winner Match 89', t2: 'Winner Match 90', venue: 'gillette', ko: '2026-07-09T16:00:00-04:00' },
  { num: 98, stage: 'QF', t1: 'Winner Match 93', t2: 'Winner Match 94', venue: 'sofi', ko: '2026-07-10T15:00:00-04:00' },
  { num: 99, stage: 'QF', t1: 'Winner Match 91', t2: 'Winner Match 92', venue: 'hardrock', ko: '2026-07-11T17:00:00-04:00' },
  { num: 100, stage: 'QF', t1: 'Winner Match 95', t2: 'Winner Match 96', venue: 'arrowhead', ko: '2026-07-11T21:00:00-04:00' },

  // ===== SEMIFINALS =====
  { num: 101, stage: 'SF', t1: 'Winner Match 97', t2: 'Winner Match 98', venue: 'att', ko: '2026-07-14T15:00:00-04:00' },
  { num: 102, stage: 'SF', t1: 'Winner Match 99', t2: 'Winner Match 100', venue: 'mercedes', ko: '2026-07-15T15:00:00-04:00' },

  // ===== THIRD-PLACE MATCH =====
  { num: 103, stage: '3rd', t1: 'Loser Match 101', t2: 'Loser Match 102', venue: 'hardrock', ko: '2026-07-18T17:00:00-04:00' },

  // ===== FINAL =====
  { num: 104, stage: 'Final', t1: 'Winner Match 101', t2: 'Winner Match 102', venue: 'metlife', ko: '2026-07-19T15:00:00-04:00' },
].sort((a, b) => new Date(a.ko) - new Date(b.ko) || a.num - b.num)
