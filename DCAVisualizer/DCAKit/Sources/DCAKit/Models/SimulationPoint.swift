import Foundation

/// Represents the portfolio state at a specific point in time during simulation
/// - Note: Mirrors `SimulationPoint` from the web TypeScript implementation
public struct SimulationPoint: Sendable, Equatable {
    /// Date of this data point (YYYY-MM-DD)
    public let date: String

    /// Total cash invested up to this point (excludes DRIP purchases)
    public let principal: Double

    /// Cumulative cash dividends received (0 if isDRIP, else accumulated)
    public let dividends: Double

    /// Current market value of all shares (shares × current price)
    public let marketValue: Double

    /// Total shares owned (includes DRIP-purchased shares)
    public let shares: Double

    /// Total portfolio value (marketValue + dividends for non-DRIP)
    public let totalValue: Double

    public init(
        date: String,
        principal: Double,
        dividends: Double,
        marketValue: Double,
        shares: Double,
        totalValue: Double
    ) {
        self.date = date
        self.principal = principal
        self.dividends = dividends
        self.marketValue = marketValue
        self.shares = shares
        self.totalValue = totalValue
    }

    /// Convenience initializer that calculates totalValue automatically
    public init(
        date: String,
        principal: Double,
        dividends: Double,
        marketValue: Double,
        shares: Double
    ) {
        self.date = date
        self.principal = principal
        self.dividends = dividends
        self.marketValue = marketValue
        self.shares = shares
        self.totalValue = marketValue + dividends
    }

    /// Current total return percentage at this point
    public var currentReturn: Double {
        guard principal > 0 else { return 0 }
        return ((totalValue - principal) / principal) * 100
    }

    /// Current profit/loss in dollars
    public var profitLoss: Double {
        totalValue - principal
    }
}
