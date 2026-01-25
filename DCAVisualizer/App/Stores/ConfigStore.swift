import Foundation
import SwiftUI
import DCAKit

/// Observable store for DCA configuration
/// - Note: Mirrors `useConfigStore` from the web TypeScript implementation
@Observable
public final class ConfigStore {

    // MARK: - Configuration Properties

    /// Stock ticker symbol (e.g., "AAPL")
    public var ticker: String = "AAPL" {
        didSet {
            // Guard against recursive observation updates
            let uppercased = ticker.uppercased()
            if ticker != uppercased {
                ticker = uppercased
            }
        }
    }

    /// Investment amount per period ($1 - $10,000)
    public var amount: Double = 100 {
        didSet {
            // Guard against recursive observation updates
            let clamped = max(1, min(10000, amount))
            if amount != clamped {
                amount = clamped
            }
        }
    }

    /// How often to invest
    public var frequency: InvestmentFrequency = .monthly

    /// Start date for simulation
    public var startDate: Date

    /// End date for simulation
    public var endDate: Date = Date()

    /// Whether to reinvest dividends
    public var isDRIP: Bool = true

    /// Whether to show lump sum comparison
    public var showLumpSum: Bool = false

    // MARK: - Initialization

    public init() {
        // Initialize startDate to 10 years ago
        self.startDate = Calendar.current.date(byAdding: .year, value: -10, to: Date()) ?? Date()
    }

    // MARK: - Computed Properties

    /// Start date as ISO string
    public var startDateString: String {
        Self.dateFormatter.string(from: startDate)
    }

    /// End date as ISO string
    public var endDateString: String {
        Self.dateFormatter.string(from: endDate)
    }

    /// Creates a DCAConfig from current state
    public var dcaConfig: DCAConfig {
        DCAConfig(
            ticker: ticker,
            amount: amount,
            frequency: frequency,
            startDate: startDate,
            endDate: endDate,
            isDRIP: isDRIP
        )
    }

    // MARK: - Default Values

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    // MARK: - Actions

    /// Resets configuration to default values
    public func reset() {
        ticker = "AAPL"
        amount = 100
        frequency = .monthly
        startDate = Calendar.current.date(byAdding: .year, value: -10, to: Date()) ?? Date()
        endDate = Date()
        isDRIP = true
        showLumpSum = false
    }

    /// Validates date range and adjusts if needed
    public func validateDateRange() {
        if endDate < startDate {
            endDate = startDate
        }
    }
}
