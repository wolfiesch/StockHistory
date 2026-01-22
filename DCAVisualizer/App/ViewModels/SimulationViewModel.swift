import Foundation
import SwiftUI
import DCAKit
import StockHistoryAPI

/// Main ViewModel coordinating simulation data fetching and state
@MainActor
@Observable
public final class SimulationViewModel {

    // MARK: - Dependencies

    private let apiClient: StockAPIClient
    private let cache: SimulationCache

    // MARK: - State

    public var configStore: ConfigStore
    public var simulationStore: SimulationStore
    public var playbackStore: PlaybackStore

    /// Current task for cancellation support
    private var currentTask: Task<Void, Never>?

    // MARK: - Initialization

    public init(
        apiClient: StockAPIClient,
        cache: SimulationCache = SimulationCache(),
        resetCacheOnInit: Bool = false
    ) {
        self.apiClient = apiClient
        self.cache = cache
        self.configStore = ConfigStore()
        self.simulationStore = SimulationStore()
        self.playbackStore = PlaybackStore()

        if resetCacheOnInit {
            Task {
                await cache.clearAll()
            }
        }
    }

    /// Convenience initializer with URL string
    public convenience init?(
        baseURLString: String,
        session: URLSession = .shared,
        cache: SimulationCache = SimulationCache(),
        resetCacheOnInit: Bool = false
    ) {
        guard let client = StockAPIClient(baseURLString: baseURLString, session: session) else {
            return nil
        }
        self.init(apiClient: client, cache: cache, resetCacheOnInit: resetCacheOnInit)
    }

    // MARK: - Public API

    /// Runs the simulation with current configuration
    public func runSimulation() {
        // Cancel any in-flight request
        currentTask?.cancel()

        currentTask = Task {
            await performSimulation()
        }
    }

#if DEBUG
    func runSimulationForTesting() async {
        await performSimulation()
    }
#endif

    /// Validates the current ticker
    public func validateTicker() async -> Bool {
        do {
            let result = try await apiClient.validateTicker(configStore.ticker)
            return result.valid
        } catch {
            return false
        }
    }

    // MARK: - Private Implementation

    private func performSimulation() async {
        let config = configStore.dcaConfig
        simulationStore.setLoading()
        playbackStore.reset()

        // Check cache first
        let cacheResult = await cache.get(
            ticker: config.ticker,
            startDate: config.startDateString,
            endDate: config.endDateString
        )

        var prices: [PricePoint]
        var dividends: [DividendHistory]
        var fromCache = false
        var cacheAge: String?

        switch cacheResult {
        case .fresh(let data):
            // Use fresh cached data
            prices = data.prices
            dividends = data.dividends
            fromCache = true
            cacheAge = data.ageDescription

        case .stale(let data):
            // Try to refresh, fall back to stale if offline
            do {
                (prices, dividends) = try await fetchAndCache(config: config)
            } catch {
                // Use stale data with warning
                prices = data.prices
                dividends = data.dividends
                fromCache = true
                cacheAge = data.ageDescription + " (offline)"
            }

        case .miss:
            // Must fetch from network
            do {
                (prices, dividends) = try await fetchAndCache(config: config)
            } catch is CancellationError {
                return // Silently handle cancellation
            } catch let error as StockAPIError {
                simulationStore.setError(error.localizedDescription)
                return
            } catch {
                simulationStore.setError("Failed to load data: \(error.localizedDescription)")
                return
            }
        }

        // Check for cancellation
        if Task.isCancelled { return }

        // Run simulations
        let dcaResult = DCASimulator.run(
            priceHistory: prices,
            dividendHistory: dividends,
            config: config
        )

        let lumpSumResult = LumpSumSimulator.run(
            priceHistory: prices,
            dividendHistory: dividends,
            config: config,
            totalInvestmentOverride: dcaResult.totalInvested
        )

        // Update stores
        simulationStore.setResults(
            dca: dcaResult,
            lumpSum: lumpSumResult,
            fromCache: fromCache,
            cacheAge: cacheAge
        )

        playbackStore.setTotalPoints(dcaResult.points.count)
    }

    private func fetchAndCache(
        config: DCAConfig
    ) async throws -> (prices: [PricePoint], dividends: [DividendHistory]) {
        let (prices, dividends) = try await apiClient.fetchStockData(
            symbol: config.ticker,
            from: config.startDateString,
            to: config.endDateString
        )

        // Cache the fetched data
        await cache.set(
            prices: prices,
            dividends: dividends,
            ticker: config.ticker,
            startDate: config.startDateString,
            endDate: config.endDateString
        )

        return (prices, dividends)
    }
}
