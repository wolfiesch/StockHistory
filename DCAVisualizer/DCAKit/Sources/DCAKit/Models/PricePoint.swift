import Foundation

/// Represents a single day's stock price data
/// - Note: Mirrors `PricePoint` from the web TypeScript implementation
public struct PricePoint: Codable, Sendable, Equatable {
    /// ISO date string (YYYY-MM-DD)
    public let date: String

    /// Opening price for the trading day
    public let open: Double

    /// Highest price during the trading day
    public let high: Double

    /// Lowest price during the trading day
    public let low: Double

    /// Closing price (adjusted for splits)
    /// - Important: Use this for all share calculations to handle stock splits correctly
    public let close: Double

    /// Trading volume for the day
    public let volume: Int

    public init(
        date: String,
        open: Double,
        high: Double,
        low: Double,
        close: Double,
        volume: Int
    ) {
        self.date = date
        self.open = open
        self.high = high
        self.low = low
        self.close = close
        self.volume = volume
    }
}
