import Foundation

/// Complete result of a DCA or lump sum simulation
/// - Note: Mirrors `SimulationResult` from the web TypeScript implementation
public struct SimulationResult: Sendable, Equatable {
    /// Array of portfolio states, one per trading day
    public let points: [SimulationPoint]

    /// Final number of shares owned
    public let finalShares: Double

    /// Total cash invested over the simulation period
    public let totalInvested: Double

    /// Total dividends received (as cash if !isDRIP, or value of DRIP shares)
    public let totalDividends: Double

    /// Final portfolio value (market value + any cash dividends)
    public let finalValue: Double

    /// Total return percentage: ((finalValue - totalInvested) / totalInvested) × 100
    public let totalReturn: Double

    /// Compound Annual Growth Rate as percentage
    public let cagr: Double

    public init(
        points: [SimulationPoint],
        finalShares: Double,
        totalInvested: Double,
        totalDividends: Double,
        finalValue: Double,
        totalReturn: Double,
        cagr: Double
    ) {
        self.points = points
        self.finalShares = finalShares
        self.totalInvested = totalInvested
        self.totalDividends = totalDividends
        self.finalValue = finalValue
        self.totalReturn = totalReturn
        self.cagr = cagr
    }

    /// Empty result for edge cases (no data, invalid configuration)
    public static let empty = SimulationResult(
        points: [],
        finalShares: 0,
        totalInvested: 0,
        totalDividends: 0,
        finalValue: 0,
        totalReturn: 0,
        cagr: 0
    )

    /// Whether this result contains any simulation data
    public var isEmpty: Bool {
        points.isEmpty
    }

    /// Number of trading days in the simulation
    public var tradingDays: Int {
        points.count
    }

    /// First simulation point (if any)
    public var firstPoint: SimulationPoint? {
        points.first
    }

    /// Last simulation point (if any)
    public var lastPoint: SimulationPoint? {
        points.last
    }
}
