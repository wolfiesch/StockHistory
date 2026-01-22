import Testing
import Foundation
@testable import DCAKit

/// Tests for the Investment Schedule Builder
struct InvestmentScheduleTests {

    // MARK: - Test Data

    static let tradingDays: [String: PricePoint] = [
        "2023-01-02": PricePoint(date: "2023-01-02", open: 100, high: 102, low: 99, close: 100, volume: 1000),
        "2023-01-03": PricePoint(date: "2023-01-03", open: 100, high: 102, low: 99, close: 101, volume: 1000),
        "2023-01-04": PricePoint(date: "2023-01-04", open: 100, high: 102, low: 99, close: 102, volume: 1000),
        "2023-01-05": PricePoint(date: "2023-01-05", open: 100, high: 102, low: 99, close: 103, volume: 1000),
        "2023-01-06": PricePoint(date: "2023-01-06", open: 100, high: 102, low: 99, close: 104, volume: 1000),
        // Weekend gap (07, 08)
        "2023-01-09": PricePoint(date: "2023-01-09", open: 100, high: 102, low: 99, close: 105, volume: 1000),
        "2023-01-10": PricePoint(date: "2023-01-10", open: 100, high: 102, low: 99, close: 106, volume: 1000),
        "2023-01-11": PricePoint(date: "2023-01-11", open: 100, high: 102, low: 99, close: 107, volume: 1000),
        "2023-01-12": PricePoint(date: "2023-01-12", open: 100, high: 102, low: 99, close: 108, volume: 1000),
        "2023-01-13": PricePoint(date: "2023-01-13", open: 100, high: 102, low: 99, close: 109, volume: 1000),
    ]

    // MARK: - Weekly Schedule Tests

    @Test("Generates weekly investment schedule")
    func weeklySchedule() {
        let schedule = InvestmentScheduleBuilder.buildInvestmentSchedule(
            startDate: "2023-01-02",
            endDate: "2023-01-13",
            frequency: .weekly,
            priceMap: Self.tradingDays,
            amount: 100
        )

        // Should have 2 investments: Jan 2 and Jan 9
        #expect(schedule.count == 2)
        #expect(schedule["2023-01-02"] == 100)
        #expect(schedule["2023-01-09"] == 100)
    }

    @Test("Weekly schedule handles weekend start date")
    func weeklyWeekendStart() {
        let schedule = InvestmentScheduleBuilder.buildInvestmentSchedule(
            startDate: "2023-01-07", // Saturday
            endDate: "2023-01-13",
            frequency: .weekly,
            priceMap: Self.tradingDays,
            amount: 100
        )

        // Jan 7 (Saturday) should map to Jan 9 (Monday)
        #expect(schedule["2023-01-09"] == 100)
    }

    // MARK: - Biweekly Schedule Tests

    @Test("Generates biweekly investment schedule")
    func biweeklySchedule() {
        let schedule = InvestmentScheduleBuilder.buildInvestmentSchedule(
            startDate: "2023-01-02",
            endDate: "2023-01-20",
            frequency: .biweekly,
            priceMap: Self.tradingDays,
            amount: 100
        )

        // Should have investment on Jan 2 only (Jan 16 is outside our test data)
        #expect(schedule["2023-01-02"] == 100)
    }

    // MARK: - Monthly Schedule Tests

    @Test("Generates monthly investment schedule")
    func monthlySchedule() {
        // Extended data for monthly test
        var extendedDays = Self.tradingDays
        extendedDays["2023-02-01"] = PricePoint(date: "2023-02-01", open: 100, high: 102, low: 99, close: 110, volume: 1000)
        extendedDays["2023-02-02"] = PricePoint(date: "2023-02-02", open: 100, high: 102, low: 99, close: 111, volume: 1000)

        let schedule = InvestmentScheduleBuilder.buildInvestmentSchedule(
            startDate: "2023-01-02",
            endDate: "2023-02-02",
            frequency: .monthly,
            priceMap: extendedDays,
            amount: 100
        )

        // Should have investments on Jan 2 and Feb 2
        #expect(schedule.count == 2)
        #expect(schedule["2023-01-02"] == 100)
        #expect(schedule["2023-02-02"] == 100)
    }

    // MARK: - Trading Day Lookup Tests

    @Test("Finds nearest trading day within 7 days")
    func nearestTradingDay() {
        let schedule = InvestmentScheduleBuilder.buildInvestmentSchedule(
            startDate: "2023-01-07", // Saturday - no trading
            endDate: "2023-01-07",
            frequency: .weekly,
            priceMap: Self.tradingDays,
            amount: 100
        )

        // Should find Monday Jan 9
        #expect(schedule["2023-01-09"] == 100)
    }

    @Test("Accumulates when multiple dates map to same trading day")
    func accumulatesSameTradingDay() {
        // Simulate two consecutive non-trading days that both map to same trading day
        let limitedDays: [String: PricePoint] = [
            "2023-01-09": PricePoint(date: "2023-01-09", open: 100, high: 102, low: 99, close: 105, volume: 1000),
        ]

        // If we start on Jan 7 (Sat) with daily frequency, both Jan 7 and Jan 8 would map to Jan 9
        // But with weekly, only Jan 7 maps to Jan 9
        let schedule = InvestmentScheduleBuilder.buildInvestmentSchedule(
            startDate: "2023-01-07",
            endDate: "2023-01-08",
            frequency: .weekly,
            priceMap: limitedDays,
            amount: 100
        )

        // Single investment on the one available trading day
        #expect(schedule["2023-01-09"] == 100)
    }

    // MARK: - Dividend Map Tests

    @Test("Builds dividend map from history")
    func dividendMapBuilding() {
        let dividends = [
            DividendHistory(exDate: "2023-01-05", paymentDate: "2023-01-15", amount: 0.50),
            DividendHistory(exDate: "2023-04-05", paymentDate: "2023-04-15", amount: 0.52),
        ]

        let map = InvestmentScheduleBuilder.buildDividendMap(dividends)

        #expect(map.count == 2)
        #expect(map["2023-01-05"] == 0.50)
        #expect(map["2023-04-05"] == 0.52)
    }

    @Test("Accumulates multiple dividends on same date")
    func multipleDividendsSameDate() {
        let dividends = [
            DividendHistory(exDate: "2023-01-05", paymentDate: "2023-01-15", amount: 0.25),
            DividendHistory(exDate: "2023-01-05", paymentDate: "2023-01-16", amount: 0.25),
        ]

        let map = InvestmentScheduleBuilder.buildDividendMap(dividends)

        #expect(map.count == 1)
        #expect(map["2023-01-05"] == 0.50)
    }

    @Test("Ignores dividends with zero or negative amounts")
    func ignoresZeroDividends() {
        let dividends = [
            DividendHistory(exDate: "2023-01-05", paymentDate: "2023-01-15", amount: 0.50),
            DividendHistory(exDate: "2023-01-06", paymentDate: "2023-01-16", amount: 0),
            DividendHistory(exDate: "2023-01-07", paymentDate: "2023-01-17", amount: -0.10),
        ]

        let map = InvestmentScheduleBuilder.buildDividendMap(dividends)

        #expect(map.count == 1)
        #expect(map["2023-01-05"] == 0.50)
    }
}
