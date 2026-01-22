import Testing
import Foundation
@testable import DCAKit

/// Tests for the Lump Sum Simulation Engine
struct LumpSumSimulatorTests {

    // MARK: - Test Data

    static let samplePrices: [PricePoint] = [
        PricePoint(date: "2023-01-02", open: 100, high: 102, low: 99, close: 100, volume: 1000000),
        PricePoint(date: "2023-01-03", open: 100, high: 103, low: 100, close: 102, volume: 1000000),
        PricePoint(date: "2023-01-04", open: 102, high: 104, low: 101, close: 103, volume: 1000000),
        PricePoint(date: "2023-01-05", open: 103, high: 105, low: 102, close: 104, volume: 1000000),
        PricePoint(date: "2023-01-06", open: 104, high: 106, low: 103, close: 105, volume: 1000000),
        PricePoint(date: "2023-01-09", open: 105, high: 107, low: 104, close: 106, volume: 1000000),
        PricePoint(date: "2023-01-10", open: 106, high: 108, low: 105, close: 107, volume: 1000000),
    ]

    static let sampleDividends: [DividendHistory] = [
        DividendHistory(exDate: "2023-01-05", paymentDate: "2023-01-15", amount: 0.50),
    ]

    // MARK: - Basic Tests

    @Test("Returns empty result for empty price history")
    func emptyPriceHistory() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: Date()
        )

        let result = LumpSumSimulator.run(
            priceHistory: [],
            dividendHistory: [],
            config: config
        )

        #expect(result.isEmpty)
    }

    @Test("Invests entire amount on first investment date")
    func investsEntireAmount() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-02"),
            endDate: parseDate("2023-01-10"),
            isDRIP: true
        )

        let result = LumpSumSimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: [],
            config: config
        )

        // Lump sum invests total of DCA investments on day 1
        // DCA would invest $100 on Jan 2 and $100 on Jan 9 = $200 total
        #expect(result.totalInvested == 200)

        // All shares bought at $100 = 2 shares
        #expect(result.finalShares == 2.0)

        // Final value at $107 = 2 × $107 = $214
        #expect(result.finalValue == 214)
    }

    @Test("Uses override total when provided")
    func totalInvestmentOverride() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-02"),
            endDate: parseDate("2023-01-10"),
            isDRIP: true
        )

        let result = LumpSumSimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: [],
            config: config,
            totalInvestmentOverride: 500
        )

        #expect(result.totalInvested == 500)
        // $500 / $100 = 5 shares
        #expect(result.finalShares == 5.0)
    }

    // MARK: - Dividend Tests

    @Test("Handles dividends with DRIP")
    func dripDividends() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-02"),
            endDate: parseDate("2023-01-10"),
            isDRIP: true
        )

        let result = LumpSumSimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: Self.sampleDividends,
            config: config
        )

        // $200 at $100 = 2 shares
        // Dividend on Jan 5: 2 × $0.50 = $1.00, at $104 = ~0.0096 new shares
        #expect(result.finalShares > 2.0)
        #expect(result.totalDividends == 0) // DRIP = no cash
    }

    @Test("Handles dividends without DRIP")
    func cashDividends() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-02"),
            endDate: parseDate("2023-01-10"),
            isDRIP: false
        )

        let result = LumpSumSimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: Self.sampleDividends,
            config: config
        )

        // 2 shares × $0.50 = $1.00 cash dividend
        #expect(result.totalDividends == 1.0)
        #expect(result.finalShares == 2.0) // No additional shares from DRIP
    }

    // MARK: - Comparison Tests

    @Test("Lump sum vs DCA fair comparison uses same total")
    func fairComparisonWithDCA() {
        let config = DCAConfig(
            ticker: "TEST",
            amount: 100,
            frequency: .weekly,
            startDate: parseDate("2023-01-02"),
            endDate: parseDate("2023-01-10"),
            isDRIP: true
        )

        // Run DCA first
        let dcaResult = DCASimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: [],
            config: config
        )

        // Run lump sum with DCA's total
        let lumpSumResult = LumpSumSimulator.run(
            priceHistory: Self.samplePrices,
            dividendHistory: [],
            config: config,
            totalInvestmentOverride: dcaResult.totalInvested
        )

        // Both should have invested the same total
        #expect(lumpSumResult.totalInvested == dcaResult.totalInvested)

        // But lump sum will have different final value due to timing
        // In a rising market, lump sum often outperforms DCA
        #expect(lumpSumResult.finalValue != dcaResult.finalValue)
    }

    // MARK: - Helpers

    private func parseDate(_ string: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.date(from: string) ?? Date()
    }
}
