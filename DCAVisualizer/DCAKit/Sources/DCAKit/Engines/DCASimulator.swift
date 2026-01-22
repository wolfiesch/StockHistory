import Foundation

/// Core DCA simulation engine
/// - Note: Direct port of `runDCASimulation` from the web TypeScript implementation
public enum DCASimulator {

    /// Runs a Dollar Cost Averaging simulation
    /// - Parameters:
    ///   - priceHistory: Array of daily price data, sorted by date ascending
    ///   - dividendHistory: Array of dividend records
    ///   - config: Simulation configuration
    /// - Returns: Complete simulation result with all data points and metrics
    ///
    /// ## Algorithm Overview
    /// For each trading day in the price history:
    /// 1. **Process dividends first** - If this is an ex-dividend date and we own shares,
    ///    either reinvest (DRIP) or accumulate as cash
    /// 2. **Process scheduled investment** - If an investment is scheduled for this day,
    ///    buy shares at the closing price
    /// 3. **Record portfolio state** - Capture the current state for visualization
    ///
    /// ## Important Edge Cases
    /// - Empty price history returns `SimulationResult.empty`
    /// - Start date before available data is adjusted to first available date
    /// - Scheduled investments on non-trading days are moved forward (up to 7 days)
    public static func run(
        priceHistory: [PricePoint],
        dividendHistory: [DividendHistory],
        config: DCAConfig
    ) -> SimulationResult {
        // Edge case: no price data
        guard !priceHistory.isEmpty else {
            return .empty
        }

        // Build lookup maps for O(1) access
        var priceMap: [String: PricePoint] = [:]
        for point in priceHistory {
            priceMap[point.date] = point
        }

        let dividendMap = InvestmentScheduleBuilder.buildDividendMap(dividendHistory)

        // Get date boundaries
        let firstDate = priceHistory[0].date
        let lastDate = priceHistory[priceHistory.count - 1].date

        // Adjust start date if before available data
        let configStart = config.startDateString
        let effectiveStart = configStart < firstDate ? firstDate : configStart

        // Build investment schedule mapping to actual trading days
        let investmentsByDate = InvestmentScheduleBuilder.buildInvestmentSchedule(
            startDate: effectiveStart,
            endDate: lastDate,
            frequency: config.frequency,
            priceMap: priceMap,
            amount: config.amount
        )

        // Simulation state
        var totalShares: Double = 0
        var totalInvested: Double = 0
        var cumulativeDividends: Double = 0
        var points: [SimulationPoint] = []

        // Reserve capacity for performance
        points.reserveCapacity(priceHistory.count)

        // Iterate through each trading day
        for pricePoint in priceHistory {
            let date = pricePoint.date
            let price = pricePoint.close

            // Skip dates before our effective start
            if date < effectiveStart {
                continue
            }

            // STEP 1: Process dividends FIRST (before investments)
            // This ensures we don't receive dividends on shares we just bought
            if let dividendPerShare = dividendMap[date], totalShares > 0 {
                let dividendReceived = dividendPerShare * totalShares

                if config.isDRIP {
                    // Reinvest dividends - buy more shares at today's price
                    let newShares = dividendReceived / price
                    totalShares += newShares
                } else {
                    // Accumulate as cash
                    cumulativeDividends += dividendReceived
                }
            }

            // STEP 2: Process scheduled investment
            if let investmentAmount = investmentsByDate[date] {
                let sharesBought = investmentAmount / price
                totalShares += sharesBought
                totalInvested += investmentAmount
            }

            // STEP 3: Calculate current market value and record point
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

        // Calculate years for CAGR
        let years = calculateYears(from: effectiveStart, to: lastDate)
        let cagr = calculateCAGR(
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

    // MARK: - CAGR Calculation

    /// Calculates Compound Annual Growth Rate
    /// - Formula: (finalValue / initialValue)^(1/years) - 1
    /// - Returns: CAGR as a percentage
    public static func calculateCAGR(
        initialValue: Double,
        finalValue: Double,
        years: Double
    ) -> Double {
        guard initialValue > 0, years > 0 else {
            return 0
        }
        return (pow(finalValue / initialValue, 1 / years) - 1) * 100
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
