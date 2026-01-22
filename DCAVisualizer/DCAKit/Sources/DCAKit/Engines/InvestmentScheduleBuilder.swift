import Foundation

/// Builds investment schedules and maps scheduled dates to actual trading days
/// - Note: Ports `buildInvestmentSchedule` from the web TypeScript implementation
public enum InvestmentScheduleBuilder {

    // MARK: - Public API

    /// Builds a map of trading dates to investment amounts
    /// - Parameters:
    ///   - startDate: Start date for investments (ISO string)
    ///   - endDate: End date for investments (ISO string)
    ///   - frequency: How often to invest
    ///   - priceMap: Map of trading dates to price data
    ///   - amount: Amount to invest each period
    /// - Returns: Dictionary mapping trading dates to total investment amounts
    ///
    /// - Note: Multiple scheduled investments may map to the same trading day
    ///   (e.g., if two scheduled dates both fall on a holiday weekend, they may
    ///   both resolve to the next Monday). In this case, amounts are accumulated.
    public static func buildInvestmentSchedule(
        startDate: String,
        endDate: String,
        frequency: InvestmentFrequency,
        priceMap: [String: PricePoint],
        amount: Double
    ) -> [String: Double] {
        let investmentDates = getInvestmentDates(
            startDate: startDate,
            endDate: endDate,
            frequency: frequency
        )

        var schedule: [String: Double] = [:]

        for scheduledDate in investmentDates {
            guard let tradingDate = findNearestTradingDay(
                targetDate: scheduledDate,
                priceMap: priceMap
            ) else {
                // No trading day found within 7 days, skip this investment
                continue
            }

            let existing = schedule[tradingDate] ?? 0
            schedule[tradingDate] = existing + amount
        }

        return schedule
    }

    /// Builds a map of ex-dividend dates to dividend amounts
    /// - Parameter dividends: Array of dividend history records
    /// - Returns: Dictionary mapping ex-dates to total dividend per share
    ///
    /// - Important: Uses exDate, NOT paymentDate. This is the date used to
    ///   determine share ownership for dividend eligibility.
    public static func buildDividendMap(_ dividends: [DividendHistory]) -> [String: Double] {
        var map: [String: Double] = [:]

        for dividend in dividends {
            guard !dividend.exDate.isEmpty, dividend.amount > 0 else {
                continue
            }

            // Accumulate if multiple dividends on same day (rare but possible)
            let existing = map[dividend.exDate] ?? 0
            map[dividend.exDate] = existing + dividend.amount
        }

        return map
    }

    // MARK: - Private Helpers

    /// Generates all scheduled investment dates based on frequency
    private static func getInvestmentDates(
        startDate: String,
        endDate: String,
        frequency: InvestmentFrequency
    ) -> Set<String> {
        var dates = Set<String>()

        guard let start = parseDate(startDate),
              let end = parseDate(endDate) else {
            return dates
        }

        var current = start
        let calendar = Calendar(identifier: .gregorian)

        while current <= end {
            dates.insert(formatDate(current))

            // Advance based on frequency
            switch frequency {
            case .weekly:
                current = calendar.date(byAdding: .day, value: 7, to: current) ?? current
            case .biweekly:
                current = calendar.date(byAdding: .day, value: 14, to: current) ?? current
            case .monthly:
                current = calendar.date(byAdding: .month, value: 1, to: current) ?? current
            }
        }

        return dates
    }

    /// Finds the nearest trading day for a given date
    /// - Parameters:
    ///   - targetDate: The scheduled investment date
    ///   - priceMap: Map of available trading days
    ///   - maxDaysForward: Maximum days to search forward (default: 7)
    /// - Returns: The nearest trading date, or nil if none found within range
    ///
    /// - Note: Searches forward only (never backward) to avoid investing
    ///   before the scheduled date.
    private static func findNearestTradingDay(
        targetDate: String,
        priceMap: [String: PricePoint],
        maxDaysForward: Int = 7
    ) -> String? {
        guard let target = parseDate(targetDate) else {
            return nil
        }

        let calendar = Calendar(identifier: .gregorian)

        for i in 0...maxDaysForward {
            guard let checkDate = calendar.date(byAdding: .day, value: i, to: target) else {
                continue
            }

            let dateStr = formatDate(checkDate)
            if priceMap[dateStr] != nil {
                return dateStr
            }
        }

        return nil
    }

    // MARK: - Date Utilities

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

    private static func formatDate(_ date: Date) -> String {
        dateFormatter.string(from: date)
    }
}
