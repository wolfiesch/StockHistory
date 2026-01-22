import XCTest
import DCAKit
import StockHistoryAPI
@testable import DCAVisualizer

@MainActor
final class SimulationViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        TestURLProtocol.reset()
    }

    override func tearDown() {
        TestURLProtocol.reset()
        super.tearDown()
    }

    func testRunSimulationLoadsData() async throws {
        TestURLProtocol.requestHandler = { request in
            try Self.stubResponse(for: request)
        }

        let cache = SimulationCache(ttl: 3600)
        await cache.clearAll()

        let viewModel = SimulationViewModel(
            apiClient: makeClient(),
            cache: cache
        )
        configure(viewModel: viewModel)

        await viewModel.runSimulationForTesting()

        XCTAssertTrue(viewModel.simulationStore.hasData)
        XCTAssertFalse(viewModel.simulationStore.dcaResult.isEmpty)
        await cache.clearAll()
    }

    func testCachePreventsSecondNetworkCall() async throws {
        TestURLProtocol.requestHandler = { request in
            try Self.stubResponse(for: request)
        }

        let cache = SimulationCache(ttl: 3600)
        await cache.clearAll()

        let viewModel = SimulationViewModel(
            apiClient: makeClient(),
            cache: cache
        )
        configure(viewModel: viewModel)

        await viewModel.runSimulationForTesting()

        let initialRequests = TestURLProtocol.requestCount

        await viewModel.runSimulationForTesting()

        XCTAssertEqual(TestURLProtocol.requestCount, initialRequests)
        XCTAssertTrue(viewModel.simulationStore.isFromCache)
        await cache.clearAll()
    }
}

private extension SimulationViewModelTests {
    static func stubResponse(for request: URLRequest) throws -> (HTTPURLResponse, Data) {
        guard let url = request.url else {
            throw URLError(.badURL)
        }

        let statusCode = 200
        let headers = ["Content-Type": "application/json"]

        switch url.path {
        case "/api/stock/history":
            let response = HistoryResponse(prices: samplePrices, symbol: "AAPL")
            let data = try JSONEncoder().encode(response)
            return (HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: nil, headerFields: headers)!, data)

        case "/api/stock/dividends":
            let response = DividendsResponse(dividends: sampleDividends, symbol: "AAPL")
            let data = try JSONEncoder().encode(response)
            return (HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: nil, headerFields: headers)!, data)

        case "/api/stock/validate":
            let response = ValidationResponse(valid: true, name: "Apple Inc.", exchange: "NASDAQ")
            let data = try JSONEncoder().encode(response)
            return (HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: nil, headerFields: headers)!, data)

        default:
            let response = ErrorResponse(error: "Not found")
            let data = try JSONEncoder().encode(response)
            return (HTTPURLResponse(url: url, statusCode: 404, httpVersion: nil, headerFields: headers)!, data)
        }
    }

    static var samplePrices: [PricePoint] {
        [
            PricePoint(date: "2020-01-02", open: 300, high: 305, low: 295, close: 303, volume: 1000000),
            PricePoint(date: "2020-01-03", open: 303, high: 308, low: 301, close: 307, volume: 900000),
            PricePoint(date: "2020-01-06", open: 307, high: 312, low: 306, close: 310, volume: 1200000)
        ]
    }

    static var sampleDividends: [DividendHistory] {
        [
            DividendHistory(exDate: "2020-01-06", paymentDate: "2020-01-10", amount: 0.82, yield: 1.2)
        ]
    }

    func makeClient() -> StockAPIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [TestURLProtocol.self]
        let session = URLSession(configuration: configuration)

        return StockAPIClient(
            baseURL: URL(string: "https://example.com")!,
            session: session
        )
    }

    func configure(viewModel: SimulationViewModel) {
        viewModel.configStore.ticker = "AAPL"
        viewModel.configStore.amount = 100
        viewModel.configStore.frequency = .weekly
        viewModel.configStore.startDate = date(from: "2020-01-02")
        viewModel.configStore.endDate = date(from: "2020-01-06")
    }

    func date(from value: String) -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.date(from: value) ?? Date()
    }
}
