import Testing
import Foundation
@testable import DCAKit

/// Tests for the DCA Simulation Engine
/// - Note: These tests verify parity with the web TypeScript implementation
struct DCASimulatorTests {

    // MARK: - Test Data

    /// Sample price data for testing (simplified AAPL-like data)
    static let samplePrices: [PricePoint] = [
        PricePoint(date: "2023-01-02", open: 100, high: 102, low: 99, close: 100, volume: 1000000),
        PricePoint(date: "2023-01-03", open: 100, high: 103, low: 100, close: 102, volume: 1000000),
        PricePoint(date: "2023-01-04", open: 102, high: 104, low: 101, close: 103, volume: 1000000),
        PricePoint(date: "2023-01-05", open: 103, high: 105, low: 102, close: 104, volume: 1000000),
        PricePoint(date: "2023-01-06", open: 104, high: 106, low: 103, close: 105, volume: 1000000),
        // Weekend gap
        PricePoint(date: "2023-01-09", open: 105, high: 107, low: 104, close: 106, volume: 1000000),
        PricePoint(date: "2023-01-10", open: 106, high: 108, low: 105, close: 107, volume: 1000000),
    ]

    /// Sample dividend data
    static let sampleDividends: [DividendHistory] = [
        DividendHistory(exDate: "2023-01-05", paymentDate: "2023-01-15", amount: 0.50),
    ]

    // MARK: - Empty Data Tests

    @Test("Returns empty result for empty price history")
    func emptyPriceHistory() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: Date()
        )

        let result = DCASimulator.run(
            priceHistory: [],
            dividendHistory: [],
            config: config
        )

        #expect(result.isEmpty)
        #expect(result.finalShares == 0)
        #expect(result.totalInvested == 0)
    }

    // MARK: - Basic Simulation Tests

    @Test("Calculates correct shares for single investment")
    func singleInvestment() {
        let prices = [Self.samplePrices[0]] // Just first day
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-02"),
            endDate: parseDate("2023-01-02"),
            isDRIP: true
        )

        let result = DCASimulator.run(
            priceHistory: prices,
            dividendHistory: [],
            config: config
        )

        #expect(result.points.count == 1)
        #expect(result.totalInvested == 100)
        // $100 / $100 per share = 1 share
        #expect(result.finalShares == 1.0)
    }

    @Test("Accumulates investments correctly over multiple days")
    func multipleInvestments() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-02"),
            endDate: parseDate("2023-01-10"),
            isDRIP: true
        )

        let result = DCASimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: [],
            config: config
        )

        // Weekly: should invest on 2023-01-02 and 2023-01-09
        #expect(result.totalInvested == 200)
        #expect(result.points.count == Self.samplePrices.count)
    }

    // MARK: - Dividend Tests

    @Test("DRIP reinvests dividends into shares")
    func dripReinvestment() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-02"),
            endDate: parseDate("2023-01-10"),
            isDRIP: true
        )

        let result = DCASimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: Self.sampleDividends,
            config: config
        )

        // Should have more shares than just from investments
        // First investment: $100 / $100 = 1 share
        // Dividend on 01-05: 1 share × $0.50 = $0.50, at $104 = 0.0048 shares
        // Second investment: $100 / $106 = 0.9434 shares
        #expect(result.finalShares > 1.9)
        #expect(result.totalDividends == 0) // DRIP = no cash dividends
    }

    @Test("Non-DRIP accumulates cash dividends")
    func cashDividends() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-02"),
            endDate: parseDate("2023-01-10"),
            isDRIP: false
        )

        let result = DCASimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: Self.sampleDividends,
            config: config
        )

        // Cash dividends should be accumulated
        // First investment gives 1 share, dividend is 1 × $0.50 = $0.50
        #expect(result.totalDividends == 0.50)
    }

    // MARK: - Date Handling Tests

    @Test("Adjusts start date to first available data")
    func startDateAdjustment() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2022-01-01"), // Before data
            endDate: parseDate("2023-01-10"),
            isDRIP: true
        )

        let result = DCASimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: [],
            config: config
        )

        // Should still work, starting from first available date
        #expect(!result.isEmpty)
        #expect(result.points.first?.date == "2023-01-02")
    }

    @Test("Handles weekend gaps correctly")
    func weekendGapHandling() {
        // Investment scheduled for Saturday 2023-01-07 should map to Monday 2023-01-09
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-07"), // Saturday
            endDate: parseDate("2023-01-10"),
            isDRIP: true
        )

        let result = DCASimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: [],
            config: config
        )

        // Should have invested on 2023-01-09 (Monday)
        #expect(result.totalInvested == 100)
    }

    // MARK: - CAGR Tests

    @Test("Calculates CAGR correctly")
    func cagrCalculation() {
        // 100% return over 1 year = CAGR of 100%
        let cagr1 = DCASimulator.calculateCAGR(
            initialValue: 100,
            finalValue: 200,
            years: 1
        )
        #expect(abs(cagr1 - 100) < 0.01)

        // 100% return over 2 years ≈ 41.4% CAGR
        let cagr2 = DCASimulator.calculateCAGR(
            initialValue: 100,
            finalValue: 200,
            years: 2
        )
        #expect(abs(cagr2 - 41.42) < 0.1)

        // Edge case: zero initial value
        let cagr3 = DCASimulator.calculateCAGR(
            initialValue: 0,
            finalValue: 100,
            years: 1
        )
        #expect(cagr3 == 0)
    }

    // MARK: - Helpers

    private func parseDate(_ string: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.date(from: string) ?? Date()
    }
}
