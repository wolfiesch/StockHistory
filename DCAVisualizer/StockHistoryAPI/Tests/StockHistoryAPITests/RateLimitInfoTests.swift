import XCTest
@testable import StockHistoryAPI

final class RateLimitInfoTests: XCTestCase {
    func testParsesRateLimitHeaders() {
        let headers: [AnyHashable: Any] = [
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": "12",
            "X-RateLimit-Reset": "1700000000",
            "Retry-After": "30"
        ]

        let info = RateLimitInfo.from(headers: headers)

        XCTAssertEqual(info?.limit, 60)
        XCTAssertEqual(info?.remaining, 12)
        XCTAssertEqual(info?.resetTimestamp, 1700000000)
        XCTAssertEqual(info?.retryAfterSeconds, 30)
        XCTAssertEqual(info?.isLimited, false)
    }

    func testMissingHeadersReturnNil() {
        let headers: [AnyHashable: Any] = [
            "X-RateLimit-Limit": "60"
        ]

        XCTAssertNil(RateLimitInfo.from(headers: headers))
    }
}
