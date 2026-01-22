import Foundation
import DCAKit

/// Observable store for simulation results
/// - Note: Mirrors `useSimulationStore` concept from the web implementation
@Observable
public final class SimulationStore {

    // MARK: - State

    /// Current loading state
    public enum LoadingState: Equatable {
        case idle
        case loading
        case loaded
        case error(String)
    }

    /// Current loading state
    public var loadingState: LoadingState = .idle

    /// DCA simulation result
    public var dcaResult: SimulationResult = .empty

    /// Lump sum simulation result (for comparison)
    public var lumpSumResult: SimulationResult = .empty

    /// Whether data was loaded from cache
    public var isFromCache: Bool = false

    /// Age description of cached data (if applicable)
    public var cacheAgeDescription: String?

    // MARK: - Computed Properties

    /// Whether the simulation is currently loading
    public var isLoading: Bool {
        loadingState == .loading
    }

    /// Whether we have valid simulation data
    public var hasData: Bool {
        !dcaResult.isEmpty
    }

    /// Error message (if in error state)
    public var errorMessage: String? {
        if case .error(let message) = loadingState {
            return message
        }
        return nil
    }

    /// Total number of data points in the DCA simulation
    public var dataPointCount: Int {
        dcaResult.points.count
    }

    // MARK: - Actions

    /// Clears all simulation data
    public func clear() {
        loadingState = .idle
        dcaResult = .empty
        lumpSumResult = .empty
        isFromCache = false
        cacheAgeDescription = nil
    }

    /// Sets loading state
    public func setLoading() {
        loadingState = .loading
    }

    /// Sets results from a successful simulation
    public func setResults(
        dca: SimulationResult,
        lumpSum: SimulationResult,
        fromCache: Bool = false,
        cacheAge: String? = nil
    ) {
        dcaResult = dca
        lumpSumResult = lumpSum
        isFromCache = fromCache
        cacheAgeDescription = cacheAge
        loadingState = .loaded
    }

    /// Sets error state
    public func setError(_ message: String) {
        loadingState = .error(message)
    }
}
