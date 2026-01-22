import Foundation
import DCAKit

/// Actor-based API client for fetching stock data
/// - Note: Uses the existing web app's API routes as the backend
///
/// ## Thread Safety
/// This client is implemented as an actor to ensure thread-safe access
/// to shared state like the URLSession and rate limit tracking.
///
/// ## Rate Limiting
/// The client automatically parses rate limit headers and can inform
/// callers when they need to back off. Use `rateLimitInfo` to check
/// current rate limit status.
public actor StockAPIClient {

    // MARK: - Configuration

    /// Base URL for the API (e.g., "https://your-app.vercel.app")
    private let baseURL: URL

    /// URLSession for making requests
    private let session: URLSession

    /// Current rate limit information (updated after each request)
    private var currentRateLimitInfo: RateLimitInfo?

    // MARK: - Initialization

    /// Creates a new API client
    /// - Parameters:
    ///   - baseURL: Base URL for the API (without trailing slash)
    ///   - session: URLSession to use (defaults to shared session)
    public init(
        baseURL: URL,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.session = session
    }

    /// Convenience initializer with string URL
    public init?(
        baseURLString: String,
        session: URLSession = .shared
    ) {
        guard let url = URL(string: baseURLString) else {
            return nil
        }
        self.init(baseURL: url, session: session)
    }

    // MARK: - Public API

    /// Current rate limit status (if available)
    public var rateLimitInfo: RateLimitInfo? {
        currentRateLimitInfo
    }

    /// Fetches price history for a stock
    /// - Parameters:
    ///   - symbol: Stock ticker symbol (e.g., "AAPL")
    ///   - from: Optional start date (YYYY-MM-DD format)
    ///   - to: Optional end date (YYYY-MM-DD format)
    /// - Returns: Array of price points sorted by date ascending
    /// - Throws: `StockAPIError` on failure
    public func fetchHistory(
        symbol: String,
        from: String? = nil,
        to: String? = nil
    ) async throws -> [PricePoint] {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/stock/history"), resolvingAgainstBaseURL: false)!

        var queryItems = [URLQueryItem(name: "symbol", value: symbol.uppercased())]
        if let from = from {
            queryItems.append(URLQueryItem(name: "from", value: from))
        }
        if let to = to {
            queryItems.append(URLQueryItem(name: "to", value: to))
        }
        components.queryItems = queryItems

        guard let url = components.url else {
            throw StockAPIError.invalidResponse("Invalid URL construction")
        }

        let response: HistoryResponse = try await performRequest(url: url)
        return response.prices
    }

    /// Fetches dividend history for a stock
    /// - Parameters:
    ///   - symbol: Stock ticker symbol (e.g., "AAPL")
    ///   - from: Optional start date (YYYY-MM-DD format)
    ///   - to: Optional end date (YYYY-MM-DD format)
    /// - Returns: Array of dividend records sorted by ex-date
    /// - Throws: `StockAPIError` on failure
    public func fetchDividends(
        symbol: String,
        from: String? = nil,
        to: String? = nil
    ) async throws -> [DividendHistory] {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/stock/dividends"), resolvingAgainstBaseURL: false)!

        var queryItems = [URLQueryItem(name: "symbol", value: symbol.uppercased())]
        if let from = from {
            queryItems.append(URLQueryItem(name: "from", value: from))
        }
        if let to = to {
            queryItems.append(URLQueryItem(name: "to", value: to))
        }
        components.queryItems = queryItems

        guard let url = components.url else {
            throw StockAPIError.invalidResponse("Invalid URL construction")
        }

        let response: DividendsResponse = try await performRequest(url: url)
        return response.dividends
    }

    /// Validates a ticker symbol
    /// - Parameter symbol: Stock ticker symbol to validate
    /// - Returns: Validation response with name and exchange if valid
    /// - Throws: `StockAPIError` on network/server failure
    public func validateTicker(_ symbol: String) async throws -> ValidationResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/stock/validate"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "symbol", value: symbol.uppercased())]

        guard let url = components.url else {
            throw StockAPIError.invalidResponse("Invalid URL construction")
        }

        return try await performRequest(url: url)
    }

    /// Fetches both price history and dividends in parallel
    /// - Parameters:
    ///   - symbol: Stock ticker symbol
    ///   - from: Optional start date
    ///   - to: Optional end date
    /// - Returns: Tuple of (prices, dividends)
    /// - Throws: `StockAPIError` on failure
    public func fetchStockData(
        symbol: String,
        from: String? = nil,
        to: String? = nil
    ) async throws -> (prices: [PricePoint], dividends: [DividendHistory]) {
        async let pricesTask = fetchHistory(symbol: symbol, from: from, to: to)
        async let dividendsTask = fetchDividends(symbol: symbol, from: from, to: to)

        let prices = try await pricesTask
        let dividends = try await dividendsTask

        return (prices, dividends)
    }

    // MARK: - Private Helpers

    /// Performs an HTTP GET request and decodes the response
    private func performRequest<T: Decodable>(url: URL) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await performWithRetry(request: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw StockAPIError.invalidResponse("Not an HTTP response")
        }

        // Update rate limit info
        currentRateLimitInfo = RateLimitInfo.from(response: httpResponse)

        // Handle error status codes
        switch httpResponse.statusCode {
        case 200...299:
            break // Success
        case 404:
            let symbol = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first { $0.name == "symbol" }?
                .value
            let resolvedSymbol = symbol?.uppercased() ?? url.lastPathComponent
            throw StockAPIError.tickerNotFound(resolvedSymbol)
        case 429:
            let retryAfter = currentRateLimitInfo?.retryAfterSeconds ?? 60
            throw StockAPIError.rateLimited(retryAfterSeconds: retryAfter)
        case 400...499:
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw StockAPIError.invalidResponse(errorResponse?.error ?? "Client error")
        case 500...599:
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw StockAPIError.serverError(
                statusCode: httpResponse.statusCode,
                message: errorResponse?.error ?? "Server error"
            )
        default:
            throw StockAPIError.invalidResponse("Unexpected status code: \(httpResponse.statusCode)")
        }

        // Decode response
        do {
            let decoder = JSONDecoder()
            return try decoder.decode(T.self, from: data)
        } catch {
            throw StockAPIError.invalidResponse("Failed to decode response: \(error.localizedDescription)")
        }
    }

    /// Performs request with exponential backoff retry for transient failures
    private func performWithRetry(
        request: URLRequest,
        maxRetries: Int = 3
    ) async throws -> (Data, URLResponse) {
        var lastError: Error?
        var delay: UInt64 = 1_000_000_000 // 1 second in nanoseconds

        for attempt in 0..<maxRetries {
            do {
                return try await session.data(for: request)
            } catch is CancellationError {
                throw StockAPIError.cancelled
            } catch let error as URLError where error.code == .cancelled {
                throw StockAPIError.cancelled
            } catch let error as URLError where isTransientError(error) {
                lastError = error
                if attempt < maxRetries - 1 {
                    try await Task.sleep(nanoseconds: delay)
                    delay *= 2 // Exponential backoff
                }
            } catch {
                throw StockAPIError.network(error)
            }
        }

        throw StockAPIError.network(lastError ?? URLError(.unknown))
    }

    /// Determines if an error is transient and worth retrying
    private func isTransientError(_ error: URLError) -> Bool {
        switch error.code {
        case .timedOut,
             .networkConnectionLost,
             .notConnectedToInternet,
             .cannotConnectToHost:
            return true
        default:
            return false
        }
    }
}
