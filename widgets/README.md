# Desktop widgets

## World Cup Today (Übersicht)

A macOS desktop widget that lists **today's** 2026 World Cup matches with
**Mountain-time** kickoffs, read live from this project's calendar feed (so it
shows resolved knockout teams and final scores as they land).

![what it shows: a translucent card titled "World Cup — Today" listing each match's kickoff time, teams, stage and venue]

### Install

1. Install [Übersicht](https://tracesof.net/uebersicht/) (free) and launch it.
2. Click the Übersicht menu-bar icon → **Open Widgets Folder**.
3. Copy the `world-cup-today.widget` folder (the one next to this README) into
   that folder.
4. Übersicht picks it up automatically (or menu → **Refresh All Widgets**).

Drag the widget anywhere on the desktop; position is also set in the CSS at the
bottom of `index.jsx` (`top` / `right`).

### Notes

- **Time zone.** It uses `America/Denver` (Mountain Time), so kickoffs show as
  **MDT** during the tournament (June–July is daylight-saving season — "MST"
  proper is the winter abbreviation). For **fixed MST year-round** (Arizona, no
  DST), change `const TZ = 'America/Denver'` to `'America/Phoenix'` near the top
  of `index.jsx`. The header label updates automatically.
- **Data source.** It `curl`s `https://world-cup-viewer.netlify.app/calendar.ics`
  every 10 minutes — the same maintained feed the site's calendar subscription
  uses. No API key, nothing to configure.
- **Today** is the Mountain calendar day, so a late kickoff that falls on the
  next UTC day is still listed under the correct local date.
- Games in progress get a small `● LIVE` tag (best-effort, based on kickoff +
  ~2¼ hours).

### Want a native widget instead?

A true Notification-Center/desktop WidgetKit widget is also possible, but it
needs a small SwiftUI app built and signed in Xcode on your Mac (it can't be
dropped in like this one). Happy to provide that project if you'd prefer it —
the same feed drives it.
