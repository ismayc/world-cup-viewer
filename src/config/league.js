// The single source of this edition's identity, vocabulary, and display rules.
//
// Everything a component or util would otherwise hardcode inline lives here: the ESPN
// paths, the storage prefix, the match length, the .ics identity, the deploy host, the
// locale. The pattern comes from the-nfl-schedule; this is the last of the ten repos in this
// rollout, done last because it is the least factored of the tournament viewers.
//
// Two rules this file is written to:
//
//   1. Every field below has a real consumer in src/. A field only a config reader
//      touches is a shallow module pretending to be a seam, and the NFL original grew
//      seven of them. The exceptions are marked: `title` and `themeColor` are consumed
//      by test/chrome-identity.test.js, because index.html and the manifest are static
//      files no module can import, and a test is the only thing that can hold them to
//      this file.
//
//   2. Structure stays out. ADVANCING_PER_GROUP, ADVANCING_THIRDS, GROUP_MATCH_COUNT,
//      the tie-break chain and the slot grammar stay in utils/qualification.js and
//      utils/clinch.js. Those are RULES: this edition ranks head-to-head BEFORE overall
//      goal difference, the inverse of the women's tournament, and that is a
//      different algorithm rather than a different constant. A config that tried to
//      hold it would be describing behavior, which is what stalled
//      sports-viewer-meta/adapters/.
//
//      This repo has the most structure still loose of any in the family: 'R32' is a
//      magic string in 15+ sites across 9 files and the slot-label grammar is 13 copies
//      of a regex across 7, because utils/slots.js was extracted in the SIBLINGS and
//      never back-ported here. That is real work and it belongs in its own change, not
//      smuggled into an identity move.
//
// The file is named `league.js` across the whole family, including here where "league"
// is not the right noun. The convention is worth more than the precision: a maintainer
// moving between repos finds the same file at the same path. This is an EDITION;
// `season` and the year inside the .ics identity say which one.

export const LEAGUE = {
  id: 'wc',
  // The competition, without the year. Used in .ics event summaries.
  name: 'World Cup',
  // The full product title: index.html's <title> and the manifest's name.
  title: 'World Cup 2026 — Schedule Viewer',
  // The edition, used as a calendar name.
  edition: 'World Cup 2026',
  season: 2026,
  // site.web.api /apis/site/v2/sports/<espnPath>/…
  espnPath: 'soccer/fifa.world',
  // sports.core.api spells it differently AND pins the season, because a finished
  // edition's stats live under that season and nowhere else.
  coreSeasonPath: 'soccer/leagues/fifa.world/seasons/2026',
  // The only storage prefix in the family carrying a year. Deliberate: the family
  // shares one localStorage origin, and a future edition of this same tournament
  // would otherwise inherit this one's followed teams and saved path.
  storageKey: 'wc2026', // 'wc2026:theme', 'wc2026:followed', 'wc2026:matchLines:<id>', …
  // UI chrome only. Matches --bg in index.css, <meta name="theme-color">, and the
  // manifest's theme_color and background_color.
  themeColor: '#15171b',

  // ── Vocabulary ──────────────────────────────────────────────────────────────
  homeAwaySep: 'vs',

  // ── Time ────────────────────────────────────────────────────────────────────
  locale: 'en-US',
  // 90 minutes plus half time, added time, and the walk-up: the block a calendar should
  // reserve and the window in which a kicked-off match with no feed still reads as live.
  // Knockout ties can run to extra time and penalties and will overrun it; that is the
  // right trade for a calendar entry.
  matchLengthMinutes: 135,

  // ── Calendar export ─────────────────────────────────────────────────────────
  // The UID prefix carries the year deliberately. This edition is finished and the
  // committed schedule will not change, so a subscriber who also holds the 2027 feed
  // must not have one overwrite the other.
  ics: {
    prodId: '-//World Cup 2026 Viewer//EN',
    domain: 'worldcupviewer',
    uidPrefix: 'wc2026-match-',
    filenameBase: 'wc2026',
  },

  // Netlify serves /calendar.ics; GitHub Pages cannot run the function.
  feedHost: 'https://world-cup-viewer.netlify.app',
}
