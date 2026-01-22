import Foundation

final class URLProtocolStub: URLProtocol {
    enum Response {
        case success(statusCode: Int, headers: [String: String]? = nil, data: Data)
        case failure(Error)
    }

    static var responseQueue: [Response] = []
    static var requestObserver: ((URLRequest) -> Void)?
    static var requestCount = 0

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard !Self.responseQueue.isEmpty else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }

        let response = Self.responseQueue.removeFirst()
        Self.requestCount += 1
        Self.requestObserver?(request)

        switch response {
        case .success(let statusCode, let headers, let data):
            let responseHeaders = headers ?? [:]
            guard let httpResponse = HTTPURLResponse(
                url: request.url ?? URL(fileURLWithPath: "/"),
                statusCode: statusCode,
                httpVersion: "HTTP/1.1",
                headerFields: responseHeaders
            ) else {
                client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
                return
            }

            client?.urlProtocol(self, didReceive: httpResponse, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)

        case .failure(let error):
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}

    static func reset() {
        responseQueue = []
        requestObserver = nil
        requestCount = 0
    }
}
