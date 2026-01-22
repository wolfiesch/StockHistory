import Foundation
import DCAKit

// MARK: - API Response DTOs

/// Response from the /api/stock/history endpoint
public struct HistoryResponse: Codable, Sendable {
    public let prices: [PricePoint]
    public let symbol: String

    public init(prices: [PricePoint], symbol: String) {
        self.prices = prices
        self.symbol = symbol
    }
}

/// Response from the /api/stock/dividends endpoint
public struct DividendsResponse: Codable, Sendable {
    public let dividends: [DividendHistory]
    public let symbol: String

    public init(dividends: [DividendHistory], symbol: String) {
        self.dividends = dividends
        self.symbol = symbol
    }
}

/// Response from the /api/stock/validate endpoint
public struct ValidationResponse: Codable, Sendable {
    public let valid: Bool
    public let name: String?
    public let exchange: String?
    public let error: String?

    public init(valid: Bool, name: String? = nil, exchange: String? = nil, error: String? = nil) {
        self.valid = valid
        self.name = name
        self.exchange = exchange
        self.error = error
    }
}

/// Error response from API
public struct ErrorResponse: Codable, Sendable {
    public let error: String
    public let retryAfterSeconds: Int?

    public init(error: String, retryAfterSeconds: Int? = nil) {
        self.error = error
        self.retryAfterSeconds = retryAfterSeconds
    }
}

// MARK: - Rate Limit Info

/// Information extracted from rate limit headers
public struct RateLimitInfo: Sendable {
    /// Maximum requests allowed per window
    public let limit: Int

    /// Remaining requests in current window
    public let remaining: Int

    /// Unix timestamp when the rate limit resets
    public let resetTimestamp: Int

    /// Seconds until retry is allowed (only present on 429 responses)
    public let retryAfterSeconds: Int?

    /// Whether the client is currently rate limited
    public var isLimited: Bool {
        remaining <= 0
    }

    public init(
        limit: Int,
        remaining: Int,
        resetTimestamp: Int,
        retryAfterSeconds: Int? = nil
    ) {
        self.limit = limit
        self.remaining = remaining
        self.resetTimestamp = resetTimestamp
        self.retryAfterSeconds = retryAfterSeconds
    }

    /// Parses rate limit info from HTTP response headers
    public static func from(headers: [AnyHashable: Any]) -> RateLimitInfo? {
        guard let limitStr = headers["X-RateLimit-Limit"] as? String,
              let remainingStr = headers["X-RateLimit-Remaining"] as? String,
              let resetStr = headers["X-RateLimit-Reset"] as? String,
              let limit = Int(limitStr),
              let remaining = Int(remainingStr),
              let reset = Int(resetStr) else {
            return nil
        }

        let retryAfter = (headers["Retry-After"] as? String).flatMap { Int($0) }

        return RateLimitInfo(
            limit: limit,
            remaining: remaining,
            resetTimestamp: reset,
            retryAfterSeconds: retryAfter
        )
    }

    /// Parses rate limit info from HTTPURLResponse
    public static func from(response: HTTPURLResponse) -> RateLimitInfo? {
        from(headers: response.allHeaderFields)
    }
}
