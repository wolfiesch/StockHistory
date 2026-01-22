import Foundation

/// Configuration for a DCA simulation
/// - Note: Mirrors `DCAConfig` from the web TypeScript implementation
public struct DCAConfig: Sendable, Equatable {
    /// Stock ticker symbol (e.g., "AAPL", "SPY")
    public let ticker: String

    /// Investment amount per period in USD ($1 - $10,000)
    public let amount: Double

    /// How often to invest
    public let frequency: InvestmentFrequency

    /// Start date for the simulation
    public let startDate: Date

    /// End date for the simulation (defaults to today)
    public let endDate: Date

    /// Whether to reinvest dividends (DRIP - Dividend Reinvestment Plan)
    /// - When true: dividends buy more shares automatically
    /// - When false: dividends accumulate as cash
    public let isDRIP: Bool

    public init(
        ticker: String,
        amount: Double,
        frequency: InvestmentFrequency,
        startDate: Date,
        endDate: Date = Date(),
        isDRIP: Bool = true
    ) {
        // Normalize ticker to uppercase
        self.ticker = ticker.uppercased()
        // Clamp amount to valid range
        self.amount = max(1, min(10000, amount))
        self.frequency = frequency
        self.startDate = startDate
        self.endDate = endDate
        self.isDRIP = isDRIP
    }

    /// Start date as ISO string (YYYY-MM-DD)
    public var startDateString: String {
        Self.dateFormatter.string(from: startDate)
    }

    /// End date as ISO string (YYYY-MM-DD)
    public var endDateString: String {
        Self.dateFormatter.string(from: endDate)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()
}
