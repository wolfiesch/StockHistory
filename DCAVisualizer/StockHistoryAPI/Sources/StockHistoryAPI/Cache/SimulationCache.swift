import Foundation
import DCAKit

/// Actor-based cache for stock data
/// - Note: Enables offline playback of previously fetched simulations
///
/// ## Cache Strategy
/// - Data is cached by ticker + date range combination
/// - Default TTL is 1 hour for fresh data
/// - Stale data can still be used when offline (with indicator to user)
/// - Cache is persisted to disk for app restart survival
public actor SimulationCache {

    // MARK: - Types

    /// Cached stock data for a specific query
    public struct CachedData: Codable, Sendable {
        public let prices: [PricePoint]
        public let dividends: [DividendHistory]
        public let fetchedAt: Date

        public init(prices: [PricePoint], dividends: [DividendHistory], fetchedAt: Date = Date()) {
            self.prices = prices
            self.dividends = dividends
            self.fetchedAt = fetchedAt
        }

        /// Whether this cache entry has expired
        public func isExpired(ttl: TimeInterval) -> Bool {
            Date().timeIntervalSince(fetchedAt) > ttl
        }

        /// Age of this cache entry in seconds
        public var age: TimeInterval {
            Date().timeIntervalSince(fetchedAt)
        }

        /// Human-readable age description
        public var ageDescription: String {
            let minutes = Int(age / 60)
            if minutes < 60 {
                return "\(minutes) minute\(minutes == 1 ? "" : "s") ago"
            }
            let hours = minutes / 60
            if hours < 24 {
                return "\(hours) hour\(hours == 1 ? "" : "s") ago"
            }
            let days = hours / 24
            return "\(days) day\(days == 1 ? "" : "s") ago"
        }
    }

    /// Result of a cache lookup
    public enum CacheResult: Sendable {
        /// Fresh data (within TTL)
        case fresh(CachedData)
        /// Stale data (beyond TTL but still usable)
        case stale(CachedData)
        /// No cached data available
        case miss
    }

    // MARK: - Properties

    private let fileManager = FileManager.default
    private let ttl: TimeInterval
    private var memoryCache: [String: CachedData] = [:]

    /// Directory where cache files are stored
    private var cacheDirectory: URL {
        let cachesDir = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return cachesDir.appendingPathComponent("StockHistoryCache", isDirectory: true)
    }

    // MARK: - Initialization

    /// Creates a new cache instance
    /// - Parameter ttl: Time-to-live for cache entries in seconds (default: 1 hour)
    public init(ttl: TimeInterval = 3600) {
        self.ttl = ttl
    }

    // MARK: - Public API

    /// Retrieves cached data for a stock query
    /// - Parameters:
    ///   - ticker: Stock ticker symbol
    ///   - startDate: Start date of the query
    ///   - endDate: End date of the query
    /// - Returns: Cache result indicating fresh, stale, or miss
    public func get(
        ticker: String,
        startDate: String,
        endDate: String
    ) -> CacheResult {
        let key = cacheKey(ticker: ticker, startDate: startDate, endDate: endDate)

        // Check memory cache first
        if let data = memoryCache[key] {
            if data.isExpired(ttl: ttl) {
                return .stale(data)
            }
            return .fresh(data)
        }

        // Try disk cache
        if let data = loadFromDisk(key: key) {
            // Populate memory cache
            memoryCache[key] = data

            if data.isExpired(ttl: ttl) {
                return .stale(data)
            }
            return .fresh(data)
        }

        return .miss
    }

    /// Stores data in the cache
    /// - Parameters:
    ///   - data: The data to cache
    ///   - ticker: Stock ticker symbol
    ///   - startDate: Start date of the query
    ///   - endDate: End date of the query
    public func set(
        _ data: CachedData,
        ticker: String,
        startDate: String,
        endDate: String
    ) {
        let key = cacheKey(ticker: ticker, startDate: startDate, endDate: endDate)

        // Update memory cache
        memoryCache[key] = data

        // Persist to disk
        saveToDisk(data: data, key: key)
    }

    /// Convenience method to cache prices and dividends
    public func set(
        prices: [PricePoint],
        dividends: [DividendHistory],
        ticker: String,
        startDate: String,
        endDate: String
    ) {
        let data = CachedData(prices: prices, dividends: dividends)
        set(data, ticker: ticker, startDate: startDate, endDate: endDate)
    }

    /// Clears all expired entries from the cache
    /// - Parameter olderThan: Remove entries older than this interval (default: TTL)
    public func clearExpired(olderThan: TimeInterval? = nil) {
        let threshold = olderThan ?? ttl

        // Clear from memory
        memoryCache = memoryCache.filter { _, data in
            !data.isExpired(ttl: threshold)
        }

        // Clear from disk
        clearExpiredFromDisk(olderThan: threshold)
    }

    /// Clears the entire cache
    public func clearAll() {
        memoryCache.removeAll()
        try? fileManager.removeItem(at: cacheDirectory)
    }

    /// Returns the number of cached entries
    public var count: Int {
        memoryCache.count
    }

    // MARK: - Private Helpers

    /// Generates a unique cache key for a query
    private func cacheKey(ticker: String, startDate: String, endDate: String) -> String {
        "\(ticker.uppercased())_\(startDate)_\(endDate)"
    }

    /// Loads cached data from disk
    private func loadFromDisk(key: String) -> CachedData? {
        let fileURL = cacheDirectory.appendingPathComponent("\(key).json")

        guard fileManager.fileExists(atPath: fileURL.path) else {
            return nil
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(CachedData.self, from: data)
        } catch {
            // Corrupted cache file, remove it
            try? fileManager.removeItem(at: fileURL)
            return nil
        }
    }

    /// Saves cached data to disk
    private func saveToDisk(data: CachedData, key: String) {
        do {
            // Ensure cache directory exists
            try fileManager.createDirectory(
                at: cacheDirectory,
                withIntermediateDirectories: true
            )

            let fileURL = cacheDirectory.appendingPathComponent("\(key).json")
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let jsonData = try encoder.encode(data)
            try jsonData.write(to: fileURL, options: .atomic)
        } catch {
            // Cache write failure is non-critical, just log
            print("SimulationCache: Failed to write to disk: \(error)")
        }
    }

    /// Clears expired files from disk
    private func clearExpiredFromDisk(olderThan threshold: TimeInterval) {
        guard let enumerator = fileManager.enumerator(
            at: cacheDirectory,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        ) else {
            return
        }

        let cutoffDate = Date().addingTimeInterval(-threshold)

        while let fileURL = enumerator.nextObject() as? URL {
            guard fileURL.pathExtension == "json" else { continue }

            do {
                let attributes = try fileURL.resourceValues(forKeys: [.contentModificationDateKey])
                if let modDate = attributes.contentModificationDate, modDate < cutoffDate {
                    try fileManager.removeItem(at: fileURL)
                }
            } catch {
                // Ignore individual file errors
            }
        }
    }
}
