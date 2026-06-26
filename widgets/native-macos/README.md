# Native macOS widget (SwiftUI / WidgetKit)

A real Notification-Center / desktop widget — the kind you add from the system
widget gallery — showing today's 2026 World Cup matches in **Arizona MST**, from
the same `calendar.ics` feed as everything else.

WidgetKit widgets can't be a drop-in folder: they live inside an app you build
once in Xcode. It's ~10 minutes. Requires **macOS 14+** and **Xcode 15+** (a free
Apple ID works — see the signing note at the end).

## Files here
- `HostApp.swift` — the minimal container app.
- `WorldCupTodayWidget.swift` — the widget (timeline + SwiftUI views).
- `WorldCupFeed.swift` — fetches + parses the feed (shared).

## Steps

1. **New project.** Xcode → File → New → Project → **macOS** → **App** → Next.
   - Product Name: `WorldCupWidget` · Interface: **SwiftUI** · Language: **Swift**.
   - After it opens: select the project → the app target → **General** → set
     **Minimum Deployments → macOS 14.0**.

2. **Paste the app code.** Open the generated `…App.swift` (and `ContentView.swift`)
   and replace their contents with **`HostApp.swift`** from this folder. (If Xcode
   made both a `…App.swift` and a `ContentView.swift`, put the `@main struct` in
   the App file and the `ContentView` in the other — or just delete `ContentView.swift`
   and keep everything in the App file.)

3. **Add the widget target.** File → New → **Target…** → **macOS** → **Widget
   Extension** → Next.
   - Product Name: `WorldCupTodayWidget`.
   - **Uncheck** "Include Live Activity" and "Include Configuration App Intent".
   - Finish → **Activate** the scheme if prompted.

4. **Paste the widget code.** In the new `WorldCupTodayWidget` group, open the
   generated `WorldCupTodayWidget.swift` and replace its contents with
   **`WorldCupTodayWidget.swift`** from this folder. Delete any extra generated
   files in that group (e.g. a sample `…Bundle.swift`) so there's only one `@main`.

5. **Add the feed file to the widget.** Drag **`WorldCupFeed.swift`** into the
   project. In the add dialog (or the file's **Target Membership** in the right
   inspector) check **both** `WorldCupTodayWidget` **and** `WorldCupWidget`.

6. **Allow the network (important!).** Select the **`WorldCupTodayWidget`** target
   → **Signing & Capabilities**. Under **App Sandbox**, check **Outgoing
   Connections (Client)**. (If App Sandbox isn't listed, click **+ Capability** →
   App Sandbox first.) Do the same for the **app** target. *Without this the fetch
   is blocked and the widget just says "No matches today."*

7. **Signing.** For each target → Signing & Capabilities → check **Automatically
   manage signing** and pick your **Team** (your Apple ID under Xcode → Settings →
   Accounts works).

8. **Run it once.** Select the **WorldCupWidget** app scheme → **⌘R**. The app
   window appears (you can close it). The widget is now registered.

9. **Add the widget.** Right-click the **desktop** → **Edit Widgets** (or click the
   date/time in the menu bar → **Edit Widgets**), search **“World Cup”**, and drag
   **World Cup — Today** out. Medium / Large / Extra-Large sizes are supported.

## Notes
- **Time zone:** Arizona MST. To use Mountain Time with daylight saving, change
  `TimeZone(identifier: "America/Phoenix")` to `"America/Denver"` in
  `WorldCupFeed.swift`.
- **Refresh:** WidgetKit re-pulls the feed roughly every 30 minutes (and flips the
  `● LIVE` tag on at each kickoff without a network call). The OS budgets widget
  refreshes, so it's intentionally modest.
- **Free Apple ID signing** lets the app/widget run on *your* Mac, but the
  signature expires after **7 days** — just re-run from Xcode (⌘R) to renew. A paid
  Apple Developer account ($99/yr) removes the expiry.
