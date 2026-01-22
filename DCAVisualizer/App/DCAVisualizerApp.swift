import SwiftUI
import DCAKit
import StockHistoryAPI

/// Main app entry point
@main
struct DCAVisualizerApp: App {
    /// The base URL for the API - automatically selects based on build configuration
    private static var apiBaseURL: String {
        currentEnvironment.apiBaseURL
    }

    @State private var viewModel: SimulationViewModel?
    @State private var showingError = false
    @State private var errorMessage = ""

    var body: some Scene {
        WindowGroup {
            Group {
                if let viewModel = viewModel {
                    ContentView(viewModel: viewModel)
                } else {
                    configurationErrorView
                }
            }
            .onAppear {
                initializeViewModel()
            }
            .alert("Configuration Error", isPresented: $showingError) {
                Button("OK") {}
            } message: {
                Text(errorMessage)
            }
        }
    }

    private var configurationErrorView: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 60))
                .foregroundStyle(.orange)

            Text("Configuration Required")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Please update the API base URL in DCAVisualizerApp.swift to point to your deployed backend.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            Button("Retry") {
                initializeViewModel()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private func initializeViewModel() {
        let configuration = AppConfiguration.load(defaultBaseURL: Self.apiBaseURL)
        let session = makeSession(for: configuration)
        let cache = SimulationCache()
        guard let client = StockAPIClient(baseURLString: configuration.apiBaseURL, session: session) else {
            errorMessage = "Invalid API URL configuration"
            showingError = true
            return
        }
        viewModel = SimulationViewModel(
            apiClient: client,
            cache: cache,
            resetCacheOnInit: configuration.resetCacheOnLaunch
        )
    }

    private func makeSession(for configuration: AppConfiguration) -> URLSession {
#if DEBUG
        if configuration.useStubNetwork {
            let sessionConfiguration = URLSessionConfiguration.ephemeral
            sessionConfiguration.protocolClasses = [StubbedStockAPIURLProtocol.self]
            return URLSession(configuration: sessionConfiguration)
        }
#endif
        return .shared
    }
}

// MARK: - Environment Configuration

extension DCAVisualizerApp {
    /// App configuration for different environments
    enum Environment {
        case development
        case staging
        case production

        var apiBaseURL: String {
            switch self {
            case .development:
                return "http://localhost:3000"
            case .staging:
                return "https://stock-history-wolfies-projects-f5e988e2.vercel.app"
            case .production:
                return "https://stock-history-ruby.vercel.app"
            }
        }
    }

    /// Current environment (change for different builds)
    /// Note: Set to .development if running local Next.js server (pnpm dev)
    static var currentEnvironment: Environment {
        // Using production for both Debug and Release since backend is deployed
        // Change to .development if you want to use localhost:3000
        .production
    }
}
