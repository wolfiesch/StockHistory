import Foundation

/// Represents a dividend payment event
/// - Note: Mirrors `DividendHistory` from the web TypeScript implementation
public struct DividendHistory: Codable, Sendable, Equatable {
    /// The ex-dividend date (YYYY-MM-DD)
    /// - Important: This is the date used for dividend timing, NOT paymentDate
    /// Shareholders must own the stock BEFORE this date to receive the dividend
    public let exDate: String

    /// The date the dividend is paid out (YYYY-MM-DD)
    public let paymentDate: String

    /// Dividend amount per share in USD
    public let amount: Double

    /// Dividend yield at the time of declaration (percentage)
    public let yield: Double

    public init(
        exDate: String,
        paymentDate: String,
        amount: Double,
        yield: Double = 0
    ) {
        self.exDate = exDate
        self.paymentDate = paymentDate
        self.amount = amount
        self.yield = yield
    }

    // Custom coding keys to match API response
    enum CodingKeys: String, CodingKey {
        case exDate = "exDate"
        case paymentDate = "paymentDate"
        case amount
        case yield
    }
}
