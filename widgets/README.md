# Desktop widgets

Two ways to put **today's** 2026 World Cup matches on your Mac, both showing
kickoffs in **Arizona MST** and both driven by the same maintained calendar feed
(`https://world-cup-viewer.netlify.app/calendar.ics`), so they show resolved
knockout teams and final scores as they land.

| | [Übersicht](#1-übersicht-drop-in) | [Native WidgetKit](#2-native-widgetkit) |
|---|---|---|
| **Folder** | `world-cup-today.widget/` | `native-macos/` |
| **Setup** | Drop a folder in, done | Build once in Xcode (~10 min) |
| **Needs** | The free [Übersicht](https://tracesof.net/uebersicht/) app | Xcode 15+, macOS 14+ |
| **Lives** | On the desktop wallpaper | System widget gallery (desktop / Notification Center) |
| **Looks** | Custom card (full CSS control) | Native macOS widget styling |

Pick whichever you prefer — they read the same data.

---

## 1. Übersicht (drop-in)

`world-cup-today.widget/index.jsx` — a desktop card listing today's matches.

### Install
1. Install [Übersicht](https://tracesof.net/uebersicht/) (free) and launch it
   (it's a menu-bar app — no window opens).
2. Übersicht menu-bar icon → **Open Widgets Folder** (or set a custom folder in
   **Preferences**).
3. Copy the `world-cup-today.widget` folder into it.
4. Übersicht picks it up automatically (or menu → **Refresh all widgets**).

### Position & options
- **Move it:** Übersicht widgets can't be dragged — set the `POSITION = { … }`
  constant near the top of `index.jsx`, save, then **Refresh all widgets**.
- **One screen only:** choose the display from the Übersicht menu-bar menu.
- **Time zone:** `America/Phoenix` (Arizona, fixed MST). For Mountain Time *with*
  daylight saving (reads MDT in summer), change `const TZ` to `'America/Denver'`.
- Refreshes every 10 min; in-progress games get a `● LIVE` tag.

---

## 2. Native WidgetKit

`native-macos/` — a real SwiftUI widget you add from the system widget gallery
(right-click desktop → **Edit Widgets**), in Medium / Large / Extra-Large sizes.

It can't be dropped in like the Übersicht one — WidgetKit widgets ship inside an
app you build once in Xcode. Full numbered walkthrough and the Swift sources are
in **[`native-macos/README.md`](native-macos/README.md)**.

- **Time zone:** Arizona MST (swap to `America/Denver` in `WorldCupFeed.swift`).
- Heads-up: the widget target needs **App Sandbox → Outgoing Connections
  (Client)** or the network fetch is blocked; a free Apple ID signs it (renew with
  ⌘R every 7 days). Both are covered in that README.

---

Both are companion artifacts of the [World Cup 2026 viewer](../README.md) and use
its public calendar feed — no API key, nothing to configure.
