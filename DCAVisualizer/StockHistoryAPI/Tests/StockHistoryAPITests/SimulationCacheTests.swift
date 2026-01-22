import XCTest
import DCAKit
@testable import StockHistoryAPI

final class SimulationCacheTests: XCTestCase {
    func testFreshCacheHit() async throws {
        let cache = SimulationCache(ttl: 3600)
        await cache.clearAll()

        let data = SimulationCache.CachedData(
            prices: samplePrices,
            dividends: sampleDividends,
            fetchedAt: Date()
        )

        await cache.set(
            data,
            ticker: "AAPL",
            startDate: "2020-01-02",
            endDate: "2020-01-03"
        )

        let result = await cache.get(
            ticker: "AAPL",
            startDate: "2020-01-02",
            endDate: "2020-01-03"
        )

        switch result {
        case .fresh(let cached):
            XCTAssertEqual(cached.prices, samplePrices)
        default:
            XCTFail("Expected fresh cache hit")
        }

        await cache.clearAll()
    }

    func testStaleCacheHit() async throws {
        let cache = SimulationCache(ttl: 60)
        await cache.clearAll()

        let staleDate = Date().addingTimeInterval(-120)
        let data = SimulationCache.CachedData(
            prices: samplePrices,
            dividends: sampleDividends,
            fetchedAt: staleDate
        )

        await cache.set(
            data,
            ticker: "AAPL",
            startDate: "2020-01-02",
            endDate: "2020-01-03"
        )

        let result = await cache.get(
            ticker: "AAPL",
            startDate: "2020-01-02",
            endDate: "2020-01-03"
        )

        switch result {
        case .stale(let cached):
            XCTAssertEqual(cached.prices, samplePrices)
        default:
            XCTFail("Expected stale cache hit")
        }

        await cache.clearAll()
    }

    func testDiskPersistence() async throws {
        let cache = SimulationCache(ttl: 3600)
        await cache.clearAll()

        await cache.set(
            prices: samplePrices,
            dividends: sampleDividends,
            ticker: "AAPL",
            startDate: "2020-01-02",
            endDate: "2020-01-03"
        )

        let newCache = SimulationCache(ttl: 3600)
        let result = await newCache.get(
            ticker: "AAPL",
            startDate: "2020-01-02",
            endDate: "2020-01-03"
        )

        switch result {
        case .fresh(let cached):
            XCTAssertEqual(cached.prices, samplePrices)
        default:
            XCTFail("Expected disk cache hit")
        }

        await newCache.clearAll()
    }

    func testCorruptedCacheFileIsIgnored() async throws {
        let cache = SimulationCache(ttl: 3600)
        await cache.clearAll()

        let cacheDirectory = FileManager.default
            .urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("StockHistoryCache", isDirectory: true)
        let key = "AAPL_2020-01-02_2020-01-03"
        let fileURL = cacheDirectory.appendingPathComponent("\(key).json")

        try FileManager.default.createDirectory(
            at: cacheDirectory,
            withIntermediateDirectories: true
        )
        let corruptedData = Data("{ invalid json".utf8)
        try corruptedData.write(to: fileURL)

        let result = await cache.get(
            ticker: "AAPL",
            startDate: "2020-01-02",
            endDate: "2020-01-03"
        )

        switch result {
        case .miss:
            XCTAssertFalse(FileManager.default.fileExists(atPath: fileURL.path))
        default:
            XCTFail("Expected cache miss for corrupted file")
        }

        await cache.clearAll()
    }
}

private extension SimulationCacheTests {
    var samplePrices: [PricePoint] {
        [
            PricePoint(date: "2020-01-02", open: 300, high: 305, low: 295, close: 303, volume: 1000000),
            PricePoint(date: "2020-01-03", open: 303, high: 308, low: 301, close: 307, volume: 900000)
        ]
    }

    var sampleDividends: [DividendHistory] {
        [
            DividendHistory(exDate: "2020-01-03", paymentDate: "2020-01-10", amount: 0.82, yield: 1.2)
        ]
    }
}
