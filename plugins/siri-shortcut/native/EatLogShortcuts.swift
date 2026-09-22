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
    //
    // Down to a single phrase, deliberately: registration/build/app-name
    // matching were all confirmed working (the shortcut shows up correctly
    // in the Shortcuts app and runs fine when triggered manually) — the
    // remaining failure is Siri's on-device NLU not confidently matching
    // "Hey Siri, [phrase]" to any of our registered phrasings, and offering
    // three similar phrases for one intent likely diluted matching further
    // rather than helping. "EatLog" is also not a real word Siri's language
    // model has ever seen, so it has to lean entirely on this template —
    // "with" reads more naturally leading into a compound app name than
    // "in" (Apple's own HIG examples favor "Log a workout with Fitness"
    // over "... in Fitness").
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogFoodIntent(),
            phrases: [
                "Log food with \(.applicationName)",
            ],
            shortTitle: "Log Food",
            systemImageName: "fork.knife"
        )
    }
}
