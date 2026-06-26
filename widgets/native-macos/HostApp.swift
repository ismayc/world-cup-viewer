// HostApp.swift — the tiny container app. A WidgetKit widget must ship inside an
// app; this app does nothing but exist (and tell you how to add the widget).
// Replace the App + ContentView Xcode generates with this (or just paste
// ContentView's body into the generated one).

import SwiftUI

@main
struct WorldCupHostApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowResizability(.contentSize)
    }
}

struct ContentView: View {
    var body: some View {
        VStack(spacing: 14) {
            Text("🏆 World Cup Widget")
                .font(.title2).fontWeight(.bold)
            Text("This app just hosts the widget. To add it:")
                .foregroundStyle(.secondary)
            Text("Right-click the desktop → **Edit Widgets** (or click the clock in the menu bar → Edit Widgets), then find **“World Cup — Today.”**")
                .multilineTextAlignment(.center)
                .font(.callout)
                .frame(maxWidth: 380)
            Text("Times shown in Arizona MST.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding(28)
        .frame(width: 440, height: 240)
    }
}
