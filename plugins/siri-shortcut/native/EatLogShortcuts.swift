import AppIntents

/// Registers the phrases that make LogFoodIntent discoverable to Siri and
/// the Shortcuts app without the user first recording a Shortcut by hand.
/// App Intents (iOS 16+) register these in the main app target directly —
/// no separate Intents Extension or App Group entitlement needed, unlike
/// legacy SiriKit custom intents.
@available(iOS 16.0, *)
struct EatLogShortcuts: AppShortcutsProvider {
    // `appShortcuts` is an @AppShortcutsBuilder result-builder context (like
    // SwiftUI's `body`), so it must stay a single expression — no `let` or
    // explicit `return`, or the type-checker produces misleading errors.
    //
    // NB: `\.$foodDescription` can't be embedded directly into a phrase —
    // App Intents only allows AppEntity/AppEnum-typed parameters in phrase
    // syntax, and foodDescription is a free-text String (it has to be,
    // since it's arbitrary dictated food text, not a fixed set of options).
    // That means this has to stay a two-turn interaction: the trigger
    // phrase alone, then Siri's own requestValueDialog follow-up asks for
    // the food description on the LogFoodIntent parameter.
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogFoodIntent(),
            phrases: [
                "Log food in \(.applicationName)",
                "Log a meal in \(.applicationName)",
                "Log what I ate in \(.applicationName)",
            ],
            shortTitle: "Log Food",
            systemImageName: "fork.knife"
        )
    }
}
