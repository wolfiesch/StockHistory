import Foundation
import DCAKit
import StockHistoryAPI

final class StubbedStockAPIURLProtocol: URLProtocol {
    static var responseDelay: TimeInterval = 0

    override class func canInit(with request: URLRequest) -> Bool {
        guard let url = request.url else { return false }
        return url.path.contains("/api/stock/")
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let url = request.url else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL))
            return
        }

        let respond = {
            do {
                let (statusCode, data) = try Self.stubResponse(for: url)
                let headers = [
                    "Content-Type": "application/json",
                    "X-RateLimit-Limit": "60",
                    "X-RateLimit-Remaining": "59",
                    "X-RateLimit-Reset": "1700000000"
                ]

                guard let response = HTTPURLResponse(
                    url: url,
                    statusCode: statusCode,
                    httpVersion: "HTTP/1.1",
                    headerFields: headers
                ) else {
                    self.client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
                    return
                }

                self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                self.client?.urlProtocol(self, didLoad: data)
                self.client?.urlProtocolDidFinishLoading(self)
            } catch {
                self.client?.urlProtocol(self, didFailWithError: error)
            }
        }

        if Self.responseDelay > 0 {
            DispatchQueue.global().asyncAfter(deadline: .now() + Self.responseDelay, execute: respond)
        } else {
            respond()
        }
    }

    override func stopLoading() {}

    private static func stubResponse(for url: URL) throws -> (Int, Data) {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let symbol = components?.queryItems?.first { $0.name == "symbol" }?.value ?? "AAPL"
        let normalizedSymbol = symbol.uppercased()
        let invalidSymbols: Set<String> = ["ZZZZ", "INVALID"]

        switch url.path {
        case "/api/stock/history":
            if invalidSymbols.contains(normalizedSymbol) {
                let response = ErrorResponse(error: "Ticker not found")
                return (404, try JSONEncoder().encode(response))
            }
            let prices = [
                PricePoint(date: "2020-01-02", open: 300, high: 305, low: 295, close: 303, volume: 1000000),
                PricePoint(date: "2020-01-03", open: 303, high: 308, low: 301, close: 307, volume: 980000),
                PricePoint(date: "2020-01-06", open: 307, high: 312, low: 306, close: 310, volume: 1200000)
            ]
            let response = HistoryResponse(prices: prices, symbol: normalizedSymbol)
            return (200, try JSONEncoder().encode(response))

        case "/api/stock/dividends":
            if invalidSymbols.contains(normalizedSymbol) {
                let response = ErrorResponse(error: "Ticker not found")
                return (404, try JSONEncoder().encode(response))
            }
            let dividends = [
                DividendHistory(exDate: "2020-01-06", paymentDate: "2020-01-10", amount: 0.82, yield: 1.2)
            ]
            let response = DividendsResponse(dividends: dividends, symbol: normalizedSymbol)
            return (200, try JSONEncoder().encode(response))

        case "/api/stock/validate":
            if invalidSymbols.contains(normalizedSymbol) {
                let response = ValidationResponse(valid: false, error: "Ticker not found")
                return (200, try JSONEncoder().encode(response))
            }
            let response = ValidationResponse(valid: true, name: "Apple Inc.", exchange: "NASDAQ")
            return (200, try JSONEncoder().encode(response))

        default:
            let response = ErrorResponse(error: "Not found")
            return (404, try JSONEncoder().encode(response))
        }
    }
}
