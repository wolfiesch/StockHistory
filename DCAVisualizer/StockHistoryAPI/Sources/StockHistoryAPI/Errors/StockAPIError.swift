import Foundation

/// Errors that can occur when fetching stock data
/// - Note: Mirrors error handling from the web TypeScript implementation
public enum StockAPIError: Error, Sendable {
    /// The requested ticker symbol was not found
    case tickerNotFound(String)

    /// Rate limit exceeded - includes retry delay in seconds
    case rateLimited(retryAfterSeconds: Int)

    /// Network or connectivity error
    case networkError(Error)

    /// Server returned an invalid or unexpected response
    case invalidResponse(String)

    /// Server error (5xx status codes)
    case serverError(statusCode: Int, message: String)

    /// Missing required configuration (e.g., API key)
    case configurationError(String)

    /// Request was cancelled
    case cancelled
}

// MARK: - LocalizedError Conformance

extension StockAPIError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .tickerNotFound(let symbol):
            return "Ticker '\(symbol)' not found. Please check the symbol and try again."

        case .rateLimited(let retryAfter):
            return "Rate limit exceeded. Please try again in \(retryAfter) seconds."

        case .networkError(let underlyingError):
            return "Network error: \(underlyingError.localizedDescription)"

        case .invalidResponse(let message):
            return "Invalid response from server: \(message)"

        case .serverError(let statusCode, let message):
            return "Server error (\(statusCode)): \(message)"

        case .configurationError(let message):
            return "Configuration error: \(message)"

        case .cancelled:
            return "Request was cancelled"
        }
    }

    public var recoverySuggestion: String? {
        switch self {
        case .tickerNotFound:
            return "Make sure you're using a valid stock ticker symbol (e.g., AAPL, MSFT, SPY)."

        case .rateLimited(let retryAfter):
            return "The app will automatically retry in \(retryAfter) seconds."

        case .networkError:
            return "Check your internet connection and try again."

        case .invalidResponse, .serverError:
            return "Please try again later. If the problem persists, the service may be temporarily unavailable."

        case .configurationError:
            return "Please ensure the app is properly configured."

        case .cancelled:
            return nil
        }
    }
}

// MARK: - Sendable Conformance for wrapped Error

extension StockAPIError {
    /// Creates a network error that is Sendable-safe
    public static func network(_ error: any Error) -> StockAPIError {
        // Wrap in a way that preserves the error message but is Sendable
        .networkError(NetworkErrorWrapper(message: error.localizedDescription))
    }
}

/// Sendable wrapper for network errors
private struct NetworkErrorWrapper: Error, Sendable {
    let message: String

    var localizedDescription: String { message }
}
