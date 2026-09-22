import AppIntents
import UIKit
import os.log

private let log = Logger(subsystem: "com.ryanfborroff.EatLog", category: "LogFoodIntent")

/// Lets Siri ("Hey Siri, log food in EatLog") or the Shortcuts app capture a
/// spoken food description and hand it straight to the existing voice-log
/// pipeline in JS. This intent deliberately does NOT try to parse or log the
/// food itself — foodPipeline.ts already does AI parsing, Supabase writes,
/// and HealthKit sync, and duplicating that in Swift would just create a
/// second implementation to keep in sync. Instead it opens the app on the
/// same screen a manual mic-tap would reach, with the transcript pre-filled,
/// so the user gets the same confirmation/clarification UI either way.
@available(iOS 16.0, *)
struct LogFoodIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Food in EatLog"
    static var description = IntentDescription(
        "Logs a meal or food item in EatLog from a spoken description."
    )

    // Opens the host app to run `perform()`, rather than trying to execute
    // fully in the background — see the note above on why the JS pipeline
    // owns the actual logging.
    static var openAppWhenRun: Bool = true

    @Parameter(
        title: "Food description",
        description: "What you ate, e.g. \"two eggs and a slice of toast\"",
        requestValueDialog: IntentDialog("What did you eat?")
    )
    var foodDescription: String

    @MainActor
    func perform() async throws -> some IntentResult {
        log.notice("perform() called with foodDescription=\"\(foodDescription, privacy: .public)\"")

        var components = URLComponents()
        components.scheme = "eatlog"
        components.host = "modal"
        components.queryItems = [URLQueryItem(name: "transcript", value: foodDescription)]

        guard let url = components.url else {
            log.error("Failed to build URL from foodDescription=\"\(foodDescription, privacy: .public)\"")
            throw LogFoodIntentError.invalidTranscript
        }

        log.notice("Opening URL: \(url.absoluteString, privacy: .public)")
        let opened = await UIApplication.shared.open(url)
        log.notice("UIApplication.shared.open returned: \(opened, privacy: .public)")
        return .result()
    }
}

enum LogFoodIntentError: Swift.Error, CustomLocalizedStringResourceConvertible {
    case invalidTranscript

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .invalidTranscript:
            return "Couldn't understand that food description."
        }
    }
}
