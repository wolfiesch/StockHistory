import XCTest
import DCAKit
@testable import StockHistoryAPI

final class StockAPIClientTests: XCTestCase {
    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
    }

    override func tearDown() {
        URLProtocolStub.reset()
        super.tearDown()
    }

    func testFetchHistoryBuildsExpectedURL() async throws {
        let data = try makeHistoryData(symbol: "AAPL")
        URLProtocolStub.responseQueue = [
            .success(statusCode: 200, data: data)
        ]

        var capturedURL: URL?
        var capturedAcceptHeader: String?
        URLProtocolStub.requestObserver = { request in
            capturedURL = request.url
            capturedAcceptHeader = request.value(forHTTPHeaderField: "Accept")
        }

        let client = makeClient()
        let prices = try await client.fetchHistory(
            symbol: "aapl",
            from: "2020-01-01",
            to: "2020-01-31"
        )

        XCTAssertEqual(prices.count, 2)
        XCTAssertEqual(capturedAcceptHeader, "application/json")

        let components = URLComponents(url: capturedURL ?? URL(fileURLWithPath: "/"),
                                       resolvingAgainstBaseURL: false)
        XCTAssertEqual(components?.path, "/api/stock/history")

        let queryItems = components?.queryItems ?? []
        let query = Dictionary(uniqueKeysWithValues: queryItems.map { ($0.name, $0.value ?? "") })
        XCTAssertEqual(query["symbol"], "AAPL")
        XCTAssertEqual(query["from"], "2020-01-01")
        XCTAssertEqual(query["to"], "2020-01-31")
    }

    func testTickerNotFoundUsesQuerySymbol() async throws {
        let data = try makeErrorData(message: "Not found")
        URLProtocolStub.responseQueue = [
            .success(statusCode: 404, data: data)
        ]

        let client = makeClient()

        do {
            _ = try await client.fetchHistory(symbol: "zzzz")
            XCTFail("Expected tickerNotFound error")
        } catch let error as StockAPIError {
            guard case .tickerNotFound(let symbol) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
            XCTAssertEqual(symbol, "ZZZZ")
        }
    }

    func testRateLimitUsesRetryAfterHeader() async throws {
        let data = try makeErrorData(message: "Too many requests")
        let headers = [
            "Retry-After": "42",
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "1700000000"
        ]

        URLProtocolStub.responseQueue = [
            .success(statusCode: 429, headers: headers, data: data)
        ]

        let client = makeClient()

        do {
            _ = try await client.fetchHistory(symbol: "AAPL")
            XCTFail("Expected rateLimited error")
        } catch let error as StockAPIError {
            guard case .rateLimited(let retryAfter) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
            XCTAssertEqual(retryAfter, 42)
        }
    }

    func testClientErrorUsesErrorResponse() async throws {
        let data = try makeErrorData(message: "Bad request")
        URLProtocolStub.responseQueue = [
            .success(statusCode: 400, data: data)
        ]

        let client = makeClient()

        do {
            _ = try await client.fetchHistory(symbol: "AAPL")
            XCTFail("Expected invalidResponse error")
        } catch let error as StockAPIError {
            guard case .invalidResponse(let message) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
            XCTAssertEqual(message, "Bad request")
        }
    }

    func testServerErrorUsesErrorResponse() async throws {
        let data = try makeErrorData(message: "Server error")
        URLProtocolStub.responseQueue = [
            .success(statusCode: 500, data: data)
        ]

        let client = makeClient()

        do {
            _ = try await client.fetchHistory(symbol: "AAPL")
            XCTFail("Expected serverError")
        } catch let error as StockAPIError {
            guard case .serverError(let statusCode, let message) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
            XCTAssertEqual(statusCode, 500)
            XCTAssertEqual(message, "Server error")
        }
    }

    func testRetriesTransientErrors() async throws {
        let data = try makeHistoryData(symbol: "AAPL")
        URLProtocolStub.responseQueue = [
            .failure(URLError(.timedOut)),
            .success(statusCode: 200, data: data)
        ]

        let client = makeClient()
        let prices = try await client.fetchHistory(symbol: "AAPL")

        XCTAssertEqual(prices.count, 2)
        XCTAssertEqual(URLProtocolStub.requestCount, 2)
    }
}

private extension StockAPIClientTests {
    func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        return URLSession(configuration: configuration)
    }

    func makeClient() -> StockAPIClient {
        StockAPIClient(
            baseURL: URL(string: "https://example.com")!,
            session: makeSession()
        )
    }

    func makeHistoryData(symbol: String) throws -> Data {
        let prices = [
            PricePoint(date: "2020-01-02", open: 300, high: 305, low: 295, close: 303, volume: 1000000),
            PricePoint(date: "2020-01-03", open: 303, high: 308, low: 301, close: 307, volume: 900000)
        ]
        return try JSONEncoder().encode(HistoryResponse(prices: prices, symbol: symbol))
    }

    func makeErrorData(message: String) throws -> Data {
        try JSONEncoder().encode(ErrorResponse(error: message))
    }
}
