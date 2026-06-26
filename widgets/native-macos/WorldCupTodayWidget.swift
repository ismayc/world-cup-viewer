// WorldCupTodayWidget.swift — the WidgetKit widget. Replace the file Xcode
// generates in the Widget Extension target with this, and make sure
// WorldCupFeed.swift is a member of the widget-extension target too.
//
// Requires the widget-extension target to have App Sandbox →
// "Outgoing Connections (Client)" enabled, or the network fetch is blocked and
// the widget shows "No matches today".

import WidgetKit
import SwiftUI

struct WorldCupEntry: TimelineEntry {
    let date: Date
    let matches: [Match]
}

struct WorldCupProvider: TimelineProvider {
    func placeholder(in context: Context) -> WorldCupEntry {
        WorldCupEntry(date: Date(), matches: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (WorldCupEntry) -> Void) {
        Task {
            let matches = await WorldCupFeed.todaysMatches()
            completion(WorldCupEntry(date: Date(), matches: matches))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WorldCupEntry>) -> Void) {
        Task {
            let matches = await WorldCupFeed.todaysMatches()
            // One entry now, plus one at each upcoming kickoff today — so the
            // "LIVE" tag flips on at kickoff WITHOUT another network refresh.
            var entries = [WorldCupEntry(date: Date(), matches: matches)]
            for m in matches where m.start > Date() {
                entries.append(WorldCupEntry(date: m.start, matches: matches))
            }
            // Re-pull the feed again in ~30 min (also catches the next day rolling over).
            let refreshAt = Date().addingTimeInterval(30 * 60)
            completion(Timeline(entries: entries, policy: .after(refreshAt)))
        }
    }
}

struct WorldCupWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WorldCupEntry

    private static let timeFmt: DateFormatter = {
        let f = DateFormatter()
        f.timeZone = WorldCupFeed.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "h:mm a"
        return f
    }()

    private var maxRows: Int {
        switch family {
        case .systemMedium: return 3
        case .systemLarge: return 7
        default: return 12 // extraLarge
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("🏆 World Cup — Today")
                    .font(.caption).fontWeight(.heavy)
                    .foregroundStyle(.teal)
                Spacer()
                Text("MST").font(.caption2).foregroundStyle(.secondary)
            }

            if entry.matches.isEmpty {
                Spacer()
                Text("No matches today.").font(.callout).foregroundStyle(.secondary)
                Spacer()
            } else {
                ForEach(entry.matches.prefix(maxRows)) { match in
                    row(match)
                }
                if entry.matches.count > maxRows {
                    Text("+\(entry.matches.count - maxRows) more")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
        }
    }

    @ViewBuilder
    private func row(_ m: Match) -> some View {
        let live = entry.date >= m.start && entry.date.timeIntervalSince(m.start) < 135 * 60
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(Self.timeFmt.string(from: m.start))
                .font(.caption).fontWeight(.bold).monospacedDigit()
                .foregroundStyle(.yellow)
                .frame(width: 64, alignment: .leading)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Text(m.teams).font(.caption).fontWeight(.semibold).lineLimit(1)
                    if live {
                        Text("● LIVE").font(.caption2).fontWeight(.bold).foregroundStyle(.red)
                    }
                }
                Text([m.stage, m.venue].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
        }
    }
}

struct WorldCupTodayWidget: Widget {
    let kind = "WorldCupTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WorldCupProvider()) { entry in
            WorldCupWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget) // required on macOS 14+
        }
        .configurationDisplayName("World Cup — Today")
        .description("Today's 2026 World Cup matches in Arizona time (MST).")
        .supportedFamilies([.systemMedium, .systemLarge, .systemExtraLarge])
    }
}

@main
struct WorldCupWidgetBundle: WidgetBundle {
    var body: some Widget {
        WorldCupTodayWidget()
    }
}
