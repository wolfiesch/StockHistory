import Foundation

/// Lump Sum investment simulation engine for comparison with DCA
/// - Note: Direct port of `runLumpSumSimulation` from the web TypeScript implementation
public enum LumpSumSimulator {

    /// Runs a Lump Sum investment simulation
    /// - Parameters:
    ///   - priceHistory: Array of daily price data, sorted by date ascending
    ///   - dividendHistory: Array of dividend records
    ///   - config: Simulation configuration (uses frequency/amount to calculate total)
    ///   - totalInvestmentOverride: Optional fixed total to invest (for fair DCA comparison)
    /// - Returns: Complete simulation result with all data points and metrics
    ///
    /// ## Key Differences from DCA
    /// - **All money invested on first investment date** instead of spread over time
    /// - Uses the same total investment as DCA would have made for fair comparison
    /// - Dividend handling is identical to DCA
    ///
    /// ## Fair Comparison Note
    /// When `totalInvestmentOverride` is provided (typically from a completed DCA simulation),
    /// the lump sum invests exactly that amount on day 1. This ensures we're comparing
    /// the same total dollars invested, just with different timing strategies.
    public static func run(
        priceHistory: [PricePoint],
        dividendHistory: [DividendHistory],
        config: DCAConfig,
        totalInvestmentOverride: Double? = nil
    ) -> SimulationResult {
        // Edge case: no price data
        guard !priceHistory.isEmpty else {
            return .empty
        }

        // Build lookup maps
        var priceMap: [String: PricePoint] = [:]
        for point in priceHistory {
            priceMap[point.date] = point
        }

        let dividendMap = InvestmentScheduleBuilder.buildDividendMap(dividendHistory)

        // Get date boundaries
        let firstDate = priceHistory[0].date
        let lastDate = priceHistory[priceHistory.count - 1].date
        let configStart = config.startDateString
        let effectiveStart = configStart < firstDate ? firstDate : configStart

        // Build investment schedule to calculate total and find first investment date
        let investmentsByDate = InvestmentScheduleBuilder.buildInvestmentSchedule(
            startDate: effectiveStart,
            endDate: lastDate,
            frequency: config.frequency,
            priceMap: priceMap,
            amount: config.amount
        )

        // Edge case: no investment opportunities
        guard !investmentsByDate.isEmpty else {
            return .empty
        }

        // Calculate total investment (sum of all scheduled investments)
        let scheduledTotal = investmentsByDate.values.reduce(0, +)
        let totalInvestment = totalInvestmentOverride ?? scheduledTotal

        // Find first investment date
        var firstInvestmentDate: String?
        for pricePoint in priceHistory {
            if pricePoint.date < effectiveStart {
                continue
            }
            if investmentsByDate[pricePoint.date] != nil {
                firstInvestmentDate = pricePoint.date
                break
            }
        }

        guard let investmentDate = firstInvestmentDate, totalInvestment > 0 else {
            return .empty
        }

        // Simulation state
        var totalShares: Double = 0
        var totalInvested: Double = 0
        var cumulativeDividends: Double = 0
        var hasInvested = false
        var points: [SimulationPoint] = []

        points.reserveCapacity(priceHistory.count)

        // Iterate through each trading day
        for pricePoint in priceHistory {
            let date = pricePoint.date
            let price = pricePoint.close

            if date < effectiveStart {
                continue
            }

            // STEP 1: Process dividends FIRST (same order as DCA)
            if let dividendPerShare = dividendMap[date], totalShares > 0 {
                let dividendReceived = dividendPerShare * totalShares

                if config.isDRIP {
                    let newShares = dividendReceived / price
                    totalShares += newShares
                } else {
                    cumulativeDividends += dividendReceived
                }
            }

            // STEP 2: Invest entire lump sum on first investment date
            if !hasInvested && date == investmentDate {
                let sharesBought = totalInvestment / price
                totalShares += sharesBought
                totalInvested = totalInvestment
                hasInvested = true
            }

            // STEP 3: Record portfolio state
            let marketValue = totalShares * price

            points.append(SimulationPoint(
                date: date,
                principal: totalInvested,
                dividends: cumulativeDividends,
                marketValue: marketValue,
                shares: totalShares,
                totalValue: marketValue + cumulativeDividends
            ))
        }

        // Calculate final metrics
        let finalValue = points.last?.totalValue ?? 0

        let totalReturn: Double = {
            guard totalInvested > 0 else { return 0 }
            return ((finalValue - totalInvested) / totalInvested) * 100
        }()

        let years = calculateYears(from: effectiveStart, to: lastDate)
        let cagr = DCASimulator.calculateCAGR(
            initialValue: totalInvested,
            finalValue: finalValue,
            years: years
        )

        return SimulationResult(
            points: points,
            finalShares: totalShares,
            totalInvested: totalInvested,
            totalDividends: cumulativeDividends,
            finalValue: finalValue,
            totalReturn: totalReturn,
            cagr: cagr
        )
    }

    // MARK: - Date Utilities

    private static func calculateYears(from startDate: String, to endDate: String) -> Double {
        guard let start = parseDate(startDate),
              let end = parseDate(endDate) else {
            return 0
        }

        let interval = end.timeIntervalSince(start)
        let secondsPerYear = 365.25 * 24 * 60 * 60
        return interval / secondsPerYear
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private static func parseDate(_ dateString: String) -> Date? {
        dateFormatter.date(from: dateString)
    }
}
