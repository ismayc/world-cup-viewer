// WorldCupFeed.swift — fetches the maintained calendar feed and parses TODAY's
// 2026 World Cup matches in Arizona time (MST). Shared by the widget (and usable
// by the host app). Add this file to BOTH the app and the widget-extension target.

import Foundation

struct Match: Identifiable {
    let id = UUID()
    let start: Date     // absolute instant (UTC under the hood)
    let teams: String   // e.g. "Mexico vs Brazil (2–1)"
    let stage: String   // e.g. "Group A" or "Round of 32"
    let venue: String
}

enum WorldCupFeed {
    static let feedURL = URL(string: "https://world-cup-viewer.netlify.app/calendar.ics")!
    // Arizona = fixed MST year-round (no daylight saving). For Mountain Time WITH
    // daylight saving, use "America/Denver" instead.
    static let timeZone = TimeZone(identifier: "America/Phoenix")!

    /// Today's matches (Arizona calendar day), sorted by kickoff.
    static func todaysMatches() async -> [Match] {
        guard
            let (data, _) = try? await URLSession.shared.data(from: feedURL),
            let text = String(data: data, encoding: .utf8)
        else { return [] }

        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let today = cal.startOfDay(for: Date())

        return parse(text)
            .filter { cal.startOfDay(for: $0.start) == today }
            .sorted { $0.start < $1.start }
    }

    static func parse(_ ics: String) -> [Match] {
        // Unfold RFC 5545 line continuations (a wrapped line starts with a space).
        let unfolded = ics
            .replacingOccurrences(of: "\r\n ", with: "")
            .replacingOccurrences(of: "\n ", with: "")

        let df = DateFormatter()
        df.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
        df.timeZone = TimeZone(identifier: "UTC")
        df.locale = Locale(identifier: "en_US_POSIX")

        func unescape(_ s: String) -> String {
            s.replacingOccurrences(of: "\\,", with: ",")
                .replacingOccurrences(of: "\\;", with: ";")
                .replacingOccurrences(of: "\\\\", with: "\\")
        }

        var out: [Match] = []
        let blocks = unfolded.components(separatedBy: "BEGIN:VEVENT").dropFirst()
        for raw in blocks {
            let body = raw.components(separatedBy: "END:VEVENT").first ?? raw
            func field(_ key: String) -> String {
                for line in body.split(whereSeparator: { $0 == "\n" || $0 == "\r" }) {
                    if line.hasPrefix(key + ":") {
                        return String(line.dropFirst(key.count + 1)).trimmingCharacters(in: .whitespaces)
                    }
                }
                return ""
            }
            guard let start = df.date(from: field("DTSTART")) else { continue }
            var teams = unescape(field("SUMMARY"))
            if teams.hasPrefix("World Cup: ") { teams.removeFirst("World Cup: ".count) }
            let stage = unescape(field("DESCRIPTION").components(separatedBy: "\\n").first ?? "")
            let venue = unescape(field("LOCATION"))
            out.append(Match(start: start, teams: teams, stage: stage, venue: venue))
        }
        return out
    }
}
