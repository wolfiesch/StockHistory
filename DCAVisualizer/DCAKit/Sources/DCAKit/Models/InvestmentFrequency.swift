import Foundation

/// Investment frequency options for DCA strategy
/// - Note: Mirrors `InvestmentFrequency` from the web TypeScript implementation
public enum InvestmentFrequency: String, Codable, Sendable, CaseIterable {
    case weekly
    case biweekly
    case monthly

    /// Human-readable display name
    public var displayName: String {
        switch self {
        case .weekly: return "Weekly"
        case .biweekly: return "Bi-weekly"
        case .monthly: return "Monthly"
        }
    }

    /// Number of days between investments (approximate, for monthly this is calculated differently)
    public var intervalDays: Int? {
        switch self {
        case .weekly: return 7
        case .biweekly: return 14
        case .monthly: return nil // Uses calendar month addition
        }
    }
}
