import Foundation

struct AppConfiguration {
    let apiBaseURL: String
    let resetCacheOnLaunch: Bool
    let useStubNetwork: Bool

    static func load(defaultBaseURL: String) -> AppConfiguration {
        let environment = ProcessInfo.processInfo.environment
        let apiBaseURL = stringValue(environment["API_BASE_URL"]) ?? defaultBaseURL

        return AppConfiguration(
            apiBaseURL: apiBaseURL,
            resetCacheOnLaunch: boolValue(environment["RESET_CACHE"]),
            useStubNetwork: boolValue(environment["USE_STUB_NETWORK"])
        )
    }

    private static func stringValue(_ rawValue: String?) -> String? {
        guard let value = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            return nil
        }
        return value
    }

    private static func boolValue(_ rawValue: String?) -> Bool {
        guard let value = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !value.isEmpty else {
            return false
        }

        return value == "1" || value == "true" || value == "yes" || value == "y"
    }
}
